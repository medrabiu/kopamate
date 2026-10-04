import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getBusinessByOwner } from "@/lib/hustle/data";
import { catchUp, getPlanContext } from "@/lib/hustle/day";
import { getHustleSettings } from "@/lib/hustle/settings";
import { LazyPlanScene } from "@/components/hustle/scene/lazy";
import { requireUser } from "@/lib/session";
import { getNeeds } from "@/lib/hustle/needs";
import { getHustleUiMode } from "@/lib/hustle/ui-mode";
import { SKY, timeOfDay } from "@/components/hustle/scene/Person";
import { familyFor } from "@/components/hustle/scene/ShopStage";
import PlanForm from "./PlanForm";


export const metadata: Metadata = { title: "Plan today" };

export default async function PlanPage() {
  const user = await requireUser();
  const mine = await getBusinessByOwner(sql, user.id);
  if (!mine) redirect("/hustle");
  await catchUp(mine.id);
  const b = (await getBusinessByOwner(sql, user.id))!;
  const [ctx, s, ui, { needs }] = await Promise.all([getPlanContext(b), getHustleSettings(), getHustleUiMode(user), getNeeds(sql, user.id)]);
  if (ctx.alreadyOpen) redirect(`/hustle/day/${ctx.date}`);
  const t = ctx.type;
  if (ui.view === "graphical") {
    const tod = timeOfDay();
    return (
      <LazyPlanScene
        p={{
          userId: user.id,
          name: b.name,
          color: b.color,
          icon: b.icon,
          family: familyFor(t.slug),
          category: t.category,
          sky: SKY[tod],
          night: tod === "night",
          hair: needs.find((n) => n.key === "grooming")?.state === "overdue" ? "messy" : "neat",
          dayNo: ctx.dayNo,
          cash: b.cash,
          unit: t.unit_name,
          kind: t.kind,
          perishable: t.perishable,
          capacity: ctx.capacity,
          min: ctx.bounds.min,
          max: ctx.bounds.max,
          step: ctx.step,
          refPrice: ctx.refPrice,
          base: ctx.base,
          rivalsWeight: ctx.rivalsWeight,
          rivalLow: ctx.rivalLow,
          rivalHigh: ctx.rivalHigh,
          card: ctx.card,
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
          results: {
            unit_name: t.unit_name,
            kind: t.kind,
            perishable: t.perishable,
            slots: t.slots,
            rent_per_day: t.rent_per_day,
            upkeep_per_day: t.upkeep_per_day,
            marketing_per_day: t.marketing_per_day,
          },
        }}
      />
    );
  }
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
