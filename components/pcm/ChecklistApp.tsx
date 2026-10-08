"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Sheet from "../Sheet";
import { CheckIcon, ChevronDown, ChevronRight } from "../icons";
import Ring from "./Ring";
import RichText from "./RichText";
import { loadMyPlan, mergeDevicePlan, savePlan } from "@/app/actions/pcm";
import { QUESTIONS, type Answers, type FixDocument, type Guide, type PackItem, type Step } from "@/content/pcm-guide";
import {
  anchorTarget,
  DRAFT_KEY,
  answeredAll,
  applyAnswers,
  emptyPlan,
  FIX_DOCUMENTS,
  FIX_FIELDS,
  fillLetter,
  guideProblems,
  readiness,
  reportLink,
  resolveFixPath,
  sanitizePlan,
  stepDone,
  tickKey,
  toggleTick,
  visibleDocuments,
  visibleSteps,
  visiblePacking,
  visibleSituations,
  type Plan,
} from "@/lib/pcm-rules";

const DEVICE_KEY = "km_pcm_plan";

type Props = {
  guide: Guide;
  contact: { whatsapp: string | null; email: string | null };
  appUrl: string;
};

/**
 * Who's looking. The page is the same for everyone (cached), so this loads after it: signed-in people get their
 * saved plan, visitors keep theirs on the device. `preview`: an admin opened ?preview=1 (the editor's draft).
 */
type Account = { signedIn: boolean; inviteCode: string | null; preview: boolean };

type SheetState = { kind: "situation"; slug: string } | { kind: "fix" } | null;

function logEvent(name: string, slug?: string) {
  try {
    void fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, meta: slug ? { slug } : undefined }),
      keepalive: true,
    });
  } catch {}
}

