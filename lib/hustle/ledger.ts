import "server-only";
import type postgres from "postgres";

type Tx = postgres.ReservedSql;

export type Pot = { kind: "wallet"; id: string } | { kind: "business"; id: string } | { kind: "system" };

export const SYSTEM: Pot = { kind: "system" };
export const wallet = (userId: string): Pot => ({ kind: "wallet", id: userId });
export const business = (businessId: string): Pot => ({ kind: "business", id: businessId });

export type Reason =
  | "grant" | "allawee" | "task" | "prize" | "purchase_need" | "purchase_supply" | "sale" | "rent" | "upkeep" | "marketing"
  | "running_cost" | "backup_market" | "townspeople" | "spoilage_salvage" | "credit_repaid" | "decision" | "invest"
  | "owner_draw" | "admin_adjust" | "restructure";

export class NotEnoughMoney extends Error {
  constructor(public pot: Pot) {
    super(pot.kind === "wallet" ? "not enough in wallet" : "not enough business cash");
  }
}

/**
 * The only way game money moves. Takes `amount` from one pot and adds it to another, and writes the ledger row,
 * all inside the caller's transaction. With `allowNegative` false (the default) a wallet or business that can't
 * cover it throws NotEnoughMoney and nothing changes. Rent and other end-of-day charges pass true: a business can
 * go into the red (and is restructured below −₦10,000). Zero amounts do nothing.
 */
export async function move(
  tx: Tx,
  from: Pot,
  to: Pot,
  amount: number,
  reason: Reason,
  opts: { allowNegative?: boolean; source?: string; ref?: string | number; note?: string } = {},
) {
  const amt = Math.round(amount);
  if (!Number.isFinite(amt) || amt < 0) throw new Error(`bad amount ${amount}`);
  if (amt === 0) return;
  if (from.kind === to.kind && from.kind !== "system" && to.kind !== "system" && from.id === (to as { id: string }).id) {
    throw new Error("can't move money to the same pot");
  }
  const strict = !opts.allowNegative;
  if (from.kind === "wallet") {
    const r = await tx`UPDATE hustle_wallets SET balance = balance - ${amt} WHERE user_id = ${from.id} AND (${!strict} OR balance >= ${amt}) RETURNING 1`;
    if (!r.length) throw new NotEnoughMoney(from);
  } else if (from.kind === "business") {
    const r = await tx`UPDATE hustle_businesses SET cash = cash - ${amt} WHERE id = ${from.id} AND (${!strict} OR cash >= ${amt}) RETURNING 1`;
    if (!r.length) throw new NotEnoughMoney(from);
  }
  if (to.kind === "wallet") {
    const r = await tx`UPDATE hustle_wallets SET balance = balance + ${amt} WHERE user_id = ${to.id} RETURNING 1`;
    if (!r.length) throw new Error("no such wallet");
  } else if (to.kind === "business") {
    const r = await tx`UPDATE hustle_businesses SET cash = cash + ${amt} WHERE id = ${to.id} RETURNING 1`;
    if (!r.length) throw new Error("no such business");
  }
  await tx`
    INSERT INTO hustle_ledger (from_kind, from_id, to_kind, to_id, amount, reason, source, ref_id, note)
    VALUES (${from.kind}, ${from.kind === "system" ? null : from.id}, ${to.kind}, ${to.kind === "system" ? null : to.id},
            ${amt}, ${reason}, ${opts.source ?? null}, ${opts.ref == null ? null : String(opts.ref)}, ${opts.note ?? null})
  `;
}
