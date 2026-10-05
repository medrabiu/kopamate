import type { Metadata } from "next";
import { saveChallenge } from "@/app/actions/admin-challenges";
import { getPool } from "@/lib/challenges";
import { getChallengeStats } from "@/lib/challenges-admin";
import { formatNgn } from "@/lib/reward-meta";
import { formatNumber } from "@/lib/util";
import { btnPrimary, input, panel } from "../../ui";
import { challengeOr404, lagosInput, Notice, STATUS_LABEL } from "../parts";

export const metadata: Metadata = { title: "Challenge" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

const area = `${input} h-auto min-h-28 py-2 leading-relaxed`;

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-muted ${wide ? "md:col-span-2" : ""}`}>
      {label}
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

export default async function ChallengeSettingsPage({ params, searchParams }: Props) {
  const c = await challengeOr404(params);
  const { msg } = await searchParams;
  const [stats, { pool, next }] = await Promise.all([getChallengeStats(c.id), getPool(c)]);
  const locked = Boolean(c.published_at);
  const split = [...c.prize_split, { key: "", label: "", pct: 0 }, { key: "", label: "", pct: 0 }];
  const group = (kind: string) => stats.breakdown.filter((b) => b.kind === kind);

  return (
    <>
      <Notice msg={msg} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Prize pool", formatNgn(pool)],
          ["Entrants", formatNumber(stats.participants)],
          ["Entries (approved)", `${formatNumber(stats.entries)} (${formatNumber(stats.approved)})`],
          ["Views claimed (approved)", formatNumber(stats.views)],
          ["Sign-ups brought", formatNumber(stats.joined)],
          ["Verified", formatNumber(stats.verified)],
          ["Counted", formatNumber(stats.counted)],
          ["Next pool step", next ? `${next.entries} entries → +${formatNgn(next.amount)}` : "At the cap"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="h-display mt-1 text-xl">{value}</div>
          </div>
        ))}
      </section>

      {stats.breakdown.length > 0 && (
        <section className={`${panel} grid gap-4 text-sm md:grid-cols-3`}>
          {(["platform", "format", "state"] as const).map((k) => (
            <div key={k}>
              <h3 className="mb-1 font-bold capitalize">By {k}</h3>
              <ul className="text-muted">
                {group(k).slice(0, 10).map((b) => (
                  <li key={b.key} className="flex justify-between">
                    <span>{b.key}</span>
                    <span>{b.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <form action={saveChallenge} className={`${panel} grid gap-4 md:grid-cols-2`}>
        <input type="hidden" name="challenge_id" value={c.id} />
        <h3 className="h-display text-lg md:col-span-2">Settings</h3>

        <Field label="Status" hint="Draft: hidden. Upcoming: banner and countdown. Open: entries open between the dates. Closed: then pick winners.">
          <select name="status" defaultValue={c.status} disabled={locked} className={input}>
            {(["draft", "upcoming", "open", "closed"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
            {c.status === "results" && <option value="results">Results</option>}
          </select>
          {locked && <input type="hidden" name="status" value="results" />}
        </Field>
        <Field label="Title">
          <input name="title" defaultValue={c.title} required maxLength={100} className={input} />
        </Field>
        <Field label="Badge name" hint='Short, for badges and reward titles. Like "Creator Challenge #1".'>
          <input name="badge_name" defaultValue={c.badge_name} required maxLength={60} className={input} />
        </Field>
        <Field label="Suggested hashtag (optional, never required)">
          <input name="hashtag" defaultValue={c.hashtag ?? ""} maxLength={60} className={input} />
        </Field>

        <Field label="Opens (Lagos time)">
          <input type="datetime-local" name="opens_at" defaultValue={lagosInput(c.opens_at)} className={input} />
        </Field>
        <Field label="Closes (Lagos time)">
          <input type="datetime-local" name="closes_at" defaultValue={lagosInput(c.closes_at)} className={input} />
        </Field>
        <Field label="Sign-ups must be verified by (Lagos time)" hint="Leave empty for 14 days after closing.">
          <input type="datetime-local" name="verify_by" defaultValue={lagosInput(c.verify_by)} className={input} />
        </Field>
        <Field label="Post stats open after (hours)">
          <input name="metrics_due_hours" defaultValue={c.metrics_due_hours} inputMode="numeric" className={input} />
        </Field>

        <h4 className="font-bold md:col-span-2">Our accounts</h4>
        {(
          [
            ["x", "X"],
            ["tiktok", "TikTok"],
            ["instagram", "Instagram"],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="grid grid-cols-[1fr_8rem] gap-2 md:col-span-2">
            <Field label={`${label} link`}>
              <input name={`link_${k}`} type="url" defaultValue={c.social_links[k] ?? ""} placeholder="https://" className={input} />
            </Field>
            <Field label="Tag">
              <input name={`tag_${k}`} defaultValue={c.required_tags[k] ?? ""} placeholder="@kopamate" className={input} />
            </Field>
          </div>
        ))}
        <Field label="WhatsApp Channel link" wide>
          <input name="link_whatsapp" type="url" defaultValue={c.social_links.whatsapp ?? ""} placeholder="https://whatsapp.com/channel/…" className={input} />
        </Field>

        <h4 className="font-bold md:col-span-2">Pool and prizes {locked && <span className="font-normal text-muted">(locked: winners published)</span>}</h4>
        <Field label="Base pool (₦)">
          <input name="pool_base" defaultValue={c.pool_base} inputMode="numeric" disabled={locked} className={input} />
        </Field>
        <Field label="Pool cap (₦)">
          <input name="pool_cap" defaultValue={c.pool_cap} inputMode="numeric" disabled={locked} className={input} />
        </Field>
        <Field label="Add (₦)…">
          <input name="pool_step_amount" defaultValue={c.pool_step_amount} inputMode="numeric" disabled={locked} className={input} />
        </Field>
        <Field label="…for every N approved entries">
          <input name="pool_step_entries" defaultValue={c.pool_step_entries} inputMode="numeric" disabled={locked} className={input} />
        </Field>
        <Field label="Entries per person">
          <input name="max_entries_per_user" defaultValue={c.max_entries_per_user} inputMode="numeric" className={input} />
        </Field>
        <div className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
          Prize split (% of the final pool, must add up to 100). Clear a row to remove it.
          <div className="flex flex-col gap-1.5">
            {split.map((p, i) => (
              <div key={i} className="grid grid-cols-[8rem_1fr_5rem] gap-2">
                <input name="prize_key" defaultValue={p.key} placeholder="key" disabled={locked} className={input} />
                <input name="prize_label" defaultValue={p.label} placeholder="Label" disabled={locked} className={input} />
                <input name="prize_pct" defaultValue={p.pct || ""} placeholder="%" inputMode="numeric" disabled={locked} className={input} />
              </div>
            ))}
          </div>
        </div>

        <h4 className="font-bold md:col-span-2">Words</h4>
        <Field label="Brief (one paragraph per line)" wide>
          <textarea name="brief" defaultValue={c.brief} className={area} />
        </Field>
        <Field label="Example ideas (one per line)" wide>
          <textarea name="ideas" defaultValue={c.ideas} className={area} />
        </Field>
        <Field label="Rules (one per line)" wide>
          <textarea name="rules" defaultValue={c.rules} className={`${area} min-h-60`} />
        </Field>

        <div className="md:col-span-2">
          <button className={btnPrimary}>Save</button>
        </div>
      </form>
    </>
  );
}
