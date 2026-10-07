"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { markGuideReviewed, resetGuide, saveGuide, saveGuideSettings, undoGuide, type GuideSaveResult } from "@/app/actions/admin-pcm";
import { QUESTIONS, TINTS, type Conditions, type FixPath, type Guide, type PackItem, type Situation, type Step, type Tip } from "@/content/pcm-guide";
import { DRAFT_KEY, guideProblems, LETTER_PLACEHOLDERS } from "@/lib/pcm-rules";
import { btn, btnPrimary, input, panel } from "../ui";

type Props = {
  initial: Guide;
  version: number;
  isDefault: boolean;
  savedValid: boolean;
  settings: { enabled: boolean; whatsapp: string; email: string };
  numbers: { name: string; d7: number; d30: number }[];
};

const SECTIONS = ["Steps", "Situations", "Fix-it paths", "Documents", "Packing", "Tips", "Settings"] as const;
type Section = (typeof SECTIONS)[number];

const area = `${input} h-auto min-h-20 py-2 leading-relaxed`;

// ---------- Small field editors ----------

function Text({ label, value, onChange, max, hint }: { label: string; value: string; onChange: (v: string) => void; max: number; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={input} />
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

function Area({ label, value, onChange, max, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; max: number; rows?: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
      {label}
      <textarea value={value} maxLength={max} rows={rows} onChange={(e) => onChange(e.target.value)} className={area} />
    </label>
  );
}

/** A list of lines: edit each, add, remove, move up and down. */
function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const set = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5 text-sm text-muted md:col-span-2">
      {label}
      {value.map((line, i) => (
        <div key={i} className="flex gap-1.5">
          <span className="w-5 shrink-0 pt-2 text-right text-xs text-faint">{i + 1}</span>
          <textarea value={line} rows={1} maxLength={400} onChange={(e) => set(i, e.target.value)} className={`${area} min-h-9 flex-1`} />
          <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
            ↑
          </button>
          <button type="button" className={btn} disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
            ↓
          </button>
          <button type="button" className={btn} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove line">
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={`${btn} self-start`} onClick={() => onChange([...value, ""])}>
        + Add line
      </button>
    </div>
  );
}

/** Who sees it: "Everyone" or one answer per question. */
function ConditionsPicker({ value, onChange }: { value: Conditions; onChange: (v: Conditions) => void }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm text-muted md:col-span-2">
      Who sees it (every chosen answer must match)
      <div className="grid gap-2 md:grid-cols-3">
        {QUESTIONS.map((q) => (
          <label key={q.key} className="flex flex-col gap-1 text-xs">
            {q.label}
            <select
              value={value[q.key] ?? ""}
              onChange={(e) => {
                const next = { ...value };
                if (e.target.value) next[q.key] = e.target.value;
                else delete next[q.key];
                onChange(next);
              }}
              className={input}
            >
              <option value="">Everyone</option>
              {q.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-lime" />
      {label}
    </label>
  );
}

const describe = (c: Conditions) => {
  const parts = Object.entries(c).map(([k, v]) => {
    const q = QUESTIONS.find((x) => x.key === k);
    return `${q?.label.replace(/\?$/, "") ?? k}: ${q?.options.find((o) => o.value === v)?.label ?? v}`;
  });
  return parts.length ? parts.join(" · ") : "Everyone";
};

/** A list with reordering, add, edit (inline), remove and a Show switch. */
function ListSection<T extends { show?: boolean }>({
  items,
  onChange,
  title,
  subtitle,
  blank,
  form,
  canHide = true,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  title: (t: T) => string;
  subtitle?: (t: T) => string;
  blank: () => T;
  form: (t: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  canHide?: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
    if (editing === i) setEditing(i + d);
  };
  const patch = (i: number, p: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className={`${panel} !p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6 text-center text-xs text-faint">{i + 1}</span>
            <span className={`min-w-0 flex-1 ${it.show === false ? "text-faint line-through" : ""}`}>
              <span className="block font-bold">{title(it) || "(untitled)"}</span>
              {subtitle && <span className="block text-xs text-muted">{subtitle(it)}</span>}
            </span>
            {canHide && <Toggle label="Show" value={it.show !== false} onChange={(v) => patch(i, { show: v } as Partial<T>)} />}
            <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              ↑
            </button>
            <button type="button" className={btn} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              ↓
            </button>
            <button type="button" className={btn} onClick={() => setEditing(editing === i ? null : i)} aria-expanded={editing === i}>
              {editing === i ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => {
                if (!confirm(`Remove "${title(it) || "this item"}"? (Hide it instead to keep it.)`)) return;
                onChange(items.filter((_, j) => j !== i));
                setEditing(null);
              }}
            >
              Remove
            </button>
          </div>
          {editing === i && <div className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-2">{form(it, (p) => patch(i, p))}</div>}
        </div>
      ))}
      <button
        type="button"
        className={`${btn} self-start`}
        onClick={() => {
          onChange([...items, blank()]);
          setEditing(items.length);
        }}
      >
        + Add
      </button>
    </div>
  );
}

const slugHint = "Short id used in links (#slug) and to remember ticks: a-z, 0-9 and -. Changing it resets people's ticks for this item.";

function packForm(d: PackItem, set: (p: Partial<PackItem>) => void) {
  return (
    <>
      <Text label="Text" value={d.text} max={120} onChange={(v) => set({ text: v })} />
      <Text label="Slug" value={d.slug} max={40} onChange={(v) => set({ slug: v.toLowerCase() })} hint={slugHint} />
      <Text label="Note (optional)" value={d.note} max={300} onChange={(v) => set({ note: v })} />
      <Text label="Quantity (optional)" value={d.qty} max={40} onChange={(v) => set({ qty: v })} />
      <label className="flex flex-col gap-1 text-sm text-muted">
        Tag
        <select value={d.tag} onChange={(e) => set({ tag: e.target.value as PackItem["tag"] })} className={input}>
          <option value="required">Required</option>
          <option value="for_you">For you</option>
        </select>
      </label>
      <ConditionsPicker value={d.conditions} onChange={(v) => set({ conditions: v })} />
    </>
  );
}

const blankPack = (): PackItem => ({ slug: "", text: "", note: "", qty: "", tag: "required", conditions: {}, show: true });

// ---------- The editor ----------

export default function GuideEditor({ initial, version: initialVersion, isDefault, savedValid, settings, numbers }: Props) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Guide>(initial);
  const [version, setVersion] = useState(initialVersion);
  const [section, setSection] = useState<Section>("Steps");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GuideSaveResult | null>(null);
  const [settingsState, settingsAction, settingsPending] = useActionState(saveGuideSettings, undefined);
  const problems = useMemo(() => guideProblems(draft), [draft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  // The preview page reads the draft from this browser; it's never stored on the server until saved.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Guide>(key: K, value: Guide[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function run(fn: () => Promise<GuideSaveResult>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        setVersion(r.version);
        setSaved(r.guide);
        setDraft(r.guide);
      }
    } finally {
      setBusy(false);
    }
  }

  const stepOptions = draft.steps.map((s) => ({ value: s.slug, label: s.title || s.slug }));

  return (
    <div className="flex flex-col gap-4">
      {!savedValid && (
        <p role="alert" className="rounded-lg border border-pink px-3 py-2 text-sm">
          The saved guide couldn&apos;t be read, so the app is showing the built-in default. Save to replace it.
        </p>
      )}

      {/* Save bar */}
      <div className={`${panel} sticky top-2 z-20 flex flex-col gap-2 bg-bg`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm text-muted">
            {dirty ? <b className="text-ink">Unsaved changes</b> : "No unsaved changes"} · version {version}
            {isDefault && version === initialVersion ? " (built-in default)" : ""}
          </span>
          <button type="button" className={btn} onClick={() => window.open("/nysc-checklist?preview=1", "_blank")}>
            Preview
          </button>
          <button type="button" className={btn} disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            Discard changes
          </button>
          <button type="button" className={btnPrimary} disabled={!dirty || busy || problems.length > 0} onClick={() => run(() => saveGuide(draft, version))}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {problems.length > 0 && (
          <ul role="alert" className="max-h-28 overflow-y-auto rounded-lg border border-pink px-3 py-2 text-xs">
            {problems.slice(0, 20).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {problems.length > 20 && <li>…and {problems.length - 20} more.</li>}
          </ul>
        )}
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${result.ok ? "border-lime" : "border-pink"}`}>
            {result.ok ? `Saved. The page and Home now show version ${result.version}.` : result.error}
            {!result.ok && result.problems && (
              <span className="mt-1 block text-xs">
                {result.problems.slice(0, 10).join(" ")}
              </span>
            )}
          </p>
        )}
      </div>

      <nav className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5" aria-label="Guide sections">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            aria-current={section === s ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${section === s ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
          >
            {s}
          </button>
        ))}
      </nav>

      {section === "Steps" && (
        <ListSection<Step>
          items={draft.steps}
          onChange={(v) => set("steps", v)}
          title={(s) => s.title}
          subtitle={(s) => `#${s.slug} · ${s.opens === "step" ? "Step" : s.opens === "camp_docs" ? "Done when all documents are ticked" : "Done when everything is packed"} · ${describe(s.conditions)}`}
          blank={() => ({ slug: "", title: "", short: "", what: "", why: "", how: [], bring: [], cost: "", time: "", mistakes: [], opens: "step", conditions: {}, show: true })}
          form={(s, p) => (
            <>
              <Text label="Title" value={s.title} max={120} onChange={(v) => p({ title: v })} />
              <Text label="Slug" value={s.slug} max={40} onChange={(v) => p({ slug: v.toLowerCase() })} hint={slugHint} />
              <Area label="Short line (Do this next card)" value={s.short} max={300} onChange={(v) => p({ short: v })} rows={2} />
              <Area label="What it is" value={s.what} max={1200} onChange={(v) => p({ what: v })} />
              <Area label="Why it matters" value={s.why} max={1200} onChange={(v) => p({ why: v })} />
              <Lines label="How to do it (numbered)" value={s.how} onChange={(v) => p({ how: v })} />
              <Lines label="Bring with you" value={s.bring} onChange={(v) => p({ bring: v })} />
              <Lines label="Common mistakes" value={s.mistakes} onChange={(v) => p({ mistakes: v })} />
              <Text label="Cost" value={s.cost} max={60} onChange={(v) => p({ cost: v })} />
              <Text label="Time" value={s.time} max={60} onChange={(v) => p({ time: v })} />
              <label className="flex flex-col gap-1 text-sm text-muted">
                Opens
                <select value={s.opens} onChange={(e) => p({ opens: e.target.value as Step["opens"] })} className={input}>
                  <option value="step">The step itself (ticked by hand)</option>
                  <option value="camp_docs">Camp Pack: Documents (done when all are ticked)</option>
                  <option value="camp_packing">Camp Pack: Packing (done when all are ticked)</option>
                </select>
              </label>
              <ConditionsPicker value={s.conditions} onChange={(v) => p({ conditions: v })} />
              <p className="text-xs text-faint md:col-span-2">Text supports **bold** and [links](https://…) only.</p>
            </>
          )}
        />
      )}

      {section === "Situations" && (
        <ListSection<Situation>
          items={draft.situations}
          onChange={(v) => set("situations", v)}
          title={(s) => `${s.badge}  ${s.title}`}
          subtitle={(s) => `#${s.slug} · ${s.alwaysShow ? "Always shown" : describe(s.conditions)}`}
          blank={() => ({ slug: "", title: "", badge: "", tint: TINTS[0], subtitle: "", intro: "", items: [], notes: [], conditions: {}, alwaysShow: false, show: true })}
          form={(s, p) => (
            <>
              <Text label="Title" value={s.title} max={120} onChange={(v) => p({ title: v })} />
              <Text label="Slug" value={s.slug} max={40} onChange={(v) => p({ slug: v.toLowerCase() })} hint={slugHint} />
              <Text label="Badge (1–2 characters)" value={s.badge} max={2} onChange={(v) => p({ badge: v })} />
              <label className="flex flex-col gap-1 text-sm text-muted">
                Colour
                <span className="flex gap-1.5">
                  {TINTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => p({ tint: t })}
                      aria-label={t}
                      aria-pressed={s.tint === t}
                      className={`size-8 rounded-lg ${s.tint === t ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
                      style={{ background: t }}
                    />
                  ))}
                </span>
              </label>
              <Area label="Card subtitle" value={s.subtitle} max={300} onChange={(v) => p({ subtitle: v })} rows={2} />
              <Area label="Intro" value={s.intro} max={1200} onChange={(v) => p({ intro: v })} />
              <Lines label="Extra things to prepare (tickable)" value={s.items} onChange={(v) => p({ items: v })} />
              <Lines label="Good to know" value={s.notes} onChange={(v) => p({ notes: v })} />
              <Toggle label="Always show (for everyone, after the matching ones)" value={s.alwaysShow} onChange={(v) => p({ alwaysShow: v })} />
              {!s.alwaysShow && <ConditionsPicker value={s.conditions} onChange={(v) => p({ conditions: v })} />}
            </>
          )}
        />
      )}

      {section === "Fix-it paths" && (
        <>
          <p className="text-sm text-muted">
            The first path that matches what doesn&apos;t match (field) and which document is different is shown. Course or graduation date
            always looks for a path whose document is &quot;Any&quot;.
          </p>
          <ListSection<FixPath>
            items={draft.fixPaths}
            onChange={(v) => set("fixPaths", v)}
            title={(f) => f.who}
            subtitle={(f) => `Field: ${f.field} · Document: ${f.document}${f.hasLetter ? " · with letter" : ""}`}
            blank={() => ({ slug: "", field: "any", document: "any", who: "", line: "", steps: [], hasLetter: false, letterTemplate: "", show: true })}
            form={(f, p) => (
              <>
                <Text label="Who fixes it" value={f.who} max={120} onChange={(v) => p({ who: v })} />
                <Text label="Slug" value={f.slug} max={40} onChange={(v) => p({ slug: v.toLowerCase() })} />
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Field
                  <select value={f.field} onChange={(e) => p({ field: e.target.value as FixPath["field"] })} className={input}>
                    <option value="any">Any</option>
                    <option value="name">Name</option>
                    <option value="dob">Date of birth</option>
                    <option value="course">Course or graduation date</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Document
                  <select value={f.document} onChange={(e) => p({ document: e.target.value as FixPath["document"] })} className={input}>
                    <option value="any">Any</option>
                    <option value="nin">NIN slip</option>
                    <option value="jamb">JAMB record</option>
                    <option value="sor">Statement of result</option>
                    <option value="senate">Senate list</option>
                  </select>
                </label>
                <Area label="One-line explanation" value={f.line} max={300} onChange={(v) => p({ line: v })} rows={2} />
                <Lines label="Steps (numbered)" value={f.steps} onChange={(v) => p({ steps: v })} />
                <Toggle label="Offer a ready-made letter" value={f.hasLetter} onChange={(v) => p({ hasLetter: v })} />
                {f.hasLetter && (
                  <div className="grid gap-2 md:col-span-2 md:grid-cols-[1fr_12rem]">
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      Letter template
                      <textarea value={f.letterTemplate} rows={14} maxLength={6000} onChange={(e) => p({ letterTemplate: e.target.value })} className={`${area} font-mono text-xs`} />
                    </label>
                    <div className="text-xs text-muted">
                      Placeholders, filled from the person&apos;s answers in the letter form (never saved):
                      <ul className="mt-1 flex flex-col gap-1">
                        {LETTER_PLACEHOLDERS.map((k) => (
                          <li key={k}>
                            <code className="rounded bg-surface-2 px-1">{`{${k}}`}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          />
        </>
      )}

      {section === "Documents" && (
        <ListSection<PackItem>
          items={draft.documents}
          onChange={(v) => set("documents", v)}
          title={(d) => d.text}
          subtitle={(d) => `${d.tag === "for_you" ? "For you" : "Required"} · ${describe(d.conditions)}`}
          blank={blankPack}
          form={packForm}
        />
      )}

      {section === "Packing" && (
        <ListSection<PackItem>
          items={draft.packing}
          onChange={(v) => set("packing", v)}
          title={(d) => `${d.text}${d.qty ? ` (${d.qty})` : ""}`}
          subtitle={(d) => describe(d.conditions)}
          blank={blankPack}
          form={packForm}
        />
      )}

      {section === "Tips" && (
        <ListSection<Tip & { show?: boolean }>
          items={draft.tips}
          onChange={(v) => set("tips", v)}
          title={(t) => t.text}
          subtitle={(t) => `${t.authorLabel} · ${stepOptions.find((s) => s.value === t.stepSlug)?.label ?? "No step"}`}
          blank={() => ({ stepSlug: draft.steps[0]?.slug ?? "", authorLabel: "", text: "" })}
          canHide={false}
          form={(t, p) => (
            <>
              <label className="flex flex-col gap-1 text-sm text-muted">
                Step
                <select value={t.stepSlug} onChange={(e) => p({ stepSlug: e.target.value })} className={input}>
                  {stepOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <Text label="Shown as" value={t.authorLabel} max={80} onChange={(v) => p({ authorLabel: v })} hint='Like "Tobi · Unilag, Batch B"' />
              <Area label="Tip (max 200 characters)" value={t.text} max={200} onChange={(v) => p({ text: v })} rows={2} />
            </>
          )}
        />
      )}

      {section === "Settings" && (
        <div className="flex flex-col gap-4">
          <section className={`${panel} grid gap-3 md:grid-cols-2`}>
            <h3 className="h-display text-lg md:col-span-2">Batch</h3>
            <Text label="Batch label" value={draft.batchLabel} max={60} onChange={(v) => set("batchLabel", v)} hint="Shown at the top and in every “Last reviewed” line. Save to apply." />
            <div className="flex flex-col gap-1 text-sm text-muted">
              Last reviewed
              <span className="text-ink">{saved.lastReviewed}</span>
              <button
                type="button"
                className={`${btn} self-start`}
                disabled={busy || dirty}
                title={dirty ? "Save or discard your changes first" : undefined}
                onClick={() => run(() => markGuideReviewed(version), "Mark the guide as reviewed today?")}
              >
                Mark as reviewed today
              </button>
            </div>
          </section>

          <form action={settingsAction} className={`${panel} grid gap-3 md:grid-cols-2`}>
            <h3 className="h-display text-lg md:col-span-2">Switch and contacts</h3>
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-0.5 size-4 accent-lime" />
              <span>
                Checklist is on
                <span className="block text-xs text-muted">Off: the page shows “Coming back soon” and the Home card is hidden.</span>
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Support WhatsApp (international format)
              <input name="support_whatsapp" defaultValue={settings.whatsapp} placeholder="+2348031234567" className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Support email
              <input name="support_email" type="email" defaultValue={settings.email} placeholder="help@…" className={input} />
            </label>
            <p className="text-xs text-faint md:col-span-2">
              “Report wrong info” opens WhatsApp with a pre-filled message, or email if there&apos;s no number. With neither, the link is hidden.
            </p>
            {settingsState && (
              <p role={settingsState.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm md:col-span-2 ${settingsState.ok ? "border-lime" : "border-pink"}`}>
                {settingsState.ok ? "Saved." : settingsState.error}
              </p>
            )}
            <div>
              <button className={btnPrimary} disabled={settingsPending}>
                {settingsPending ? "Saving…" : "Save switch and contacts"}
              </button>
            </div>
          </form>

          <section className={panel}>
            <h3 className="h-display mb-2 text-lg">Numbers</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-normal">Event</th>
                  <th className="py-1 text-right font-normal">Last 7 days</th>
                  <th className="py-1 text-right font-normal">Last 30 days</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr key={n.name} className="border-t border-line">
                    <td className="py-1.5">{n.name}</td>
                    <td className="py-1.5 text-right">{n.d7}</td>
                    <td className="py-1.5 text-right">{n.d30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={`${panel} flex flex-wrap items-center gap-2`}>
            <h3 className="h-display mr-auto text-lg">History</h3>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => run(() => undoGuide(version), "Go back to the version before the last save? Your unsaved changes are lost.")}
            >
              Undo last save
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => run(() => resetGuide(version), "Reset the whole guide to the built-in default? Undo can bring the current one back.")}
            >
              Reset to default
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
