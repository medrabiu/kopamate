import { revalidatePath } from "next/cache";
import { fetchOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily (06:00 Lagos via vercel.json): pulls new opportunities from the RSS feeds in lib/opportunities.ts. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await fetchOpportunities();
  revalidatePath("/opportunities");
  revalidatePath("/home");
  return Response.json({ ok: true, ...result });
}
