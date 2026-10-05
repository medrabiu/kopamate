import type { Metadata } from "next";
import Link from "next/link";
import { publishWinners, saveWinners } from "@/app/actions/admin-challenges";
import { sql } from "@/lib/db";
import { getPool } from "@/lib/challenges";
import { getEntrants } from "@/lib/challenges-admin";
import { formatNgn } from "@/lib/reward-meta";
import { btn, btnPrimary, input, panel } from "../../../ui";
import { challengeOr404, Notice } from "../../parts";

export const metadata: Metadata = { title: "Winners" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

/** Pick a winner for each prize (decided offline), save, then publish to create their rewards. */
export default async function ChallengeWinnersPage({ params, searchParams }: Props) {
  const c = await challengeOr404(params);
  const { msg } = await searchParams;
  const [entrants, { pool, prizes }, saved] = await Promise.all([
    getEntrants(c.id),
    getPool(c),
    sql<{ prize_key: string; user_id: string; nickname: string; amount_ngn: number; reward_status: string | null }[]>`
      SELECT w.prize_key, w.user_id, u.nickname, w.amount_ngn, r.status AS reward_status
      FROM challenge_winners w JOIN users u ON u.id = w.user_id LEFT JOIN rewards r ON r.id = w.reward_id
      WHERE w.challenge_id = ${c.id}
    `,
  ]);
  const picked = Object.fromEntries(saved.map((w) => [w.prize_key, w]));
  const eligible = entrants.filter((e) => e.approved > 0 && e.follow_check_status !== "failed");

  if (c.published_at) {
    return (
      <>
        <Notice msg={msg} />
        <section className={panel}>
          <h3 className="h-display mb-1 text-lg">Published</h3>
          <p className="mb-3 text-sm text-muted">
            Final pool {formatNgn(pool)}. Rewards are in{" "}
            <Link href="/admin/rewards" className="underline">
              Rewards
            </Link>
            , where winners claim and you pay them as usual.
          </p>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {prizes.map((p) => (
              <li key={p.key} className="flex justify-between gap-3 py-2">
                <span>{p.label}</span>
                <span>
                  {picked[p.key] ? `${picked[p.key].nickname} · ${formatNgn(picked[p.key].amount_ngn)} · ${picked[p.key].reward_status ?? "–"}` : "No winner"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <>
      <Notice msg={msg} />
      <p className="text-sm text-muted">
        Decide offline (use Export CSV and the Entrants list), then pick here. One prize per person. Only entrants with an approved entry who
        haven&apos;t failed the follow check can be picked. Amounts use the pool at the moment you publish (now {formatNgn(pool)}).
      </p>

      <form action={saveWinners} className={`${panel} flex flex-col gap-3`}>
        <input type="hidden" name="challenge_id" value={c.id} />
        {prizes.map((p) => (
          <label key={p.key} className="grid items-center gap-2 text-sm md:grid-cols-[12rem_1fr_7rem]">
            <span className="font-bold">{p.label}</span>
            <select name={`winner_${p.key}`} defaultValue={picked[p.key]?.user_id ?? ""} className={input}>
              <option value="">No winner yet</option>
              {eligible.map((e) => (
                <option key={e.user_id} value={e.user_id}>
                  {e.nickname} · {e.counted} counted · {e.views.toLocaleString("en-NG")} views · {e.approved} approved
                </option>
              ))}
            </select>
            <span className="text-right text-muted">{formatNgn(p.amount)}</span>
          </label>
        ))}
        <div>
          <button className={btn}>Save picks</button>
        </div>
      </form>

      <form action={publishWinners} className={`${panel} flex flex-col gap-3`}>
        <input type="hidden" name="challenge_id" value={c.id} />
        <h3 className="h-display text-lg">Publish</h3>
        <p className="text-sm text-muted">
          Creates each saved winner&apos;s reward (unclaimed, cash) in the rewards system, gives them the Winner badge, tells them, shows the winners
          on the challenge page and locks the challenge. This can&apos;t be undone. The challenge must be Closed first.
        </p>
        {saved.length === 0 ? (
          <p className="text-sm">Save picks first.</p>
        ) : (
          <>
            <ul className="text-sm">
              {saved.map((w) => (
                <li key={w.prize_key}>
                  {prizes.find((p) => p.key === w.prize_key)?.label ?? w.prize_key}: <b>{w.nickname}</b>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" required className="size-4 accent-lime" /> I&apos;ve checked these winners
            </label>
            <div>
              <button className={btnPrimary} disabled={c.status !== "closed"}>
                Publish winners
              </button>
            </div>
          </>
        )}
      </form>
    </>
  );
}
