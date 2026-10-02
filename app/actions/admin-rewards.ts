"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, transaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { track } from "@/lib/stats";
import { getBudget, getMoneySettings, getUserTotals } from "@/lib/rewards";
import { MAX_REWARD_NGN, parseAmount, REWARD_KINDS, type RewardKind, type RewardStatus } from "@/lib/reward-meta";

const UUID = /^[0-9a-f-]{36}$/i;
const BATCH = /^[a-z0-9-]{1,60}$/;

function uuid(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  if (!UUID.test(s)) throw new Error("Bad id");
  return s;
}

function text(fd: FormData, name: string, max: number) {
  return String(fd.get(name) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function kindOf(fd: FormData): RewardKind {
  const k = String(fd.get("kind") ?? "");
  return (REWARD_KINDS as readonly string[]).includes(k) ? (k as RewardKind) : "cash";
}

/** Where to send the admin afterwards: the page the form came from (admin pages only). */
function backOf(fd: FormData) {
  const b = String(fd.get("back") ?? "");
  return b.startsWith("/admin") && !b.startsWith("//") ? b : "/admin/rewards";
}

/** Redirects to `path` with a notice (msg) and any extra values, replacing older notices. */
function go(path: string, params: Record<string, string | number | undefined>): never {
  const url = new URL(path, "http://x");
  for (const k of ["msg", "n", "blocked", "skipped", "warn_budget", "warn_cap"]) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== 0) url.searchParams.set(k, String(v));
  redirect(`${url.pathname}${url.search}`);
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/rewards");
  revalidatePath("/home");
}

/** Budget and per-user cap warnings after an award or amount change (warn, never block). */
async function warnings(userIds: string[]) {
  const settings = await getMoneySettings();
  const [budget, totals] = await Promise.all([getBudget(settings), settings.cap ? getUserTotals(userIds) : new Map<string, number>()]);
  const overCap = settings.cap ? [...totals.values()].filter((t) => t > settings.cap!).length : 0;
  return { warn_budget: budget.remaining < 0 ? 1 : undefined, warn_cap: overCap || undefined };
}

type Reward = { id: string; user_id: string; status: RewardStatus; amount_ngn: number | null; title: string; kind: RewardKind };

/**
 * Moves one reward from one of `from` to a new state and writes the audit row, in one transaction.
 * Returns the reward as it was before, or null when it wasn't in an allowed state.
 */
async function move(
  rewardId: string,
  from: RewardStatus[],
  set: Record<string, unknown>,
  action: string,
  actor: string,
  detail: Record<string, unknown> = {},
): Promise<Reward | null> {
  return transaction(async (tx) => {
    const [r] = await tx<Reward[]>`
      SELECT id, user_id, status, amount_ngn, title, kind FROM rewards WHERE id = ${rewardId} FOR UPDATE
    `;
    if (!r || !from.includes(r.status)) return null;
    await tx`UPDATE rewards SET ${tx(set as never)} WHERE id = ${rewardId}`;
    await tx`
      INSERT INTO reward_events (reward_id, actor, action, detail)
      VALUES (${rewardId}, ${actor}, ${action}, ${tx.json({ from: r.status, ...detail } as never)})
    `;
    return r;
  });
}

/** One reward for one user. Without an amount (or with "Show amount" off) it starts hidden. */
export async function awardReward(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const userId = uuid(fd.get("user_id"));
  const kind = kindOf(fd);
  const title = text(fd, "title", 80);
  const amount = parseAmount(fd.get("amount"));
  const show = fd.get("show") === "1";
  if (!title) go(back, { msg: "need_title" });
  if (Number.isNaN(amount)) go(back, { msg: "bad_amount" });
  if (show && amount === null) go(back, { msg: "show_needs_amount" });
  const status: RewardStatus = show ? "unclaimed" : "hidden";

  await transaction(async (tx) => {
    const [r] = await tx<{ id: string }[]>`
      INSERT INTO rewards (user_id, title, kind, amount_ngn, status)
      SELECT id, ${title}, ${kind}, ${amount}, ${status} FROM users WHERE id = ${userId}
      RETURNING id
    `;
    if (!r) throw new Error("No such user");
    await tx`
      INSERT INTO reward_events (reward_id, actor, action, detail)
      VALUES (${r.id}, ${admin.id}, 'awarded', ${tx.json({ kind, amount, title, status } as never)})
    `;
  });
  refresh();
  go(back, { msg: "awarded", n: 1, ...(await warnings([userId])) });
}

/** Confirmed bulk award: one row per recipient (user_id, amount, title), all with the same batch id. */
export async function awardBatch(fd: FormData) {
  const admin = await requireAdmin();
  const batchId = String(fd.get("batch_id") ?? "");
  if (!BATCH.test(batchId)) throw new Error("Bad batch");
  const kind = kindOf(fd);
  const show = fd.get("show") === "1";
  const userIds = fd.getAll("user_id").map(uuid);
  const amounts = fd.getAll("amount").map(parseAmount);
  const titles = fd.getAll("title").map((t) => String(t).trim().replace(/\s+/g, " ").slice(0, 80));
  if (userIds.length === 0 || userIds.length > 5000 || amounts.length !== userIds.length || titles.length !== userIds.length) {
    go("/admin/rewards/award", { msg: "bad_batch" });
  }
  if (amounts.some((a) => Number.isNaN(a)) || titles.some((t) => !t)) go("/admin/rewards/award", { msg: "bad_batch" });
  if (show && amounts.some((a) => a === null)) go("/admin/rewards/award", { msg: "show_needs_amount" });

  // Submitting the same confirmation twice must not award twice.
  const [existing] = await sql`SELECT 1 FROM rewards WHERE batch_id = ${batchId} LIMIT 1`;
  if (existing) go("/admin/rewards", { msg: "batch_exists" });

  // Someone may have been flagged or banned since the confirmation screen was shown: skip them now.
  const eligible = new Set(
    (
      await sql<{ id: string }[]>`
        SELECT id FROM users WHERE id IN ${sql(userIds)} AND NOT is_flagged AND NOT is_banned AND completed_at IS NOT NULL
      `
    ).map((r) => r.id),
  );
  const status: RewardStatus = show ? "unclaimed" : "hidden";
  const seen = new Set<string>();
  const rows = userIds.flatMap((user_id, i) => {
    if (!eligible.has(user_id) || seen.has(user_id)) return [];
    seen.add(user_id);
    return [{ user_id, title: titles[i], kind, amount_ngn: amounts[i], status, batch_id: batchId }];
  });
  const skipped = userIds.length - rows.length;

  if (rows.length > 0) {
    await transaction(async (tx) => {
      for (let i = 0; i < rows.length; i += 1000) {
        await tx`INSERT INTO rewards ${tx(rows.slice(i, i + 1000), "user_id", "title", "kind", "amount_ngn", "status", "batch_id")}`;
      }
      await tx`
        INSERT INTO reward_events (reward_id, actor, action, detail)
        SELECT id, ${admin.id}, 'awarded',
               jsonb_build_object('batch', batch_id, 'kind', kind, 'amount', amount_ngn, 'title', title, 'status', status)
        FROM rewards WHERE batch_id = ${batchId}
      `;
    });
  }
  refresh();
  go("/admin/rewards", { msg: "batch_awarded", n: rows.length, skipped, ...(await warnings([...seen])) });
}

/** Title, kind and amount can change until the reward is claimed. An unclaimed reward must keep an amount. */
export async function updateReward(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const rewardId = uuid(fd.get("id"));
  const title = text(fd, "title", 80);
  const kind = kindOf(fd);
  const amount = parseAmount(fd.get("amount"));
  if (!title) go(back, { msg: "need_title" });
  if (Number.isNaN(amount)) go(back, { msg: "bad_amount" });

  const result = await transaction(async (tx) => {
    const [r] = await tx<Reward[]>`SELECT id, user_id, status, amount_ngn, title, kind FROM rewards WHERE id = ${rewardId} FOR UPDATE`;
    if (!r || (r.status !== "hidden" && r.status !== "unclaimed")) return "locked" as const;
    if (r.status === "unclaimed" && amount === null) return "unclaimed_needs_amount" as const;
    if (r.title === title && r.kind === kind && r.amount_ngn === amount) return { userId: r.user_id, changed: false };
    await tx`UPDATE rewards SET title = ${title}, kind = ${kind}, amount_ngn = ${amount} WHERE id = ${rewardId}`;
    await tx`
      INSERT INTO reward_events (reward_id, actor, action, detail)
      VALUES (${rewardId}, ${admin.id}, 'edited', ${tx.json({
        before: { title: r.title, kind: r.kind, amount: r.amount_ngn },
        after: { title, kind, amount },
      } as never)})
    `;
    return { userId: r.user_id, changed: true };
  });
  if (typeof result === "string") go(back, { msg: result });
  refresh();
  go(back, { msg: result.changed ? "updated" : "unchanged", ...(await warnings([result.userId])) });
}

/** Shows the amount to the user so they can claim. Needs an amount. */
export async function revealReward(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const rewardId = uuid(fd.get("id"));
  const [r] = await sql<{ amount_ngn: number | null; status: string }[]>`SELECT amount_ngn, status FROM rewards WHERE id = ${rewardId}`;
  if (r?.status === "hidden" && r.amount_ngn === null) go(back, { msg: "no_amount" });
  const moved = await move(rewardId, ["hidden"], { status: "unclaimed" }, "revealed", admin.id, { amount: r?.amount_ngn });
  refresh();
  go(back, { msg: moved ? "revealed" : "not_hidden", n: moved ? 1 : undefined });
}

/** Reveals every hidden reward in a batch that has an amount; the rest stay hidden and are counted. */
export async function revealBatch(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const batchId = String(fd.get("batch_id") ?? "");
  if (!BATCH.test(batchId)) throw new Error("Bad batch");
  const { revealed, blocked } = await transaction(async (tx) => {
    const done = await tx<{ id: string; amount_ngn: number }[]>`
      UPDATE rewards SET status = 'unclaimed'
      WHERE batch_id = ${batchId} AND status = 'hidden' AND amount_ngn IS NOT NULL
      RETURNING id, amount_ngn
    `;
    if (done.length > 0) {
      await tx`
        INSERT INTO reward_events (reward_id, actor, action, detail)
        SELECT id, ${admin.id}, 'revealed', jsonb_build_object('from', 'hidden', 'amount', amount_ngn, 'batch', batch_id)
        FROM rewards WHERE id IN ${tx(done.map((d) => d.id))}
      `;
    }
    const [left] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM rewards WHERE batch_id = ${batchId} AND status = 'hidden' AND amount_ngn IS NULL
    `;
    return { revealed: done.length, blocked: left.n };
  });
  refresh();
  go(back, { msg: "batch_revealed", n: revealed, blocked });
}

/** Only rewards that were never claimed (hidden or unclaimed) can be deleted. */
export async function deleteReward(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const rewardId = uuid(fd.get("id"));
  const [r] = await sql<{ user_id: string; title: string; amount_ngn: number | null; status: string }[]>`
    DELETE FROM rewards WHERE id = ${rewardId} AND status IN ('hidden', 'unclaimed')
    RETURNING user_id, title, amount_ngn, status
  `;
  // The reward's own audit rows go with it, so the deletion is recorded in the general events log.
  if (r) await track("reward_deleted", admin.id, { reward_id: rewardId, ...r });
  refresh();
  go(back, { msg: r ? "deleted" : "locked" });
}

export async function startProcessing(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const moved = await move(uuid(fd.get("id")), ["claimed"], { status: "processing", processing_at: new Date() }, "processing", admin.id);
  refresh();
  go(back, { msg: moved ? "processing" : "stale" });
}

export async function markPaid(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const reference = text(fd, "reference", 100);
  if (!reference) go(back, { msg: "need_reference" });
  const moved = await move(
    uuid(fd.get("id")),
    ["processing"],
    { status: "paid", paid_at: new Date(), payment_reference: reference },
    "paid",
    admin.id,
    { reference },
  );
  refresh();
  go(back, { msg: moved ? "paid" : "stale" });
}

export async function rejectReward(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const note = text(fd, "note", 200);
  if (!note) go(back, { msg: "need_note" });
  const moved = await move(
    uuid(fd.get("id")),
    ["unclaimed", "claimed", "processing"],
    { status: "rejected", rejected_at: new Date(), admin_note: note },
    "rejected",
    admin.id,
    { note },
  );
  refresh();
  go(back, { msg: moved ? "rejected" : "stale" });
}

/**
 * Gives a rejected reward another go: back to unclaimed (hidden if it has no amount) with the old
 * payout details cleared, so the user claims again with fresh details.
 */
export async function reopenReward(fd: FormData) {
  const admin = await requireAdmin();
  const back = backOf(fd);
  const rewardId = uuid(fd.get("id"));
  const [r] = await sql<{ amount_ngn: number | null }[]>`SELECT amount_ngn FROM rewards WHERE id = ${rewardId}`;
  const moved = await move(
    rewardId,
    ["rejected"],
    {
      status: r?.amount_ngn ? "unclaimed" : "hidden",
      rejected_at: null,
      admin_note: null,
      claimed_at: null,
      processing_at: null,
      payout_bank: null,
      payout_account_number: null,
      payout_account_name: null,
      payout_phone: null,
    },
    "reopened",
    admin.id,
  );
  refresh();
  go(back, { msg: moved ? "reopened" : "stale" });
}

const PRESET_KEYS = ["top_referrers", "top_state_referrers"] as const;

async function writePreset(key: string, amounts: number[]) {
  const settings = await getMoneySettings();
  const presets = { ...settings.presets, [key]: amounts };
  await sql`
    INSERT INTO settings (key, value) VALUES ('prize_presets', ${JSON.stringify(presets)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

/** "Save as preset" on the award page: stores the prize table, then reopens the page with the same inputs. */
export async function savePrizePreset(fd: FormData) {
  await requireAdmin();
  const key = String(fd.get("preset") ?? "");
  const amounts = fd.getAll("a").map(parseAmount);
  const params = new URLSearchParams();
  for (const [k, v] of fd.entries()) if (!k.startsWith("$") && k !== "preset" && typeof v === "string") params.append(k, v);
  if (!(PRESET_KEYS as readonly string[]).includes(key)) throw new Error("Bad preset");
  if (amounts.length === 0 || amounts.some((a) => a === null || Number.isNaN(a))) {
    params.set("msg", "preset_bad");
  } else {
    await writePreset(key, amounts as number[]);
    params.set("msg", "preset_saved");
  }
  redirect(`/admin/rewards/award?${params}`);
}

/** Budget, per-user cap and prize presets on the Settings page. */
export async function saveMoneySettings(fd: FormData) {
  await requireAdmin();
  const budgetRaw = String(fd.get("rewards_budget_ngn") ?? "").replace(/[₦,\s]/g, "");
  const capRaw = String(fd.get("max_claim_per_user_ngn") ?? "").replace(/[₦,\s]/g, "");
  if (!/^\d{1,10}$/.test(budgetRaw)) redirect("/admin/settings?error=budget");
  if (capRaw && (!/^\d{1,10}$/.test(capRaw) || Number(capRaw) < 1 || Number(capRaw) > MAX_REWARD_NGN * 10)) {
    redirect("/admin/settings?error=cap");
  }
  const presets = { ...(await getMoneySettings()).presets };
  for (const key of PRESET_KEYS) {
    const raw = String(fd.get(`preset_${key}`) ?? "").trim();
    if (!raw) {
      // An empty state preset means "use the nationwide one"; the nationwide preset can't be emptied.
      if (key !== "top_referrers") delete presets[key];
      continue;
    }
    const list = raw.split(/[\s,;]+/).filter(Boolean).map(parseAmount);
    if (list.length > 100 || list.some((a) => a === null || Number.isNaN(a))) redirect("/admin/settings?error=preset");
    presets[key] = list as number[];
  }
  const values: [string, string][] = [
    ["rewards_budget_ngn", String(Number(budgetRaw))],
    ["max_claim_per_user_ngn", capRaw ? String(Number(capRaw)) : ""],
    ["prize_presets", JSON.stringify(presets)],
  ];
  for (const [key, value] of values) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/settings?saved=1");
}
