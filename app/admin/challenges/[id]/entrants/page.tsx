import type { Metadata } from "next";
import Link from "next/link";
import { saveFollowCheck } from "@/app/actions/admin-challenges";
import { getEntrants } from "@/lib/challenges-admin";
import { formatNumber } from "@/lib/util";
import { btn, input, panel } from "../../../ui";
import { challengeOr404, Notice } from "../../parts";

export const metadata: Metadata = { title: "Entrants" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

function CheckSelect({ name, value }: { name: string; value: boolean | null }) {
  return (
    <select name={name} defaultValue={value === true ? "ok" : value === false ? "failed" : ""} className={`${input} h-8 text-xs`}>
      <option value="">Not checked</option>
      <option value="ok">OK</option>
      <option value="failed">Failed</option>
    </select>
  );
}

/** Everyone who joined, best recruiters first, with the finalist follow checks. */
export default async function ChallengeEntrantsPage({ params, searchParams }: Props) {
  const c = await challengeOr404(params);
  const { msg } = await searchParams;
  const rows = await getEntrants(c.id);

  return (
    <>
      <Notice msg={msg} />
      <p className="text-sm text-muted">
        Sorted by counted sign-ups (all their links). Before picking winners, check finalists by hand: that they follow us, that they&apos;re in
        the WhatsApp Channel, and that their posts are still public, tag us and carry their Kopamate link. A failed check means they can&apos;t win.
      </p>
      {rows.length === 0 ? (
        <p className={`${panel} text-sm text-muted`}>Nobody has joined yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li key={r.user_id} className={`${panel} flex flex-col gap-2 text-sm`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">
                  {i + 1}.{" "}
                  <Link href={`/admin/users/${r.user_id}`} className="underline">
                    {r.nickname}
                  </Link>{" "}
                  <span className="font-normal text-muted">· {r.state ?? "–"}</span>
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    r.follow_check_status === "ok" ? "bg-lime text-on-accent" : r.follow_check_status === "failed" ? "bg-pink text-on-accent" : "border border-line"
                  }`}
                >
                  Follow check: {r.follow_check_status}
                </span>
              </div>
              <p className="text-muted">
                {[r.x_handle && `X @${r.x_handle}`, r.tiktok_handle && `TikTok @${r.tiktok_handle}`, r.instagram_handle && `Instagram @${r.instagram_handle}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p>
                {r.approved}/{r.entries} entries approved · {formatNumber(r.views)} views claimed ·{" "}
                <Link href={`/admin/challenges/${c.id}/signups?referrer=${r.user_id}`} className="underline">
                  {r.joined} joined · {r.verified} verified · <b>{r.counted} counted</b>
                  {r.voided ? ` · ${r.voided} voided` : ""}
                </Link>
              </p>
              <p className="text-xs text-muted">
                They ticked: follow on X {r.confirmed_follow_x ? "✓" : "✗"} · TikTok/Instagram {r.confirmed_follow_other ? "✓" : "–"} · WhatsApp
                Channel {r.confirmed_whatsapp_channel ? "✓" : "✗"}
              </p>
              <form action={saveFollowCheck} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="challenge_id" value={c.id} />
                <input type="hidden" name="user_id" value={r.user_id} />
                <span className="text-xs text-muted">X</span>
                <CheckSelect name="check_x" value={r.check_x} />
                <span className="text-xs text-muted">TikTok/IG</span>
                <CheckSelect name="check_other" value={r.check_other} />
                <span className="text-xs text-muted">WhatsApp</span>
                <CheckSelect name="check_whatsapp" value={r.check_whatsapp} />
                <button className={btn}>Save check</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
