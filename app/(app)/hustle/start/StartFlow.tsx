"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { startHustle, type StartState } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import { BizGlyph, BizLogo } from "@/components/hustle/BizArt";
import { ChevronLeft } from "@/components/icons";
import { BIZ_COLORS, BIZ_ICONS, CATEGORY_LABEL, naira, TYPE_ICON } from "@/lib/hustle/types";

type T = { slug: string; name: string; blurb: string; category: "food" | "services" | "supply"; setup: number; count: number; hot: boolean; busy: boolean };

const CHIPS = [
  { key: "all", label: "All" },
  { key: "food", label: CATEGORY_LABEL.food },
  { key: "services", label: CATEGORY_LABEL.services },
  { key: "supply", label: CATEGORY_LABEL.supply },
] as const;

function Opportunity({ state, types }: { state: string; types: T[] }) {
  const none = types.filter((t) => t.count === 0);
  const pick = (none.length >= 2 ? none : types.filter((t) => t.hot)).slice(0, 2);
  if (!pick.length) return null;
  const names = pick.map((t) => t.name).join(" and ");
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-lime/60 bg-lime/10 p-3.5">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="shrink-0 text-lime-ink">
        <path d="M4 17 10 11 14 15 20 8M15 8h5v5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold tracking-[0.08em] text-lime-ink">OPPORTUNITY IN {state.toUpperCase()}</span>
        <span className="text-sm leading-snug">
          {names}: {none.length >= 2 ? "nobody runs one here yet" : "hardly anyone runs one here"}. New ones get about 20% more customers for their first
          2 weeks.
        </span>
      </div>
    </div>
  );
}

export default function StartFlow({ state, grant, types }: { state: string; grant: number; types: T[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [cat, setCat] = useState<(typeof CHIPS)[number]["key"]>("all");
  const [type, setType] = useState<T | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>("star");
  const [color, setColor] = useState<string>(BIZ_COLORS[0]);
  const [state2, action, pending] = useActionState<StartState, FormData>(startHustle, {});

  useEffect(() => {
    if (state2.slug) router.replace("/hustle");
  }, [state2.slug, router]);

  const shown = types
    .filter((t) => cat === "all" || t.category === cat)
    .sort((a, b) => Number(b.hot) - Number(a.hot) || Number(a.busy) - Number(b.busy));

  if (step === 1) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-[0.1em] text-lime-ink">STEP 1 OF 2</span>
          <h1 className="h-display text-[30px] leading-tight">Start your hustle</h1>
          <p className="text-[15px] leading-snug text-muted">
            Pick a business. You get <strong className="text-ink">{naira(grant)} startup money</strong>. Setup comes out of it, and the rest is your
            working cash.
          </p>
        </div>
        <Opportunity state={state} types={types} />
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Filter">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={cat === c.key}
              onClick={() => setCat(c.key)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${cat === c.key ? "bg-lime text-on-accent" : "border border-line text-ink"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {shown.map((t) => {
            const selected = type?.slug === t.slug;
            return (
              <button
                key={t.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setType(t);
                  setIcon(TYPE_ICON[t.slug] ?? "star");
                }}
                className={`flex flex-col gap-1 rounded-[18px] border-2 bg-surface-2 p-3.5 text-left ${
                  selected ? "border-lime" : t.hot ? "border-lime/40" : "border-transparent"
                }`}
              >
                <span
                  className={`text-[11px] font-bold tracking-[0.06em] ${t.hot ? "text-lime-ink" : t.busy ? "text-amber-ink" : "text-muted"}`}
                >
                  {t.hot ? `HOT IN ${state.toUpperCase()}` : t.busy ? `BUSY · ${t.count} IN ${state.toUpperCase()}` : `${t.count} IN ${state.toUpperCase()}`}
                </span>
                <span className="text-base font-bold leading-tight">{t.name}</span>
                <span className="text-xs text-muted">{t.blurb}</span>
                <span className="mt-auto pt-1 text-[13px] font-bold">Setup {naira(t.setup)}</span>
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-bg via-bg to-transparent px-5 pb-1 pt-4">
          <button type="button" className="btn-primary" disabled={!type} onClick={() => setStep(2)}>
            {type ? `Next: name your ${type.name.toLowerCase()}` : "Pick a business"}
          </button>
        </div>
      </div>
    );
  }

  const t = type!;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="type" value={t.slug} />
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="color" value={color} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setStep(1)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full border border-line">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-[0.1em] text-lime-ink">STEP 2 OF 2</span>
          <h1 className="h-display text-2xl leading-tight">Name your {t.name.toLowerCase()}</h1>
        </div>
      </div>

      <div className="card flex items-center gap-3">
        <BizLogo icon={icon} color={color} size={56} />
        <div className="min-w-0">
          <p className="h-display truncate text-xl">{name.trim() || "Your business"}</p>
          <p className="text-[13px] text-muted">
            {t.name} · {state} · Stage 1
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="biz-name" className="label">
          Business name
        </label>
        <input
          id="biz-name"
          name="name"
          required
          minLength={3}
          maxLength={30}
          placeholder={t.category === "food" ? "Ada's Kitchen" : t.category === "supply" ? "Musa's Farm" : "Tunde's Cuts"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
          autoComplete="off"
        />
        <p className="text-[13px] text-faint">Your own name, not a real brand. Everyone in {state} will see it.</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Logo</legend>
        <div className="grid grid-cols-6 gap-2">
          {BIZ_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              aria-label={i}
              aria-pressed={icon === i}
              onClick={() => setIcon(i)}
              className={`flex aspect-square items-center justify-center rounded-2xl border-2 ${icon === i ? "border-lime" : "border-line"}`}
            >
              <BizGlyph icon={i} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {BIZ_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`h-10 w-10 rounded-full ${color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-4 text-sm">
        <div className="flex justify-between">
          <span>Startup money</span>
          <span className="tabular-nums">{naira(grant)}</span>
        </div>
        <div className="flex justify-between">
          <span>Setup ({t.name.toLowerCase()})</span>
          <span className="tabular-nums">−{naira(t.setup)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 font-bold">
          <span>Working cash to start</span>
          <span className="tabular-nums text-lime-ink">{naira(grant - t.setup)}</span>
        </div>
      </div>

      <FormError message={state2.error} />
      <button type="submit" className="btn-primary" disabled={pending || name.trim().length < 3}>
        {pending ? "Setting up…" : `Start ${name.trim() || "my business"}`}
      </button>
      <p className="text-center text-[13px] text-faint">
        Game money only. It can&apos;t be withdrawn, bought or sold. <Link href="/hustle" className="underline">Not now</Link>
      </p>
    </form>
  );
}
