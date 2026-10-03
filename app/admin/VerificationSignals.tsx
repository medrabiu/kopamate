import Link from "next/link";
import { getSignals } from "@/lib/verification-signals";
import { MAX_VERIFICATION_ATTEMPTS } from "@/lib/verification";
import { formatJoined } from "@/lib/util";

const ACTION_LABEL: Record<string, string> = {
  requested: "Sent",
  approved: "Approved",
  rejected: "Rejected",
  rejected_blocked: "Rejected, code blocked",
  revoked: "Verification removed",
  reset: "Allowed another try",
};

/** Warnings beside a verification request: duplicate photos, names, networks and suspicious codes. */
export default async function VerificationSignals({ userId }: { userId: string }) {
  const s = await getSignals(userId);
  if (!s) return null;

  const warnings: React.ReactNode[] = [];
  const who = (list: { id: string; nickname: string; status?: string }[]) =>
    list.map((o, i) => (
      <span key={o.id}>
        {i > 0 && ", "}
        <Link href={`/admin/users/${o.id}`} className="underline">
          {o.nickname}
        </Link>
        {o.status && o.status !== "none" ? ` (${o.status})` : ""}
      </span>
    ));

  if (s.codeBlocked) warnings.push(<>This state code is <b>blocked</b> as fake.</>);
  if (s.codeProblem) warnings.push(<>State code: {s.codeProblem}</>);
  if (s.photoMatches.length > 0) {
    const exact = s.photoMatches.some((m) => m.exact);
    warnings.push(
      <>
        {exact ? "The same ID photo" : "A near-identical ID photo"} was sent by {who(s.photoMatches)}.
      </>,
    );
  }
  if (s.sameName.length > 0) warnings.push(<>Same full name in the same state: {who(s.sameName)}.</>);
  if (s.networkReferrals.length > 0) {
    warnings.push(<>Invited by or invited accounts from the same network: {who(s.networkReferrals)}.</>);
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-pink px-2.5 py-2">
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No duplicate photo, name or code found.</p>
      )}
      <p className="text-muted">
        Same network: {s.network.total} other {s.network.total === 1 ? "account" : "accounts"}
        {s.network.total > 0 && ` (${s.network.verified} verified, ${s.network.pending} pending)`} · Tries used {s.attempts} of{" "}
        {MAX_VERIFICATION_ATTEMPTS}
      </p>
      {s.history.length > 0 && (
        <details className="text-muted">
          <summary className="cursor-pointer">History ({s.history.length})</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {s.history.map((h, i) => (
              <li key={i}>
                {formatJoined(h.created_at)} · {ACTION_LABEL[h.action] ?? h.action}
                {h.state_code ? ` · ${h.state_code}` : ""}
                {h.note ? ` · "${h.note}"` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
