import { getCurrentUser } from "@/lib/session";
import { track } from "@/lib/stats";

const ALLOWED = new Set([
  "share_clicked",
  // NYSC checklist (/nysc-checklist). Only a step or section slug, never personal details.
  "checklist_open",
  "checklist_questions_done",
  "checklist_step_ticked",
  "checklist_fix_used",
  "checklist_share",
  // People: tapping "Chat on WhatsApp" (the number itself is never sent).
  "wa_open",
]);

/** Small analytics endpoint for events that happen in the browser. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; meta?: Record<string, unknown> };
    if (!body.name || !ALLOWED.has(body.name)) return new Response(null, { status: 204 });
    const user = await getCurrentUser();
    const channel = typeof body.meta?.channel === "string" ? body.meta.channel.slice(0, 20) : undefined;
    const slug = typeof body.meta?.slug === "string" && /^[a-z0-9-]{1,40}$/.test(body.meta.slug) ? body.meta.slug : undefined;
    const meta = channel || slug ? { ...(channel ? { channel } : {}), ...(slug ? { slug } : {}) } : undefined;
    await track(body.name, user?.id ?? null, meta);
  } catch {}
  return new Response(null, { status: 204 });
}
