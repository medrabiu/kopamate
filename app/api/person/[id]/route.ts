import { hustleEnabledFor } from "@/lib/hustle/access";
import { getPublicBusiness } from "@/lib/hustle/market";
import { getCurrentUser } from "@/lib/session";
import { getFollowList, getPublicProfile } from "@/lib/people";

export const dynamic = "force-dynamic";

/**
 * Public profile for the tap-an-avatar sheet, or with ?list=followers|following, that list.
 * Signed-in users only; never cached, since follow state changes with every tap.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer?.completed_at) return Response.json({ error: "Sign in" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const headers = { "Cache-Control": "private, no-store" };

  const list = new URL(req.url).searchParams.get("list");
  if (list === "followers" || list === "following") {
    return Response.json(await getFollowList(id, list), { headers });
  }
  const profile = await getPublicProfile(id, viewer.id);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });
  // Their My Hustle business, for viewers who have My Hustle (it's behind a feature flag).
  const business = (await hustleEnabledFor(viewer)) ? await getPublicBusiness(id) : null;
  return Response.json({ ...profile, business }, { headers });
}