function readDevice(): Plan | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    return raw ? sanitizePlan(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeDevice(plan: Plan | null) {
  try {
    if (plan) localStorage.setItem(DEVICE_KEY, JSON.stringify(plan));
    else localStorage.removeItem(DEVICE_KEY);
  } catch {}
}

/** Answers in the summary row: yes/no answers need words of their own to make sense out of context. */
const SUMMARY: Record<string, Record<string, string>> = {
  married: { yes: "Married woman", no: "Not a married woman" },
  over30: { yes: "30+ at graduation", no: "Under 30 at graduation" },
  health: { yes: "Health condition", no: "No health condition", skip: "Health: rather not say" },
};

const REVIEWED = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function TickBox({ on }: { on: boolean }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-lg ${on ? "bg-lime text-on-accent" : "border-2 border-line"}`}
      aria-hidden="true"
    >
      {on && <CheckIcon size={14} strokeWidth={3.2} />}
    </span>
  );
}

function ReportLink({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pcm-noprint underline">
      Report wrong info
    </a>
  );
}

export default function ChecklistApp({ guide: savedGuide, contact, appUrl }: Props) {
  const [account, setAccount] = useState<Account>({ signedIn: false, inviteCode: null, preview: false });
  const { signedIn: loggedIn, inviteCode, preview } = account;
  const [guide, setGuide] = useState(savedGuide);
  const [plan, setPlan] = useState<Plan>(emptyPlan());
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<Answers>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<SheetState>(null);
  const [packTab, setPackTab] = useState<"docs" | "packing">("docs");
  const [toast, setToast] = useState("");
  const [saveError, setSaveError] = useState<{ message: string; pending: Plan } | null>(null);
  const committed = useRef<Plan>(plan);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushedSheet = useRef(false);
  // The open sheet, for close events that arrive after another sheet has replaced it.
  const sheetRef = useRef<SheetState>(null);
  sheetRef.current = sheet;

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? "" : t)), 2600);
  }, []);

  // ---------- Saving ----------
  const persist = useCallback(
    (next: Plan) => {
      if (preview) return;
      if (!loggedIn) {
        writeDevice(next);
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const res = await savePlan(next).catch(() => ({ ok: false as const, error: "Couldn't save. Check your connection." }));
        if (res.ok) {
          committed.current = res.plan;
          setSaveError(null);
        } else {
          // Undo on screen what didn't save, and offer to try again.
          setPlan(committed.current);
          setSaveError({ message: res.error, pending: next });
        }
      }, 1000);
    },
    [loggedIn, preview],
  );

  const update = useCallback(
    (fn: (p: Plan) => Plan) => {
      setPlan((p) => {
        const next = fn(p);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // ---------- First load: who's looking, their progress (merging device progress in), the admin draft ----------
  useEffect(() => {
    logEvent("checklist_open");
    let cancelled = false;
    const device = readDevice();
    const useDevice = () => {
      if (device) {
        setPlan(device);
        setDraftAnswers(device.answers);
      }
    };
    loadMyPlan()
      .catch(() => ({ signedIn: false as const }))
      .then(async (me) => {
        if (cancelled) return;
        if (!me.signedIn) {
          useDevice();
          setHydrated(true);
          return;
        }
        const preview = me.admin && new URLSearchParams(location.search).get("preview") === "1";
        setAccount({ signedIn: true, inviteCode: me.inviteCode, preview });
        document.documentElement.dataset.signedIn = "1";
        if (preview) {
          try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
            if (draft && guideProblems(draft).length === 0) setGuide(draft);
          } catch {}
        }
        let mine = me.plan;
        if (device && !preview) {
          // Progress from before they signed up or logged in moves into the account, once.
          const res = await mergeDevicePlan(device).catch(() => null);
          if (res?.ok) {
            mine = res.plan;
            writeDevice(null);
          }
        }
        if (cancelled) return;
        setPlan(mine);
        setDraftAnswers(mine.answers);
        committed.current = mine;
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openAnchor = useCallback(
    (hash: string, scroll = true) => {
      const a = anchorTarget(guide, hash);
      if (!a) return;
      if (a.kind === "step") {
        setOpen((o) => ({ ...o, [a.slug]: true }));
        if (scroll) setTimeout(() => document.getElementById(a.slug)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else {
        setSheet(a.kind === "fix" ? { kind: "fix" } : { kind: "situation", slug: a.slug });
      }
    },
    [guide],
  );

  useEffect(() => {
    if (location.hash) openAnchor(location.hash);
    const onHash = () => openAnchor(location.hash);
    // The back gesture closes an open sheet.
    const onPop = () => {
      if (pushedSheet.current) {
        pushedSheet.current = false;
        setSheet(null);
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onPop);
    };
  }, [openAnchor]);

  function openSheet(s: Exclude<SheetState, null>) {
    setSheet(s);
    try {
      history.pushState({ pcmSheet: true }, "", `#${s.kind === "fix" ? "fix" : s.slug}`);
      pushedSheet.current = true;
    } catch {}
  }
  /** Closes the sheet of this kind, only if it's still the one open (switching sheets fires a late close). */
  function closeSheet(kind: "situation" | "fix") {
    if (sheetRef.current?.kind !== kind) return;
    setSheet(null);
    if (pushedSheet.current) {
      pushedSheet.current = false;
      history.back();
    }
  }

  // ---------- Derived ----------
  const answers = plan.answers;
  const answered = answeredAll(answers);
  const showQuestions = !answered || editing;
  const r = useMemo(() => readiness(guide, plan), [guide, plan]);
  // Before answering: the steps for everyone. After: the ones that apply.
  const steps = useMemo(
    () => (answered ? visibleSteps(guide, answers) : guide.steps.filter((s) => s.show && Object.keys(s.conditions).length === 0)),
    [guide, answers, answered],
  );
  const situations = useMemo(() => visibleSituations(guide, answers), [guide, answers]);
  const docs = useMemo(() => visibleDocuments(guide, answers), [guide, answers]);
  const packing = useMemo(() => visiblePacking(guide, answers), [guide, answers]);
  const docsDone = docs.filter((d) => plan.ticks[tickKey.doc(d.slug)]).length;
  const packDone = packing.filter((d) => plan.ticks[tickKey.pack(d.slug)]).length;
  const tipsFor = (slug: string) => guide.tips.filter((t) => t.stepSlug === slug);
  const fixOpen = plan.fixAdded && !plan.ticks[tickKey.fix];
  const report = (section: string) => reportLink(contact, section);
  const reviewed = (() => {
    const d = new Date(`${guide.lastReviewed}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? guide.lastReviewed : REVIEWED.format(d);
  })();

  function buildPlan() {
    if (!answeredAll(draftAnswers)) {
      flash("Answer all six questions first");
      return;
    }
    const first = !answered;
    update((p) => applyAnswers(p, draftAnswers));
    setEditing(false);
    if (first) logEvent("checklist_questions_done");
    setTimeout(() => document.getElementById("my-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function goToStep(s: Step) {
    if (s.opens !== "step") {
      setPackTab(s.opens === "camp_docs" ? "docs" : "packing");
      document.getElementById("camp-pack")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setOpen((o) => ({ ...o, [s.slug]: true }));
    setTimeout(() => document.getElementById(s.slug)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function tickStep(s: Step, on: boolean) {
    update((p) => toggleTick(p, tickKey.step(s.slug), on));
    if (on) {
      logEvent("checklist_step_ticked", s.slug);
      flash(`Nice! ${s.title} is done.`);
      setOpen((o) => ({ ...o, [s.slug]: false }));
    }
  }

  function tickPack(kind: "doc" | "pack", item: PackItem, list: PackItem[], on: boolean) {
    const key = kind === "doc" ? tickKey.doc(item.slug) : tickKey.pack(item.slug);
    const next = toggleTick(plan, key, on);
    setPlan(next);
    persist(next);
    // Ticking the last item completes the Camp Pack step.
    if (on && list.every((i) => next.ticks[kind === "doc" ? tickKey.doc(i.slug) : tickKey.pack(i.slug)])) {
      flash(kind === "doc" ? "All documents ready. Step done!" : "Packed and ready!");
      const s = guide.steps.find((x) => x.opens === (kind === "doc" ? "camp_docs" : "camp_packing"));
      if (s) logEvent("checklist_step_ticked", s.slug);
    }
  }

  async function share() {
    const target = new URL("/nysc-checklist", appUrl);
    if (inviteCode) target.searchParams.set("ref", inviteCode);
    const url = target.toString();
    const text =
      r.pct === 100 && answered
        ? `I'm Camp Ready ✅ ${guide.batchLabel}. Get your free personal NYSC checklist on Kopamate:`
        : "Getting ready for NYSC? Build your free personal checklist on Kopamate:";
    logEvent("checklist_share");
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
    } catch {
      return; // cancelled
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      flash("Link copied. Paste it in your WhatsApp Status.");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
    }
  }

  const sheetSituation = sheet?.kind === "situation" ? guide.situations.find((s) => s.slug === sheet.slug) : null;

  return (
    <div className="flex flex-col gap-8">
      {preview && (
        <p className="pcm-noprint rounded-2xl border border-pink px-4 py-3 text-sm">
          <b>Preview.</b> You&apos;re seeing the unsaved draft from the editor. Ticks here aren&apos;t saved.
        </p>
      )}

      {/* Header */}
      <header className="pcm-noprint flex flex-col gap-2">
        <span className="self-start rounded-full border border-line px-3 py-1 text-xs font-bold tracking-wide text-muted uppercase">{guide.batchLabel}</span>
        <h1 className="h-display text-[32px] leading-[1.1]">NYSC checklist: get camp-ready</h1>
        <p className="text-[16px] leading-relaxed text-muted">
          Waiting for call-up? Answer 6 quick questions and get a personal plan: the steps, the documents and the packing list that apply to you.
        </p>
      </header>

      {!loggedIn && !preview && (
        <p className="pcm-noprint flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
          <span>Your progress is saved on this phone only.</span>
          <Link href="/join" className="font-bold text-lime-ink">
            Sign up to save your progress ›
          </Link>
        </p>
      )}

      {/* Questions, or a summary of the answers */}
      {/* The questions render straight away (no placeholder that jumps); a returning person's summary replaces them once their answers load. */}
      <section id="questions" className="pcm-noprint scroll-mt-20" aria-labelledby="questions-title">
        {showQuestions || !hydrated ? (
          <div className="card flex flex-col gap-5">
            <div>
              <span className="text-xs font-bold tracking-wide text-lime-ink uppercase">30 seconds</span>
              <h2 id="questions-title" className="h-display text-[22px]">
                Let&apos;s build your NYSC plan
              </h2>
              <p className="text-sm text-muted">Tap your answers. We&apos;ll only show the steps and documents that apply to you.</p>
            </div>
            {QUESTIONS.map((q) => (
              <fieldset key={q.key} className="flex flex-col gap-2">
                <legend className="mb-2 text-[15px] font-bold">{q.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => {
                    const on = draftAnswers[q.key] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraftAnswers((a) => ({ ...a, [q.key]: o.value }))}
                        className={`h-11 rounded-full border px-4 text-sm font-bold ${on ? "border-lime bg-lime text-on-accent" : "border-line bg-surface-2"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              onClick={buildPlan}
              className={`btn-primary ${answeredAll(draftAnswers) ? "" : "!bg-surface-2 !text-faint"}`}
              aria-disabled={!answeredAll(draftAnswers)}
            >
              {answered ? "Update my plan" : "Build my plan"}
            </button>
            <p className="-mt-2 text-center text-xs text-muted">You can change these answers anytime.</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {QUESTIONS.map((q) => (
              <span key={q.key} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted">
                {SUMMARY[q.key]?.[answers[q.key] ?? ""] ?? q.options.find((o) => o.value === answers[q.key])?.label}
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setDraftAnswers(answers);
                setEditing(true);
              }}
              className="px-2 py-1.5 text-sm font-bold text-lime-ink"
            >
              Edit
            </button>
          </div>
        )}
      </section>

      {/* Readiness and next step */}
      {hydrated && answered && (
        <section id="my-plan" className="pcm-noprint flex scroll-mt-20 flex-col gap-4" aria-label="Your readiness">
          <div className="flex items-center gap-5">
            <Ring pct={r.pct}>
              <span className="h-display text-[28px] leading-none">{r.pct}%</span>
              <span className="text-xs text-muted">camp-ready</span>
            </Ring>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">
                {r.done} of {r.total} steps done
              </span>
              <span className="font-bold">
                {r.pct === 100 ? "Everything’s done. See you at camp!" : r.pct >= 50 ? "Over halfway there. Keep going!" : "Let’s take it one step at a time."}
              </span>
            </div>
          </div>
          {r.next ? (
            <div className="flex flex-col gap-2 rounded-3xl bg-lime p-5 text-on-accent">
              <span className="text-xs font-bold tracking-wide uppercase opacity-70">Do this next</span>
              <span className="h-display text-[20px] leading-tight">{r.next.title}</span>
              <span className="text-[15px] opacity-80">{r.next.short}</span>
              <button type="button" onClick={() => goToStep(r.next!)} className="mt-1 h-12 self-start rounded-full bg-on-accent px-7 font-bold text-lime">
                Start
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-3xl bg-lime p-5 text-on-accent">
              <span className="h-display text-[24px]">You&apos;re Camp Ready! ✅</span>
              <span className="text-[15px] opacity-80">Share it and help your classmates get ready too.</span>
              <button type="button" onClick={share} className="mt-1 h-12 self-start rounded-full bg-on-accent px-7 font-bold text-lime">
                Share
              </button>
            </div>
          )}
        </section>
      )}

      {/* Journey */}
      <section className="pcm-noprint flex flex-col gap-3" aria-labelledby="journey-title">
        <h2 id="journey-title" className="h-display text-[24px]">
          {answered ? "My journey" : "The steps to camp"}
        </h2>
        <ol className="flex flex-col gap-2">
          {fixOpen && (
            <li className="flex items-center gap-3 rounded-2xl border border-[#ff8a3d] px-3.5 py-3">
              <button
                type="button"
                onClick={() => update((p) => toggleTick(p, tickKey.fix, true))}
                aria-label="Mark my mismatched details as fixed"
                className="shrink-0"
              >
                <TickBox on={false} />
              </button>
              <button type="button" onClick={() => openSheet({ kind: "fix" })} className="min-w-0 flex-1 text-left">
                <span className="block font-bold">Fix my mismatched details</span>
                <span className="block text-sm text-muted">Do this before registration</span>
              </button>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </li>
          )}
          {steps.map((s, i) => {
            const done = hydrated && answered && stepDone(guide, plan, s);
            const current = hydrated && answered && r.next?.slug === s.slug;
            const isOpen = Boolean(open[s.slug]);
            const tips = tipsFor(s.slug);
            return (
              <li key={s.slug} id={s.slug} className="scroll-mt-20 rounded-2xl border border-line">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`${s.slug}-body`}
                    onClick={() => (s.opens === "step" ? setOpen((o) => ({ ...o, [s.slug]: !isOpen })) : goToStep(s))}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        done ? "bg-lime text-on-accent" : current ? "pcm-pulse border-2 border-lime text-lime-ink" : "border border-line text-muted"
                      }`}
                      aria-hidden="true"
                    >
                      {done ? <CheckIcon size={16} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] font-bold ${done ? "text-muted" : ""}`}>{s.title}</span>
                      <span className="block text-xs text-muted">
                        {done ? "Done" : current ? "Up next" : s.time}
                        {done && <span className="sr-only"> (done)</span>}
                      </span>
                    </span>
                    {s.opens === "step" ? (
                      <ChevronDown size={18} className={`shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-faint" />
                    )}
                  </button>
                </h3>
                <div id={`${s.slug}-body`} className="pcm-collapse flex flex-col gap-4 border-t border-line px-3.5 pt-3.5 pb-4" data-open={isOpen ? "true" : "false"}>
                  <p className="leading-relaxed text-muted">
                    <RichText text={s.what} />
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    {s.cost && <span className="rounded-full bg-surface-2 px-3 py-1.5">💰 {s.cost}</span>}
                    {s.time && <span className="rounded-full bg-surface-2 px-3 py-1.5">⏱ {s.time}</span>}
                  </div>
                  {s.why && (
                    <div className="rounded-2xl border border-lime/50 bg-lime/10 p-3.5">
                      <span className="block text-xs font-bold tracking-wide text-lime-ink uppercase">Why it matters</span>
                      <span className="mt-1 block text-[15px] leading-relaxed">
                        <RichText text={s.why} />
                      </span>
                    </div>
                  )}
                  {s.how.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-bold">How to do it</h4>
                      <ol className="flex flex-col gap-2">
                        {s.how.map((h, n) => (
                          <li key={n} className="flex gap-3 text-[15px] leading-relaxed">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{n + 1}</span>
                            <span>
                              <RichText text={h} />
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {s.bring.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-bold">Bring with you</h4>
                      <ul className="flex flex-col gap-1.5 text-[15px]">
                        {s.bring.map((b, n) => (
                          <li key={n}>📄 <RichText text={b} /></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.mistakes.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-bold">Common mistakes</h4>
                      <ul className="flex flex-col gap-2">
                        {s.mistakes.map((m, n) => (
                          <li key={n} className="rounded-2xl border border-pink/40 bg-pink/10 px-3.5 py-2.5 text-[15px]">
                            ⚠️ <RichText text={m} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {tips.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-bold">From corpers who did it</h4>
                      <ul className="flex flex-col gap-2">
                        {tips.map((t, n) => (
                          <li key={n} className="flex gap-3 rounded-2xl bg-surface-2 p-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line text-sm font-bold">{t.authorLabel.charAt(0)}</span>
                            <span>
                              <span className="block text-xs font-bold text-muted">{t.authorLabel}</span>
                              <span className="block text-[15px]">{t.text}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hydrated && (
                    <button
                      type="button"
                      onClick={() => tickStep(s, !done)}
                      className={`h-12 rounded-full font-bold ${done ? "border border-lime text-lime-ink" : "bg-lime text-on-accent"}`}
                    >
                      {done ? "Done · tap to undo" : "Mark as done"}
                    </button>
                  )}
                  <p className="text-xs text-faint">
                    <a href={`/nysc-checklist/${s.slug}`} className="pcm-noprint font-bold text-lime-ink">
                      Full guide to this step ›
                    </a>{" "}
                    · Last reviewed for {guide.batchLabel} · <ReportLink href={report(s.title)} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Situations */}
      <section className="pcm-noprint flex flex-col gap-3" aria-labelledby="situation-title">
        <h2 id="situation-title" className="h-display text-[24px]">
          My situation
        </h2>
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {[{ slug: "fix", title: "My details don’t match", badge: "≠", tint: "#ff8a3d", subtitle: "Name or date of birth differs across documents" }, ...situations].map(
            (g) => (
              <button
                key={g.slug}
                type="button"
                onClick={() => openSheet(g.slug === "fix" ? { kind: "fix" } : { kind: "situation", slug: g.slug })}
                className={`flex w-[164px] shrink-0 flex-col gap-2 rounded-3xl border p-4 text-left ${g.slug === "fix" ? "border-[#ff8a3d]" : "border-line"}`}
              >
                <span className="grid size-10 place-items-center rounded-xl text-base font-bold text-on-accent" style={{ background: g.tint }} aria-hidden="true">
                  {g.badge}
                </span>
                <span className="font-bold leading-tight">{g.title}</span>
                <span className="text-xs leading-snug text-muted">{g.subtitle}</span>
              </button>
            ),
          )}
        </div>
      </section>

      {/* Without JavaScript (and for search engines): the situation guides in full. */}
      <section className="pcm-nojs flex flex-col gap-4" aria-label="Situation guides">
        {guide.situations
          .filter((s) => s.show)
          .map((s) => (
            <article key={s.slug} className="card flex flex-col gap-2">
              <h3 className="font-bold">
                <a href={`/nysc-checklist/${s.slug}`} className="underline">
                  {s.title}
                </a>
              </h3>
              <p className="text-muted">
                <RichText text={s.intro} />
              </p>
              <ul className="list-disc pl-5 text-[15px]">
                {s.items.map((t, n) => (
                  <li key={n}>
                    <RichText text={t} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
      </section>

      {/* Camp Pack */}
      <section id="camp-pack" className="flex scroll-mt-20 flex-col gap-3" aria-labelledby="pack-title">
        <div className="flex items-end justify-between gap-3">
          <h2 id="pack-title" className="h-display text-[24px]">
            My Camp Pack
          </h2>
          <button type="button" onClick={() => window.print()} className="pcm-noprint py-1 text-sm font-bold text-lime-ink">
            Print
          </button>
        </div>
        <div className="pcm-noprint grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Camp Pack">
          {(
            [
              ["docs", "Documents", `${docsDone}/${docs.length}`],
              ["packing", "Packing", `${packDone}/${packing.length}`],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={packTab === key}
              onClick={() => setPackTab(key)}
              className={`h-10 rounded-full text-sm font-bold ${packTab === key ? "bg-ink text-bg" : "text-muted"}`}
            >
              {label} {hydrated && <span className="opacity-70">{count}</span>}
            </button>
          ))}
        </div>
        {(["docs", "packing"] as const).map((tab) => {
          const list = tab === "docs" ? docs : packing;
          return (
            <div key={tab} role="tabpanel" className={`flex flex-col gap-2 ${packTab === tab ? "" : "hidden pcm-print-all"}`}>
              <h3 className="sr-only">{tab === "docs" ? "Documents" : "Packing"}</h3>
              <p className="text-sm text-muted">
                {tab === "docs"
                  ? answered
                    ? "Built from your answers. Missing one document can delay your camp registration."
                    : "The documents everyone needs. Answer the questions to add the ones for your situation."
                  : "The list past corpers recommend. Tick as you pack."}
              </p>
              {list.map((d) => {
                const on = hydrated && Boolean(plan.ticks[tab === "docs" ? tickKey.doc(d.slug) : tickKey.pack(d.slug)]);
                return (
                  <button
                    key={d.slug}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!hydrated}
                    onClick={() => tickPack(tab === "docs" ? "doc" : "pack", d, list, !on)}
                    className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 text-left"
                  >
                    <TickBox on={on} />
                    <span className="min-w-0 flex-1">
                      <span className={`block font-medium ${on ? "text-muted line-through" : ""}`}>{d.text}</span>
                      {d.note && <span className="block text-xs text-muted">{d.note}</span>}
                    </span>
                    {d.qty && <span className="shrink-0 text-xs font-bold text-muted">{d.qty}</span>}
                    {tab === "docs" && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${d.tag === "for_you" ? "bg-pink/20 text-pink-ink" : "bg-surface-2 text-muted"}`}
                      >
                        {d.tag === "for_you" ? "For you" : "Required"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        <div className="pcm-noprint grid grid-cols-2 gap-2">
          {[
            ["Photo sheet maker", "Selfie to print-ready sheet on white"],
            ["My documents", "Keep copies safe on your phone"],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 rounded-2xl border border-dashed border-line p-3.5">
              <span className="self-start rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted">Coming soon</span>
              <span className="font-bold">{t}</span>
              <span className="text-xs text-muted">{d}</span>
            </div>
          ))}
        </div>
      </section>

      {hydrated && answered && r.pct < 100 && (
        <button type="button" onClick={share} className="pcm-noprint btn-secondary">
          Share this checklist
        </button>
      )}

      {/* Footer */}
      <footer className="flex flex-col gap-1 border-t border-line pt-5 text-xs leading-relaxed text-faint">
        <span>
          Guides written and reviewed by the Kopamate team. Last reviewed for {guide.batchLabel} ({reviewed}).
        </span>
        <span>Kopamate is not affiliated with NYSC. Always follow official NYSC instructions.</span>
        <ReportLink href={report("general")} />
      </footer>

      {/* Situation sheet */}
      <Sheet open={sheet?.kind === "situation" && Boolean(sheetSituation)} onClose={() => closeSheet("situation")} title={sheetSituation?.title ?? "Situation"}>
        {sheetSituation && (
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold tracking-wide text-muted uppercase">My situation</span>
            <p className="-mt-2 leading-relaxed text-muted">
              <RichText text={sheetSituation.intro} />
            </p>
            <div>
              <h3 className="mb-2 font-bold">Extra things to prepare</h3>
              <div className="flex flex-col gap-2">
                {sheetSituation.items.map((t, n) => {
                  const key = tickKey.item(sheetSituation.slug, n);
                  const on = Boolean(plan.ticks[key]);
                  return (
                    <button
                      key={n}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => update((p) => toggleTick(p, key, !on))}
                      className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 text-left"
                    >
                      <TickBox on={on} />
                      <span className={on ? "text-muted line-through" : ""}>
                        <RichText text={t} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {sheetSituation.notes.length > 0 && (
              <div>
                <h3 className="mb-2 font-bold">Good to know</h3>
                <ul className="flex flex-col gap-2">
                  {sheetSituation.notes.map((t, n) => (
                    <li key={n} className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[15px]">
                      <RichText text={t} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-faint">
              <a href={`/nysc-checklist/${sheetSituation.slug}`} className="font-bold text-lime-ink">
                Open as a page ›
              </a>{" "}
              · Last reviewed for {guide.batchLabel} · <ReportLink href={report(sheetSituation.title)} />
              <br />
              Not affiliated with NYSC. Requirements can change, so always confirm with official NYSC instructions.
            </p>
          </div>
        )}
      </Sheet>

      {/* Fix-it sheet */}
      <Sheet open={sheet?.kind === "fix"} onClose={() => closeSheet("fix")} title="My details don’t match">
        {sheet?.kind === "fix" && (
          <FixGuide
            guide={guide}
            added={plan.fixAdded}
            onAdd={() => {
              update((p) => ({ ...p, fixAdded: true, updatedAt: new Date().toISOString() }));
              flash("Added to your plan.");
            }}
            reportHref={report("My details don’t match")}
          />
        )}
      </Sheet>

      {(toast || saveError) && (
        <div className="pcm-noprint fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-bold text-bg shadow-lg">
            {saveError ? (
              <>
                <span>{saveError.message}</span>
                <button
                  type="button"
                  onClick={() => {
                    const pending = saveError.pending;
                    setSaveError(null);
                    setPlan(pending);
                    persist(pending);
                  }}
                  className="text-lime-ink underline"
                >
                  Retry
                </button>
              </>
            ) : (
              toast
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The "My details don't match" guide: what doesn't match, which document, then who fixes it (and a letter). */
function FixGuide({ guide, added, onAdd, reportHref }: { guide: Guide; added: boolean; onAdd: () => void; reportHref: string | null }) {
  const [field, setField] = useState<(typeof FIX_FIELDS)[number]["value"] | null>(null);
  const [doc, setDoc] = useState<Exclude<FixDocument, "any"> | null>(null);
  const [letter, setLetter] = useState({ name: "", school: "", matric: "", correct: "" });
  const [copied, setCopied] = useState(false);
  const path = field ? resolveFixPath(guide, field, doc) : null;
  const stepNo = !field ? 1 : !path ? 2 : 3;

  useEffect(() => {
    if (path) logEvent("checklist_fix_used", path.slug);
  }, [path]);

  const filled = path?.hasLetter
    ? fillLetter(path.letterTemplate, { ...letter, field: FIX_FIELDS.find((f) => f.value === field)?.inLetter ?? "" })
    : "";

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-bold tracking-wide text-[#ff8a3d] uppercase">Fix-it guide</span>
      <p className="-mt-2 text-[15px] leading-relaxed text-muted">
        Your name, date of birth, course and graduation date should be the same on your NIN, JAMB record, statement of result and the senate
        list. Fix it now: key details can&apos;t be changed after camp.
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-[#ff8a3d] transition-all" style={{ width: `${Math.round((stepNo / 3) * 100)}%` }} />
      </div>

      {stepNo === 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">What doesn&apos;t match?</legend>
          {FIX_FIELDS.map((f) => (
            <button key={f.value} type="button" onClick={() => setField(f.value)} className="rounded-2xl border border-line px-4 py-3.5 text-left font-medium">
              {f.label}
            </button>
          ))}
        </fieldset>
      )}
      {stepNo === 2 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">Which document is different from the others?</legend>
          {FIX_DOCUMENTS.map((d) => (
            <button key={d.value} type="button" onClick={() => setDoc(d.value)} className="rounded-2xl border border-line px-4 py-3.5 text-left font-medium">
              {d.label}
            </button>
          ))}
          <button type="button" onClick={() => setField(null)} className="self-start py-2 text-sm font-bold text-muted">
            Back
          </button>
        </fieldset>
      )}
      {stepNo === 3 && path && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#ff8a3d]/60 p-4">
            <span className="text-xs font-bold tracking-wide text-muted uppercase">Who fixes it</span>
            <span className="h-display block text-lg">{path.who}</span>
            <span className="block text-sm text-muted">
              <RichText text={path.line} />
            </span>
          </div>
          <ol className="flex flex-col gap-2">
            {path.steps.map((t, n) => (
              <li key={n} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{n + 1}</span>
                <span>
                  <RichText text={t} />
                </span>
              </li>
            ))}
          </ol>
          {path.hasLetter && (
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer font-bold">Get a ready-made request letter</summary>
              <p className="mt-2 text-xs text-muted">Your details stay on this phone. We don&apos;t save them.</p>
              <div className="mt-3 grid gap-2">
                {(
                  [
                    ["name", "Your full name (as it should be)"],
                    ["school", "Your school"],
                    ["matric", "Matric number"],
                    ["correct", "The correct details"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-medium text-muted">
                    {label}
                    <input
                      value={letter[k]}
                      onChange={(e) => setLetter((l) => ({ ...l, [k]: e.target.value.slice(0, 120) }))}
                      autoComplete="off"
                      className="field h-11 text-[15px]"
                    />
                  </label>
                ))}
              </div>
              <textarea readOnly value={filled} aria-label="Your letter" className="field mt-3 h-56 py-3 text-sm leading-relaxed" />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(filled);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                  className="h-11 flex-1 rounded-full bg-lime font-bold text-on-accent"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([filled], { type: "text/plain" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "request-letter.txt";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="h-11 flex-1 rounded-full border border-line font-bold"
                >
                  Download as .txt
                </button>
              </div>
            </details>
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={added}
            className={`h-12 rounded-full font-bold ${added ? "border border-lime text-lime-ink" : "bg-lime text-on-accent"}`}
          >
            {added ? "Added to my plan" : "Add to my plan"}
          </button>
          <button
            type="button"
            onClick={() => {
              setField(null);
              setDoc(null);
            }}
            className="py-1 text-sm font-bold text-muted"
          >
            Start again
          </button>
          <p className="text-xs text-faint">
            General guidance only. Correction rules can change; confirm the latest process with the office that fixes it. <ReportLink href={reportHref} />
          </p>
        </div>
      )}
    </div>
  );
}
