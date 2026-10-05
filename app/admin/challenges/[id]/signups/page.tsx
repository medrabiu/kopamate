import type { Metadata } from "next";
import Link from "next/link";
import { voidSignup } from "@/app/actions/admin-challenges";
import { getAdminSignups } from "@/lib/challenges-admin";
import { timeAgo } from "@/lib/util";
import { btn, input, panel } from "../../../ui";
import { challengeOr404, Notice } from "../../parts";

export const metadata: Metadata = { title: "Sign-ups" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; referrer?: string }> };

const UUID = /^[0-9a-f-]{36}$/;

/** Every sign-up credited to the challenge, flagged ones first. Void the suspicious ones (logged). */
export default async function ChallengeSignupsPage({ params, searchParams }: Props) {
  const c = await challengeOr404(params);
  const sp = await searchParams;
  const referrer = sp.referrer && UUID.test(sp.referrer) ? sp.referrer : null;
  const rows = await getAdminSignups(c.id, referrer);
  const flagged = rows.filter((r) => r.flags.length > 0).length;

  return (
    <>
      <Notice msg={sp.msg} />
      <p className="text-sm text-muted">
        {referrer ? (
          <>
            Sign-ups brought by <b className="text-ink">{rows[0]?.referrer ?? "this entrant"}</b>.{" "}
            <Link href={`/admin/challenges/${c.id}/signups`} className="underline">
              Show everyone
            </Link>
          </>
        ) : (
          "Every sign-up credited to an entrant during the challenge."
        )}{" "}
        {rows.length} in all, {flagged} flagged. A sign-up counts once the new person is verified by the deadline, isn&apos;t flagged or banned, and
        isn&apos;t voided.
      </p>
      {rows.length === 0 ? (
        <p className={`${panel} text-sm text-muted`}>No sign-ups yet.</p>
      ) : (
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 pr-3 font-normal">New user</th>
                {!referrer && <th className="py-1.5 pr-3 font-normal">Brought by</th>}
                <th className="py-1.5 pr-3 font-normal">Joined</th>
                <th className="py-1.5 pr-3 font-normal">Status</th>
                <th className="py-1.5 pr-3 font-normal">Flags</th>
                <th className="py-1.5 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/users/${r.new_user_id}`} className="font-bold underline">
                      {r.nickname}
                    </Link>
                    <span className="block text-xs text-muted">
                      {r.state ?? "–"} · {r.entry_id ? "entry link" : "invite link"}
                    </span>
                  </td>
                  {!referrer && (
                    <td className="py-2 pr-3">
                      <Link href={`/admin/challenges/${c.id}/signups?referrer=${r.referrer_id}`} className="underline">
                        {r.referrer}
                      </Link>
                    </td>
                  )}
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{timeAgo(r.signed_up_at)}</td>
                  <td className="py-2 pr-3">
                    {r.void_reason ? (
                      <span className="text-pink-ink">Voided: {r.void_reason}</span>
                    ) : r.counted ? (
                      <span className="font-bold text-lime-ink">Counted</span>
                    ) : (
                      <span className="text-muted">{r.verification_status === "verified" ? "Verified, not counted" : `Not verified (${r.verification_status})`}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-pink-ink">{r.flags.join(" · ")}</td>
                  <td className="py-2">
                    <form action={voidSignup} className="flex gap-1.5">
                      <input type="hidden" name="challenge_id" value={c.id} />
                      <input type="hidden" name="signup_id" value={r.id} />
                      {referrer && <input type="hidden" name="referrer" value={referrer} />}
                      {r.void_reason ? (
                        <>
                          <input type="hidden" name="restore" value="1" />
                          <button className={btn}>Restore</button>
                        </>
                      ) : (
                        <>
                          <input name="reason" placeholder="Reason" maxLength={200} className={`${input} h-8 w-32 text-xs`} />
                          <button className={btn}>Void</button>
                        </>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
