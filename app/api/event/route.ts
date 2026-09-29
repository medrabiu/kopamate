import { getCurrentUser } from "@/lib/session";
import { track } from "@/lib/stats";

const ALLOWED = new Set(["share_clicked"]);

/** Small analytics endpoint for events that happen in the browser. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; meta?: Record<string, unknown> };
    if (!body.name || !ALLOWED.has(body.name)) return new Response(null, { status: 204 });
    const user = await getCurrentUser();
    const channel = typeof body.meta?.channel === "string" ? body.meta.channel.slice(0, 20) : undefined;
    await track(body.name, user?.id ?? null, channel ? { channel } : undefined);
  } catch {}
  return new Response(null, { status: 204 });
}
