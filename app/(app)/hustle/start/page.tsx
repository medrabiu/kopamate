import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { typesInState } from "@/lib/hustle/business";
import { getBusinessByOwner } from "@/lib/hustle/data";
import { getHustleSettings } from "@/lib/hustle/settings";
import { requireUser } from "@/lib/session";
import StartFlow from "./StartFlow";

export const metadata: Metadata = { title: "Start your hustle" };

export default async function StartPage() {
  const user = await requireUser();
  if (!user.state) redirect("/hustle");
  if (await getBusinessByOwner(sql, user.id)) redirect("/hustle");
  const [types, s] = await Promise.all([typesInState(user.state), getHustleSettings()]);
  return (
    <StartFlow
      state={user.state}
      grant={s.grant}
      types={types
        .filter((t) => t.setup_cost <= s.grant)
        .map((t) => ({ slug: t.slug, name: t.name, blurb: t.blurb, category: t.category, setup: t.setup_cost, count: t.count, hot: t.hot, busy: t.busy }))}
    />
  );
}
