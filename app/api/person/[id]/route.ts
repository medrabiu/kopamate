import { getCurrentUser } from "@/lib/session";
import { getPublicProfile } from "@/lib/people";

export const dynamic = "force-dynamic";

/** Public profile for the tap-an-avatar sheet. Signed-in users only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer?.completed_at) return Response.json({ error: "Sign in" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const profile = await getPublicProfile(id);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(profile, { headers: { "Cache-Control": "private, max-age=60" } });
}
