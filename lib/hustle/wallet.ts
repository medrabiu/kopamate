import "server-only";
import type postgres from "postgres";
import { sql, transaction } from "../db";
import { lagosDate } from "../util";
import { business, move, NotEnoughMoney, SYSTEM, wallet } from "./ledger";
import { getHustleSettings } from "./settings";

type Tx = postgres.ReservedSql;

export const lagosMonth = (d = new Date()) => lagosDate(d).slice(0, 7);

/** Start of today in Lagos, as a timestamp (Lagos is UTC+1 all year). */
export const lagosDayStart = (day = lagosDate()) => new Date(`${day}T00:00:00+01:00`);

/** Pays this month's Allawee if it hasn't been paid yet. Safe to call any number of times. Returns the amount paid. */
export async function payAllawee(tx: Tx, userId: string, amount: number, month = lagosMonth()) {
  const [claimed] = await tx`
    UPDATE hustle_wallets SET last_allawee_month = ${month}
    WHERE user_id = ${userId} AND (last_allawee_month IS NULL OR last_allawee_month < ${month})
    RETURNING 1
  `;
  if (!claimed || amount <= 0) return 0;
  await move(tx, SYSTEM, wallet(userId), amount, "allawee", { source: month });
  await tx`
    INSERT INTO notifications (user_id, kind, title, body, url)
    VALUES (${userId}, 'hustle', ${`Your Allawee has dropped: ₦${amount.toLocaleString("en-NG")}`}, 'Game money in your My Hustle wallet.', '/hustle/wallet')
  `;
  return amount;
}

/** Creates the user's wallet if needed (with this month's Allawee). */
export async function ensureWallet(tx: Tx, userId: string) {
  const [created] = await tx`INSERT INTO hustle_wallets (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING RETURNING 1`;
  const s = await getHustleSettings(tx);
  await payAllawee(tx, userId, s.allawee);
  return Boolean(created);
}

/** Wallet rewards for Kopamate tasks (all within the daily cap, hustle_task_cap). */
export const TASK_REWARDS = { quiz: 100, follow: 20, invite: 200 } as const;

/** Task money already credited today (Lagos), for the daily cap. */
async function taskEarnedToday(db: Tx | typeof sql, userId: string) {
  const [r] = await db<{ n: string }[]>`
    SELECT coalesce(sum(amount), 0) AS n FROM hustle_ledger
    WHERE to_kind = 'wallet' AND to_id = ${userId} AND reason = 'task' AND at >= ${lagosDayStart()}
  `;
  return Number(r.n);
}

/**
 * Pays a wallet reward for a Kopamate task (quiz, follow, verified invite), up to the daily cap
 * (hustle_task_cap). Only users who already have a wallet (they've played My Hustle) are paid.
 * With `ref`, the same task pays only once. Never throws: a reward must never break the action that earned it.
 * Returns what was credited.
 */
export async function creditTaskReward(userId: string, source: string, amount: number, ref?: string): Promise<number> {
  try {
    return await transaction(async (tx) => {
      const [w] = await tx`SELECT 1 FROM hustle_wallets WHERE user_id = ${userId} FOR UPDATE`;
      if (!w) return 0;
      const s = await getHustleSettings(tx);
      if (s.enabled === "off") return 0;
      // A task with a ref (the person followed, the friend verified) pays once, ever.
      if (ref) {
        const [done] = await tx`
          SELECT 1 FROM hustle_ledger WHERE to_kind = 'wallet' AND to_id = ${userId} AND reason = 'task' AND source = ${source} AND ref_id = ${ref} LIMIT 1
        `;
        if (done) return 0;
      }
      const pay = Math.min(amount, Math.max(0, s.taskCap - (await taskEarnedToday(tx, userId))));
      if (pay <= 0) return 0;
      await move(tx, SYSTEM, wallet(userId), pay, "task", { source, ref });
      return pay;
    });
  } catch (err) {
    console.error("creditTaskReward failed", err);
    return 0;
  }
}

