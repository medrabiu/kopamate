"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql, transaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { awardBadge } from "@/lib/badges";
import { duplicateWinners, splitProblem, type Prize } from "@/lib/challenge-rules";
import {
  ensureChallengeBadges,
  entrantBadge,
  getChallengeById,
  getPool,
  logChallenge,
  notifyUser,
  winnerBadge,
  type Challenge,
  type ChallengeStatus,
} from "@/lib/challenges";

const STATUSES: ChallengeStatus[] = ["draft", "upcoming", "open", "closed", "results"];
const FOUNDING_CREATORS = 50;

const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max);

async function challengeFrom(fd: FormData) {
  const c = await getChallengeById(Number(fd.get("challenge_id")));
  if (!c) throw new Error("No such challenge");
  return c;
}

function back(c: { id: number }, page: string, msg: string): never {
  revalidatePath(`/admin/challenges/${c.id}`, "layout");
  const path = `/admin/challenges/${c.id}${page ? `/${page}` : ""}`;
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${msg}`);
}

/** "2026-10-12T09:00" from a datetime-local field, read as Lagos time (UTC+1 all year). */
function lagosTime(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function int(fd: FormData, name: string, min: number, max: number): number | null {
  const n = Number(String(fd.get(name) ?? "").replace(/[,\s₦]/g, ""));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const DEFAULT_SPLIT: Prize[] = [
  { key: "first", label: "1st place", pct: 50 },
  { key: "second", label: "2nd place", pct: 20 },
  { key: "third", label: "3rd place", pct: 10 },
  { key: "recruiter", label: "Top Recruiter", pct: 10 },
  { key: "rising", label: "Rising creator", pct: 10 },
];

/** A new challenge, as a draft with the default pool and prizes. */
export async function createChallenge(fd: FormData) {
  const admin = await requireAdmin();
  const title = text(fd, "title", 100);
  const slug = text(fd, "slug", 60).toLowerCase();
  if (!title || !/^[a-z0-9-]{3,60}$/.test(slug)) redirect("/admin/challenges?msg=invalid");
  const [taken] = await sql`SELECT 1 FROM challenges WHERE slug = ${slug}`;
  if (taken) redirect("/admin/challenges?msg=taken");
  const [c] = await sql<{ id: number; badge_name: string }[]>`
    INSERT INTO challenges (slug, title, badge_name, prize_split)
    VALUES (${slug}, ${title}, ${title.replace(/^Kopamate\s+/i, "")}, ${sql.json(DEFAULT_SPLIT as never)})
    RETURNING id, badge_name
  `;
  await ensureChallengeBadges(c);
  await logChallenge(c.id, admin.id, "created", { slug, title });
  back(c, "", "created");
}

/** Every setting. The pool and prizes are locked once winners are published. */
export async function saveChallenge(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  const status = String(fd.get("status")) as ChallengeStatus;
  if (!STATUSES.includes(status)) back(c, "", "invalid");

  const opens = lagosTime(text(fd, "opens_at", 20));
  const closes = lagosTime(text(fd, "closes_at", 20));
  const verifyBy = text(fd, "verify_by", 20) ? lagosTime(text(fd, "verify_by", 20)) : null;
  if ((status === "open" || status === "upcoming") && (!opens || !closes)) back(c, "", "dates");
  if (opens && closes && closes <= opens) back(c, "", "dates");

  const links: Record<string, string> = {};
  for (const k of ["x", "tiktok", "instagram", "whatsapp"]) {
    const v = text(fd, `link_${k}`, 300);
    if (v && !v.startsWith("https://")) back(c, "", "links");
    if (v) links[k] = v;
  }
  const tags: Record<string, string> = {};
  for (const k of ["x", "tiktok", "instagram"]) {
    const v = text(fd, `tag_${k}`, 40);
    if (v) tags[k] = v.startsWith("@") ? v : `@${v}`;
  }

  const locked = Boolean(c.published_at);
  let split = c.prize_split;
  if (!locked) {
    const keys = fd.getAll("prize_key").map(String);
    const labels = fd.getAll("prize_label").map(String);
    const pcts = fd.getAll("prize_pct").map(Number);
    split = keys
      .map((key, i) => ({ key: key.trim(), label: (labels[i] ?? "").trim(), pct: pcts[i] }))
      .filter((p) => p.key || p.label || p.pct);
    if (splitProblem(split)) back(c, "", "split");
  }
  const n = {
    max: int(fd, "max_entries_per_user", 1, 10),
    due: int(fd, "metrics_due_hours", 0, 24 * 30),
    // Locked pool fields are disabled on the form (not sent), so they keep their saved values.
    base: locked ? c.pool_base : int(fd, "pool_base", 0, 100_000_000),
    stepEntries: locked ? c.pool_step_entries : int(fd, "pool_step_entries", 1, 1_000_000),
    stepAmount: locked ? c.pool_step_amount : int(fd, "pool_step_amount", 0, 100_000_000),
    cap: locked ? c.pool_cap : int(fd, "pool_cap", 0, 100_000_000),
  };
  if (Object.values(n).some((v) => v === null) || n.cap! < n.base!) back(c, "", "numbers");

  const title = text(fd, "title", 100) || c.title;
  const badgeName = text(fd, "badge_name", 60) || c.badge_name;
  await sql`
    UPDATE challenges SET
      title = ${title}, badge_name = ${badgeName},
      brief = ${text(fd, "brief", 5000)}, ideas = ${text(fd, "ideas", 5000)}, rules = ${text(fd, "rules", 10000)},
      hashtag = ${text(fd, "hashtag", 60) || null},
      required_tags = ${sql.json(tags as never)}, social_links = ${sql.json(links as never)},
      max_entries_per_user = ${n.max}, metrics_due_hours = ${n.due}, ask_for_stats = ${fd.get("ask_for_stats") === "on"},
      opens_at = ${opens}, closes_at = ${closes}, verify_by = ${verifyBy},
      status = ${locked ? "results" : status},
      pool_base = ${locked ? c.pool_base : n.base}, pool_step_entries = ${locked ? c.pool_step_entries : n.stepEntries},
      pool_step_amount = ${locked ? c.pool_step_amount : n.stepAmount}, pool_cap = ${locked ? c.pool_cap : n.cap},
      prize_split = ${sql.json(split as never)}
    WHERE id = ${c.id}
  `;
  await ensureChallengeBadges({ id: c.id, badge_name: badgeName });
  await logChallenge(c.id, admin.id, "settings", { status, opens_at: opens, closes_at: closes });
  revalidatePath("/home");
  revalidatePath(`/challenges/${c.slug}`);
  back(c, "", "saved");
}

/** Approve, reject (with a reason the entrant sees) or disqualify one or more entries. */
export async function reviewEntries(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  const decision = String(fd.get("decision"));
  const ids = fd.getAll("entry_id").map(Number).filter(Number.isInteger);
  if (!["approved", "rejected", "disqualified", "pending"].includes(decision) || ids.length === 0) back(c, "entries", "none");
  const reason = text(fd, "reason", 300) || null;
  if (decision === "rejected" && !reason) back(c, "entries", "reason");

  const changed = await sql<{ id: number; user_id: string }[]>`
    UPDATE challenge_entries SET status = ${decision}, reject_reason = ${decision === "rejected" ? reason : null},
      reviewed_by = ${admin.id}, reviewed_at = now(),
      first_approved_at = CASE WHEN ${decision} = 'approved' THEN COALESCE(first_approved_at, now()) ELSE first_approved_at END
    WHERE challenge_id = ${c.id} AND id IN ${sql(ids)} AND status <> ${decision}
    RETURNING id, user_id
  `;
  await logChallenge(c.id, admin.id, `entry_${decision}`, { entries: changed.map((e) => e.id), reason });

  const users = [...new Set(changed.map((e) => e.user_id))];
  if (decision === "approved" && users.length) {
    await ensureChallengeBadges(c);
    for (const u of users) await awardBadge(u, entrantBadge(c), admin.id);
    // Founding Creator: the first 50 people (across all challenges) to have an entry approved.
    await sql`
      INSERT INTO user_badges (user_id, badge_slug, awarded_by)
      SELECT user_id, 'founding_creator', 'system' FROM (
        SELECT user_id, min(first_approved_at) AS at FROM challenge_entries
        WHERE first_approved_at IS NOT NULL GROUP BY user_id ORDER BY at LIMIT ${FOUNDING_CREATORS}
      ) f
      ON CONFLICT (user_id, badge_slug) DO NOTHING
    `;
  }
  const url = `/challenges/${c.slug}/mine`;
  after(async () => {
    for (const u of users) {
      if (decision === "approved") await notifyUser(u, "✅ Your entry is approved", "It now counts toward the prize pool. Keep sharing your link!", url);
      if (decision === "rejected") await notifyUser(u, "Your entry wasn't accepted", reason ?? "Open your entries to see why.", url);
      if (decision === "disqualified") await notifyUser(u, "An entry was disqualified", "Open your entries to see which one.", url);
    }
  });
  revalidatePath(`/challenges/${c.slug}`);
  revalidatePath("/home");
  back(c, "entries", `entries_${decision}`);
}

/** Checks (and if needed corrects) an entry's post stats. Edits are logged with the old numbers. */
export async function checkMetrics(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  const id = Number(fd.get("entry_id"));
  const [old] = await sql<{ views: number | null; likes: number | null; comments: number | null; shares: number | null }[]>`
    SELECT views, likes, comments, shares FROM challenge_entries WHERE id = ${id} AND challenge_id = ${c.id}
  `;
  if (!old) back(c, "entries", "none");
  const verified = fd.get("verified") === "1";
  const nums = Object.fromEntries(
    (["views", "likes", "comments", "shares"] as const).map((k) => {
      const raw = String(fd.get(k) ?? "").replace(/[,\s]/g, "");
      const n = raw === "" ? null : Number(raw);
      return [k, n === null || (Number.isInteger(n) && n >= 0) ? n : old[k]];
    }),
  ) as typeof old;
  await sql`
    UPDATE challenge_entries SET views = ${nums.views}, likes = ${nums.likes}, comments = ${nums.comments}, shares = ${nums.shares},
      metrics_verified = ${verified}, metrics_verified_by = ${verified ? admin.id : null}
    WHERE id = ${id}
  `;
  const edited = (Object.keys(nums) as (keyof typeof old)[]).some((k) => nums[k] !== old[k]);
  await logChallenge(c.id, admin.id, verified ? "metrics_verified" : "metrics_unverified", { entry: id, ...(edited ? { old, new: nums } : {}) });
  back(c, "entries", "metrics");
}

/** Voids a sign-up with a reason (or brings it back). */
export async function voidSignup(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  const id = Number(fd.get("signup_id"));
  const restore = fd.get("restore") === "1";
  const reason = text(fd, "reason", 200) || "Voided by the team";
  await sql`
    UPDATE challenge_signups SET void_reason = ${restore ? null : reason}, voided_by = ${restore ? null : admin.id},
      voided_at = ${restore ? null : new Date()}
    WHERE id = ${id} AND challenge_id = ${c.id}
  `;
  await logChallenge(c.id, admin.id, restore ? "signup_restored" : "signup_voided", { signup: id, reason: restore ? null : reason });
  back(c, `signups${fd.get("referrer") ? `?referrer=${fd.get("referrer")}` : ""}`, restore ? "restored" : "voided");
}

/** Finalist checks by hand: follows on X, the other platform, the WhatsApp Channel. */
export async function saveFollowCheck(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  const userId = String(fd.get("user_id"));
  const val = (k: string) => (fd.get(k) === "ok" ? true : fd.get(k) === "failed" ? false : null);
  const x = val("check_x");
  const other = val("check_other");
  const whatsapp = val("check_whatsapp");
  const all = [x, other, whatsapp];
  const status = all.includes(false) ? "failed" : all.some((v) => v === true) ? "ok" : "unchecked";
  await sql`
    UPDATE challenge_participants SET check_x = ${x}, check_other = ${other}, check_whatsapp = ${whatsapp},
      follow_check_status = ${status}, checked_by = ${admin.id}, checked_at = now()
    WHERE challenge_id = ${c.id} AND user_id = ${userId}
  `;
  await logChallenge(c.id, admin.id, "follow_check", { user: userId, x, other, whatsapp, status });
  back(c, "entrants", "checked");
}

/** Saves the picked winners (not published yet). One prize per person; failed follow checks can't win. */
export async function saveWinners(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  if (c.published_at) back(c, "winners", "locked");
  const picks = c.prize_split
    .map((p) => ({ prize_key: p.key, user_id: String(fd.get(`winner_${p.key}`) ?? "") }))
    .filter((p) => p.user_id);
  if (duplicateWinners(picks).length) back(c, "winners", "duplicate");

  const eligible = new Set(
    (
      await sql<{ user_id: string }[]>`
        SELECT p.user_id FROM challenge_participants p JOIN users u ON u.id = p.user_id
        WHERE p.challenge_id = ${c.id} AND p.follow_check_status <> 'failed' AND NOT u.is_banned
          AND EXISTS (SELECT 1 FROM challenge_entries e WHERE e.challenge_id = p.challenge_id AND e.user_id = p.user_id AND e.status = 'approved')
      `
    ).map((r) => r.user_id),
  );
  if (picks.some((p) => !eligible.has(p.user_id))) back(c, "winners", "ineligible");

  const { prizes } = await getPool(c);
  const amount = Object.fromEntries(prizes.map((p) => [p.key, p.amount]));
  await transaction(async (tx) => {
    await tx`DELETE FROM challenge_winners WHERE challenge_id = ${c.id}`;
    for (const p of picks) {
      if (!(amount[p.prize_key] > 0)) continue;
      await tx`
        INSERT INTO challenge_winners (challenge_id, prize_key, user_id, amount_ngn)
        VALUES (${c.id}, ${p.prize_key}, ${p.user_id}, ${amount[p.prize_key]})
      `;
    }
  });
  await logChallenge(c.id, admin.id, "winners_saved", { picks });
  back(c, "winners", "winners_saved");
}

/**
 * Publish: locks the challenge, creates each winner's reward in the rewards system (unclaimed, so they
 * claim and get paid the usual way), awards the Winner badge and tells them. Amounts use the final pool.
 */
export async function publishWinners(fd: FormData) {
  const admin = await requireAdmin();
  const c = await challengeFrom(fd);
  if (c.published_at) back(c, "winners", "locked");
  if (c.status !== "closed") back(c, "winners", "not_closed");
  const { prizes, pool } = await getPool(c);
  const label = Object.fromEntries(prizes.map((p) => [p.key, p]));

  const winners = await transaction(async (tx) => {
    const rows = await tx<{ prize_key: string; user_id: string }[]>`
      SELECT prize_key, user_id FROM challenge_winners WHERE challenge_id = ${c.id} AND reward_id IS NULL FOR UPDATE
    `;
    if (rows.length === 0) return [];
    for (const w of rows) {
      const prize = label[w.prize_key];
      if (!prize || prize.amount <= 0) throw new Error(`Prize ${w.prize_key} has no amount`);
      const [reward] = await tx<{ id: string }[]>`
        INSERT INTO rewards (user_id, title, description, kind, amount_ngn, status, batch_id)
        VALUES (${w.user_id}, ${`${c.badge_name}: ${prize.label}`}, ${c.title}, 'cash', ${prize.amount}, 'unclaimed', ${`challenge:${c.id}`})
        RETURNING id
      `;
      await tx`
        UPDATE challenge_winners SET reward_id = ${reward.id}, amount_ngn = ${prize.amount}
        WHERE challenge_id = ${c.id} AND prize_key = ${w.prize_key}
      `;
      await tx`
        INSERT INTO reward_events (reward_id, actor, action, detail)
        VALUES (${reward.id}, ${admin.id}, 'awarded', ${tx.json({ source: "challenge", challenge: c.id, prize: w.prize_key, pool } as never)})
      `;
    }
    await tx`UPDATE challenges SET published_at = now(), status = 'results' WHERE id = ${c.id}`;
    return rows;
  });
  if (winners.length === 0) back(c, "winners", "no_winners");

  await logChallenge(c.id, admin.id, "published", { winners: winners.length, pool });
  await ensureChallengeBadges(c);
  for (const w of winners) await awardBadge(w.user_id, winnerBadge(c), admin.id);
  after(async () => {
    for (const w of winners) {
      await notifyUser(
        w.user_id,
        `🏆 You won ${label[w.prize_key].label} in ${c.badge_name}!`,
        "Your prize is waiting on Rewards. Claim it to get paid.",
        "/rewards#your-rewards",
        "reward",
      );
    }
  });
  revalidatePath(`/challenges/${c.slug}`);
  revalidatePath("/home");
  revalidatePath("/rewards");
  revalidatePath("/admin/rewards");
  back(c, "winners", "published");
}

export type { Challenge };
