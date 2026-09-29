import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getPublicStats } from "@/lib/stats";
import { stateSlug } from "@/lib/states";
import { formatNumber } from "@/lib/util";
import StateList from "./StateList";

export const metadata: Metadata = { title: "Corpers" };

export default async function CorpersPage() {
  const user = await requireUser();
  const stats = await getPublicStats();
  const rows = stats.states.map((s) => ({ ...s, slug: stateSlug(s.state) }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="h-display text-[28px]">Corpers</h1>
        <p className="text-[15px] text-muted">
          <span className="font-bold text-lime-ink">{formatNumber(stats.total)}</span> joined across {stats.activeStates}{" "}
          {stats.activeStates === 1 ? "state" : "states"}
        </p>
      </div>
      <StateList rows={rows} myState={user.state} />
    </>
  );
}