/** Contest prizes and admin grants: uncapped, always logged with who gave it. */
export async function grantPrize(tx: Tx, to: { wallet: string } | { business: string }, amount: number, note: string, adminId: string) {
  await move(tx, SYSTEM, "wallet" in to ? wallet(to.wallet) : business(to.business), amount, "prize", { source: adminId, note });
}

export type MoveResult = { ok: true } | { error: string };

/** Wallet → business ("Invest in my business") or business → wallet ("Pay myself"). */
export async function transfer(userId: string, direction: "invest" | "draw", amount: number): Promise<MoveResult> {
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Enter an amount in naira." };
  if (amount > 10_000_000) return { error: "That amount is too large." };
  try {
    return await transaction(async (tx) => {
      const [b] = await tx<{ id: string; status: string; trading_frozen: boolean }[]>`
        SELECT id, status, trading_frozen FROM hustle_businesses WHERE owner_user_id = ${userId} FOR UPDATE
      `;
      if (!b) return { error: "Start a business first." };
      if (b.trading_frozen) return { error: "Your business is paused for a check. Message the Kopamate team." };
      if (direction === "invest") await move(tx, wallet(userId), business(b.id), amount, "invest");
      else await move(tx, business(b.id), wallet(userId), amount, "owner_draw");
      return { ok: true } as const;
    });
  } catch (err) {
    if (err instanceof NotEnoughMoney) {
      return {
        error:
          err.pot.kind === "wallet"
            ? "Not enough in your wallet. Pay yourself from your business or wait for Allawee."
            : "Not enough business cash. Pay yourself a smaller amount.",
      };
    }
    throw err;
  }
}

export type WalletView = {
  balance: number;
  taskToday: number;
  taskCap: number;
  allawee: number;
  nextAllaweeOn: string;
  recent: { at: Date; label: string; amount: number }[];
};

const REASON_LABEL: Record<string, string> = {
  grant: "Startup money",
  allawee: "Allawee",
  task: "Task",
  prize: "Prize",
  purchase_need: "Bought",
  invest: "Invested in my business",
  owner_draw: "Paid myself",
  admin_adjust: "Adjustment by Kopamate",
  restructure: "Restructure",
};

const TASK_LABEL: Record<string, string> = {
  quiz: "Task: Daily Quiz",
  follow: "Task: followed a corper",
  invite: "Task: friend got verified",
};

export async function getWalletView(userId: string): Promise<WalletView> {
  const s = await getHustleSettings();
  const [[w], recent, taskToday] = await Promise.all([
    sql<{ balance: string }[]>`SELECT balance FROM hustle_wallets WHERE user_id = ${userId}`,
    sql<{ at: Date; reason: string; source: string | null; note: string | null; amount: string; incoming: boolean }[]>`
      SELECT at, reason, source, note, amount, (to_kind = 'wallet' AND to_id = ${userId}) AS incoming
      FROM hustle_ledger
      WHERE (to_kind = 'wallet' AND to_id = ${userId}) OR (from_kind = 'wallet' AND from_id = ${userId})
      ORDER BY at DESC, id DESC LIMIT 20
    `,
    taskEarnedToday(sql, userId),
  ]);
  const [y, m] = lagosMonth().split("-").map(Number);
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  return {
    balance: Number(w?.balance ?? 0),
    taskToday,
    taskCap: s.taskCap,
    allawee: s.allawee,
    nextAllaweeOn: next.toISOString().slice(0, 10),
    recent: recent.map((r) => {
      let label = REASON_LABEL[r.reason] ?? r.reason;
      if (r.reason === "task") label = TASK_LABEL[r.source ?? ""] ?? "Task";
      if (r.reason === "allawee" && r.source) {
        const [yy, mm] = r.source.split("-").map(Number);
        label = `Allawee · ${new Date(Date.UTC(yy, mm - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}`;
      }
      if ((r.reason === "purchase_need" || r.reason === "prize") && r.note) label = `${label} · ${r.note}`;
      return { at: r.at, label, amount: r.incoming ? Number(r.amount) : -Number(r.amount) };
    }),
  };
}
