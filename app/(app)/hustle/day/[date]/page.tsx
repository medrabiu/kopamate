import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "@/components/icons";
import { sql } from "@/lib/db";
import { getDay } from "@/lib/hustle/business";
import { dayNumber, getBusinessByOwner, getType } from "@/lib/hustle/data";
import { catchUp } from "@/lib/hustle/day";
import DayResults from "@/components/hustle/DayResults";
import { requireUser } from "@/lib/session";
import { lagosDate } from "@/lib/util";

export const metadata: Metadata = { title: "Day results" };

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const user = await requireUser();
  const mine = await getBusinessByOwner(sql, user.id);
  if (!mine) redirect("/hustle");
  await catchUp(mine.id);
  const [b, d] = await Promise.all([getBusinessByOwner(sql, user.id), getDay(sql, mine.id, date)]);
  const t = (await getType(sql, b!.type_slug))!;
  const today = lagosDate();
  if (!d) {
    if (date === today) redirect("/hustle/plan");
    notFound();
  }

  const live = !d.closed;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/hustle" aria-label="Back to my business" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line">
          <ChevronLeft size={20} />
        </Link>
        <span className="text-xs font-bold tracking-[0.1em] text-muted">
          DAY {dayNumber(b!, date)} {live ? "SO FAR" : "RESULTS"} · {b!.name.toUpperCase()}
        </span>
      </div>
      <DayResults d={d} t={t} rating={b!.rating} />
      <Link href="/hustle" className="btn-primary">
        {live ? "Done for now" : "Back to my business"}
      </Link>
    </div>
  );
}
