import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getGuideStateFresh } from "@/lib/pcm-guide";
import GuideEditor from "./GuideEditor";

export const metadata: Metadata = { title: "PCM Guide" };

const EVENTS = [
  ["checklist_open", "Opened the checklist"],
  ["checklist_questions_done", "Answered the 6 questions"],
  ["checklist_step_ticked", "Ticked a step"],
  ["checklist_fix_used", "Used the fix-it guide"],
  ["checklist_share", "Shared"],
] as const;

/** The NYSC checklist (/nysc-checklist): edit the guide, switch it on or off, see how it's used. */
export default async function AdminPcmGuidePage() {
  await requireAdmin();
  const [state, rows] = await Promise.all([
    getGuideStateFresh(),
    sql<{ name: string; d7: number; d30: number }[]>`
      SELECT name, count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS d7, count(*)::int AS d30
      FROM events WHERE name IN ${sql(EVENTS.map((e) => e[0]))} AND created_at > now() - interval '30 days'
      GROUP BY name
    `,
  ]);
  const byName = new Map(rows.map((r) => [r.name, r]));
  return (
    <>
      <p className="text-sm text-muted">
        The guide behind{" "}
        <a href="/nysc-checklist" target="_blank" className="underline">
          /nysc-checklist
        </a>{" "}
        and the PCM card on Home. Changes go live when you save.
      </p>
      <GuideEditor
        initial={state.guide}
        version={state.version}
        isDefault={state.isDefault}
        savedValid={state.savedValid}
        settings={{ enabled: state.enabled, whatsapp: state.supportWhatsapp ?? "", email: state.supportEmail ?? "" }}
        numbers={EVENTS.map(([name, label]) => ({ name: label, d7: byName.get(name)?.d7 ?? 0, d30: byName.get(name)?.d30 ?? 0 }))}
      />
    </>
  );
}
