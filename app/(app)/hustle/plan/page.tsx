import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getBusinessByOwner } from "@/lib/hustle/data";
import { catchUp, getPlanContext } from "@/lib/hustle/day";
import { getHustleSettings } from "@/lib/hustle/settings";
import { requireUser } from "@/lib/session";
import PlanForm from "./PlanForm";

export const metadata: Metadata = { title: "Plan today" };

export default async function PlanPage() {
  const user = await requireUser();
  const mine = await getBusinessByOwner(sql, user.id);
  if (!mine) redirect("/hustle");
  await catchUp(mine.id);
  const b = (await getBusinessByOwner(sql, user.id))!;
  const [ctx, s] = await Promise.all([getPlanContext(b), getHustleSettings()]);
  if (ctx.alreadyOpen) redirect(`/hustle/day/${ctx.date}`);
  const t = ctx.type;
  return (
    <PlanForm
      p={{
        name: b.name,
        state: b.state,
        cash: b.cash,
        dayNo: ctx.dayNo,
        unit: t.unit_name,
        kind: t.kind,
        perishable: t.perishable,
        slots: t.slots,
        capacity: ctx.capacity,
        min: ctx.bounds.min,
        max: ctx.bounds.max,
        step: ctx.step,
        refPrice: ctx.refPrice,
        base: ctx.base,
        rivalsWeight: ctx.rivalsWeight,
        rivalCount: ctx.rivalCount,
        rivalLow: ctx.rivalLow,
        rivalHigh: ctx.rivalHigh,
        card: ctx.card,
        events: ctx.events,
        supplyName: ctx.supplyName,
        inventoryLots: ctx.inventoryLots,
        stockLotCost: ctx.stockLotCost,
        suppliers: ctx.suppliers,
        upl: ctx.upl,
        normalLot: ctx.normalLot,
        backupLot: ctx.backupLot,
        running: ctx.running,
        fixed: ctx.fixed,
        salvagePct: s.salvagePct,
        modLabels: ctx.modLabels,
      }}
    />
  );
}
