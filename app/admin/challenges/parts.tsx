import { getChallengeById } from "@/lib/challenges";
import { notFound } from "next/navigation";

const MESSAGES: Record<string, [string, boolean?]> = {
  created: ["Challenge created as a draft. Fill in the settings below."],
  saved: ["Saved."],
  invalid: ["That didn't look right. Nothing was changed.", true],
  taken: ["That slug is already used.", true],
  dates: ["Open and upcoming challenges need an opening and closing date, and closing must be after opening.", true],
  links: ["Social links must start with https://.", true],
  split: ["Prize split: each prize needs a key and a label, and the percentages must add up to 100.", true],
  numbers: ["Check the numbers: whole numbers only, and the cap can't be below the base pool.", true],
  none: ["Nothing selected.", true],
  reason: ["Add a reason when rejecting. The entrant sees it.", true],
  entries_approved: ["Approved. The entrants were told."],
  entries_rejected: ["Rejected. The entrants were told why."],
  entries_disqualified: ["Disqualified."],
  entries_pending: ["Moved back to pending."],
  metrics: ["Post stats saved."],
  voided: ["Sign-up voided."],
  restored: ["Sign-up restored."],
  checked: ["Follow check saved."],
  winners_saved: ["Winners saved. Publish when you're ready."],
  duplicate: ["One prize per person: the same person was picked twice.", true],
  ineligible: ["Winners need an approved entry and must not have failed the follow check.", true],
  locked: ["Winners are already published. They can't be changed.", true],
  not_closed: ["Set the challenge to Closed before publishing winners.", true],
  no_winners: ["Pick and save winners first.", true],
  published: ["Published 🎉 Rewards were created and winners were told."],
};

export function Notice({ msg }: { msg?: string }) {
  const m = msg ? MESSAGES[msg] : undefined;
  if (!m) return null;
  return (
    <p role={m[1] ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${m[1] ? "border-pink" : "border-lime"}`}>
      {m[0]}
    </p>
  );
}

export async function challengeOr404(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? await getChallengeById(id) : null;
  if (!c) notFound();
  return c;
}

/** A Date as the value of a datetime-local field, in Lagos time (UTC+1). */
export function lagosInput(d: Date | null) {
  return d ? new Date(d.getTime() + 3_600_000).toISOString().slice(0, 16) : "";
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  open: "Open",
  closed: "Closed",
  results: "Results",
};
