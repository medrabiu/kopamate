import type { Answers, AnswerKey, Conditions, FixDocument, FixField, FixPath, Guide, PackItem, Situation, Step } from "../content/pcm-guide";

/**
 * Rules for the NYSC checklist (/nysc-checklist). Pure functions with no database or framework imports, so
 * they run in the browser, on the server and in tests (tests/pcm-rules.test.mjs).
 */

// ---------- Progress ----------

/** A user's progress. Ticks are keyed "<type>:<slug>" (or "item:<situation>:<n>"), so text edits never break them. */
export type Plan = {
  version: 1;
  answers: Answers;
  ticks: Record<string, true>;
  fixAdded: boolean;
  /** ISO time of the last change. */
  updatedAt: string;
};

/** Where the admin editor keeps its unsaved draft in the browser, for /nysc-checklist?preview=1. */
export const DRAFT_KEY = "km_pcm_draft";

export const emptyPlan = (): Plan => ({ version: 1, answers: {}, ticks: {}, fixAdded: false, updatedAt: new Date(0).toISOString() });

export const ANSWER_KEYS: AnswerKey[] = ["studied", "qual", "married", "over30", "health", "stage"];
export const ANSWER_VALUES: Record<AnswerKey, string[]> = {
  studied: ["ng", "abroad"],
  qual: ["uni", "poly"],
  married: ["yes", "no"],
  over30: ["yes", "no"],
  health: ["yes", "no", "skip"],
  stage: ["s0", "s1", "s2", "s3"],
};

export const tickKey = {
  step: (slug: string) => `step:${slug}`,
  doc: (slug: string) => `doc:${slug}`,
  pack: (slug: string) => `pack:${slug}`,
  item: (situation: string, n: number) => `item:${situation}:${n}`,
  fix: "fix:done",
};

const TICK_RE = /^(step|doc|pack):[a-z0-9-]{1,40}$|^item:[a-z0-9-]{1,40}:\d{1,2}$|^fix:done$/;
const MAX_TICKS = 300;

/**
 * Cleans a plan from the browser or the database: known answer values only, well-formed tick keys, a size cap.
 * Anything unexpected is dropped rather than rejected, so a bad device copy never blocks someone.
 */
export function sanitizePlan(raw: unknown): Plan {
  const p = emptyPlan();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as Record<string, unknown>;
  if (r.answers && typeof r.answers === "object") {
    for (const k of ANSWER_KEYS) {
      const v = (r.answers as Record<string, unknown>)[k];
      if (typeof v === "string" && ANSWER_VALUES[k].includes(v)) p.answers[k] = v;
    }
  }
  if (r.ticks && typeof r.ticks === "object") {
    for (const k of Object.keys(r.ticks as object).slice(0, MAX_TICKS)) {
      if ((r.ticks as Record<string, unknown>)[k] === true && TICK_RE.test(k)) p.ticks[k] = true;
    }
  }
  p.fixAdded = r.fixAdded === true;
  if (typeof r.updatedAt === "string" && !Number.isNaN(Date.parse(r.updatedAt))) p.updatedAt = new Date(r.updatedAt).toISOString();
  return p;
}

/** All 6 questions answered. */
export const answeredAll = (a: Answers) => ANSWER_KEYS.every((k) => Boolean(a[k]));

/** Every key in the conditions must match the answer; empty conditions match everyone. */
export function appliesTo(conditions: Conditions | null | undefined, answers: Answers): boolean {
  if (!conditions) return true;
  return Object.entries(conditions).every(([k, v]) => !v || answers[k as AnswerKey] === v);
}

/** Steps already behind someone, from "Where are you right now?". */
export const PRESET: Record<string, string[]> = {
  s0: [],
  s1: ["senate"],
  s2: ["senate", "nerd", "register"],
  s3: ["senate", "nerd", "register", "callup"],
};

/**
 * New answers: pre-ticks the steps implied by the stage answer. It only ever adds ticks, so changing an answer
 * never un-ticks anything the user ticked (or anything an earlier answer ticked).
 */
export function applyAnswers(plan: Plan, answers: Answers, now = new Date()): Plan {
  const ticks = { ...plan.ticks };
  for (const slug of PRESET[answers.stage ?? ""] ?? []) ticks[tickKey.step(slug)] = true;
  return { ...plan, answers: { ...answers }, ticks, updatedAt: now.toISOString() };
}

/** Ticks or unticks one item. */
export function toggleTick(plan: Plan, key: string, on: boolean, now = new Date()): Plan {
  const ticks = { ...plan.ticks };
  if (on) ticks[key] = true;
  else delete ticks[key];
  return { ...plan, ticks, updatedAt: now.toISOString() };
}

/**
 * Device progress merged into an account: every tick from both, and the answers that were changed most recently.
 * Used once after sign-up or login; the device copy is then cleared.
 */
export function mergePlans(account: Plan, device: Plan): Plan {
  const deviceNewer = Date.parse(device.updatedAt) > Date.parse(account.updatedAt);
  const answers = answeredAll(device.answers) && (deviceNewer || !answeredAll(account.answers)) ? device.answers : account.answers;
  return {
    version: 1,
    answers: Object.keys(answers).length ? answers : device.answers,
    ticks: { ...account.ticks, ...device.ticks },
    fixAdded: account.fixAdded || device.fixAdded,
    updatedAt: deviceNewer ? device.updatedAt : account.updatedAt,
  };
}

// ---------- What applies to this person ----------

export const visibleSteps = (g: Guide, a: Answers) => g.steps.filter((s) => s.show && appliesTo(s.conditions, a));
export const visibleDocuments = (g: Guide, a: Answers) => g.documents.filter((d) => d.show && appliesTo(d.conditions, a));
export const visiblePacking = (g: Guide, a: Answers) => g.packing.filter((d) => d.show && appliesTo(d.conditions, a));

/** Situation cards: matching ones (only once answered), then always-shown ones. The fix-it card comes before these. */
export function visibleSituations(g: Guide, a: Answers): Situation[] {
  const shown = g.situations.filter((s) => s.show);
  const hasAnswers = Object.keys(a).length > 0;
  const matching = shown.filter((s) => !s.alwaysShow && hasAnswers && Object.keys(s.conditions).length > 0 && appliesTo(s.conditions, a));
  return [...matching, ...shown.filter((s) => s.alwaysShow)];
}

const allTicked = (items: PackItem[], plan: Plan, key: (s: string) => string) => items.length > 0 && items.every((i) => plan.ticks[key(i.slug)]);

/** Camp Pack steps are done when every applicable item on their tab is ticked; other steps by their own tick. */
export function stepDone(g: Guide, plan: Plan, step: Step): boolean {
  if (step.opens === "camp_docs") return allTicked(visibleDocuments(g, plan.answers), plan, tickKey.doc);
  if (step.opens === "camp_packing") return allTicked(visiblePacking(g, plan.answers), plan, tickKey.pack);
  return Boolean(plan.ticks[tickKey.step(step.slug)]);
}

/** Readiness over the steps that apply: done, total, percent, and the next step (or null at 100%). */
export function readiness(g: Guide, plan: Plan) {
  const steps = visibleSteps(g, plan.answers);
  const done = steps.filter((s) => stepDone(g, plan, s)).length;
  const next = steps.find((s) => !stepDone(g, plan, s)) ?? null;
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0, next };
}

// ---------- Fix-it guide ----------

/** The fix path for a mismatch. Course or graduation date always goes to the school (document "any"). */
export function resolveFixPath(g: Guide, field: Exclude<FixField, "any">, document: FixDocument | null): FixPath | null {
  const doc = field === "course" ? "any" : document;
  if (!doc) return null;
  return g.fixPaths.find((p) => p.show && (p.field === "any" || p.field === field) && (p.document === "any" || p.document === doc)) ?? null;
}

export const FIX_FIELDS: { value: Exclude<FixField, "any">; label: string; inLetter: string }[] = [
  { value: "name", label: "My name (spelling or order)", inLetter: "name" },
  { value: "dob", label: "My date of birth", inLetter: "date of birth" },
  { value: "course", label: "My course or graduation date", inLetter: "course or graduation date" },
];

export const FIX_DOCUMENTS: { value: Exclude<FixDocument, "any">; label: string }[] = [
  { value: "nin", label: "NIN slip" },
  { value: "jamb", label: "JAMB record" },
  { value: "sor", label: "Statement of result" },
  { value: "senate", label: "Senate list" },
];

export const LETTER_PLACEHOLDERS = ["name", "school", "matric", "field", "correct"] as const;

/** Fills {name} {school} {matric} {field} {correct}. Missing values become a visible blank, never "undefined". */
export function fillLetter(template: string, values: Partial<Record<(typeof LETTER_PLACEHOLDERS)[number], string>>) {
  return template.replace(/\{(name|school|matric|field|correct)\}/g, (_, k: (typeof LETTER_PLACEHOLDERS)[number]) => {
    const v = (values[k] ?? "").trim();
    return v || "________";
  });
}

// ---------- Links ----------

/** "Report wrong info": WhatsApp (preferred) or email with a pre-filled message, or null when neither is set. */
export function reportLink(contact: { whatsapp: string | null; email: string | null }, section: string) {
  const text = `Wrong info on the NYSC checklist: ${section}`;
  const digits = contact.whatsapp?.replace(/\D/g, "");
  if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  if (contact.email) return `mailto:${contact.email}?subject=${encodeURIComponent(text)}`;
  return null;
}

export type Anchor = { kind: "step" | "situation" | "fix"; slug: string } | null;

/** What a "#slug" link opens: a step to expand, a situation sheet, or the fix-it guide (#fix). */
export function anchorTarget(g: Guide, hash: string): Anchor {
  const slug = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase();
  if (!slug) return null;
  if (slug === "fix") return { kind: "fix", slug };
  if (g.steps.some((s) => s.show && s.slug === slug)) return { kind: "step", slug };
  if (g.situations.some((s) => s.show && s.slug === slug)) return { kind: "situation", slug };
  return null;
}

// ---------- Safe text ----------

export type TextPart = { t: "text"; v: string } | { t: "bold"; v: string } | { t: "link"; v: string; href: string };

/**
 * Admin text as plain text, with only **bold** and [text](https://…) links (https only). The result is rendered
 * by React as text nodes, so any HTML in it is shown as text, never run.
 */
export function parseRichText(input: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\*\*([^*]{1,200})\*\*|\[([^\]]{1,200})\]\((https:\/\/[^\s)]{1,500})\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (m.index > last) parts.push({ t: "text", v: input.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ t: "bold", v: m[1] });
    else parts.push({ t: "link", v: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < input.length) parts.push({ t: "text", v: input.slice(last) });
  return parts;
}

// ---------- Validating an edited guide ----------

export const GUIDE_MAX_BYTES = 200 * 1024;
const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const CAP = { short: 120, medium: 300, long: 1200, line: 400, lines: 30, letter: 6000 };

/** Checks a guide (from admin or the database). Returns the problems in plain words; empty means it's fine. */
export function guideProblems(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return ["The guide is empty or not an object."];
  const g = raw as Guide;
  const size = new TextEncoder().encode(JSON.stringify(g)).length;
  if (size > GUIDE_MAX_BYTES) errors.push(`The guide is ${Math.round(size / 1024)} KB; the limit is 200 KB.`);
  if (g.version !== 1) errors.push("Unknown guide version.");
  const str = (v: unknown, where: string, max: number, required = true) => {
    if (typeof v !== "string") return void errors.push(`${where}: missing.`);
    if (required && !v.trim()) errors.push(`${where}: required.`);
    if (v.length > max) errors.push(`${where}: too long (max ${max} characters).`);
  };
  const list = (v: unknown, where: string) => {
    if (!Array.isArray(v)) return void errors.push(`${where}: should be a list.`);
    if (v.length > CAP.lines) errors.push(`${where}: at most ${CAP.lines} lines.`);
    v.forEach((line, i) => str(line, `${where} line ${i + 1}`, CAP.line));
  };
  const conditions = (v: unknown, where: string) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return void errors.push(`${where}: conditions are invalid.`);
    for (const [k, val] of Object.entries(v)) {
      if (!ANSWER_KEYS.includes(k as AnswerKey) || !ANSWER_VALUES[k as AnswerKey].includes(String(val))) {
        errors.push(`${where}: "${k}: ${String(val)}" isn't a valid condition.`);
      }
    }
  };
  const bool = (v: unknown, where: string) => typeof v !== "boolean" && errors.push(`${where}: should be on or off.`);
  const slugs = (items: { slug?: unknown }[], where: string, seen: Set<string>) => {
    items.forEach((it, i) => {
      const s = it?.slug;
      if (typeof s !== "string" || !SLUG_RE.test(s)) errors.push(`${where} ${i + 1}: the slug must be 1–40 characters of a-z, 0-9 or -.`);
      else if (seen.has(s)) errors.push(`${where} ${i + 1}: the slug "${s}" is used twice.`);
      else seen.add(s);
    });
  };

  str(g.batchLabel, "Batch label", 60);
  if (typeof g.lastReviewed !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(g.lastReviewed)) errors.push("Last reviewed: should be a date.");
  for (const key of ["steps", "situations", "fixPaths", "documents", "packing", "tips"] as const) {
    if (!Array.isArray(g[key])) {
      errors.push(`${key}: should be a list.`);
      return errors;
    }
  }
  // Steps and situations share the page's #anchors, so their slugs must be unique together.
  const anchors = new Set<string>(["fix"]);
  slugs(g.steps, "Step", anchors);
  slugs(g.situations, "Situation", anchors);
  g.steps.forEach((s, i) => {
    const w = `Step ${i + 1}`;
    str(s.title, `${w} title`, CAP.short);
    str(s.short, `${w} short line`, CAP.medium);
    str(s.what, `${w} what`, CAP.long);
    str(s.why, `${w} why`, CAP.long, false);
    list(s.how, `${w} how-to`);
    list(s.bring, `${w} bring`);
    list(s.mistakes, `${w} mistakes`);
    str(s.cost, `${w} cost`, 60, false);
    str(s.time, `${w} time`, 60, false);
    if (!["step", "camp_docs", "camp_packing"].includes(s.opens)) errors.push(`${w}: unknown "opens" value.`);
    conditions(s.conditions, w);
    bool(s.show, `${w} show`);
  });
  g.situations.forEach((s, i) => {
    const w = `Situation ${i + 1}`;
    str(s.title, `${w} title`, CAP.short);
    str(s.badge, `${w} badge`, 2);
    if (typeof s.tint !== "string" || !/^#[0-9a-f]{6}$/i.test(s.tint)) errors.push(`${w}: tint should be a colour like #ff4fa3.`);
    str(s.subtitle, `${w} subtitle`, CAP.medium);
    str(s.intro, `${w} intro`, CAP.long);
    list(s.items, `${w} items`);
    list(s.notes, `${w} notes`);
    conditions(s.conditions, w);
    bool(s.alwaysShow, `${w} always show`);
    bool(s.show, `${w} show`);
  });
  slugs(g.fixPaths, "Fix-it path", new Set());
  g.fixPaths.forEach((p, i) => {
    const w = `Fix-it path ${i + 1}`;
    if (!["name", "dob", "course", "any"].includes(p.field)) errors.push(`${w}: unknown field.`);
    if (!["nin", "jamb", "sor", "senate", "any"].includes(p.document)) errors.push(`${w}: unknown document.`);
    str(p.who, `${w} who fixes it`, CAP.short);
    str(p.line, `${w} line`, CAP.medium);
    list(p.steps, `${w} steps`);
    bool(p.hasLetter, `${w} letter`);
    str(p.letterTemplate, `${w} letter template`, CAP.letter, p.hasLetter);
    bool(p.show, `${w} show`);
  });
  for (const [key, label] of [
    ["documents", "Document"],
    ["packing", "Packing item"],
  ] as const) {
    slugs(g[key], label, new Set());
    g[key].forEach((d, i) => {
      const w = `${label} ${i + 1}`;
      str(d.text, `${w} text`, CAP.short);
      str(d.note, `${w} note`, CAP.medium, false);
      str(d.qty, `${w} quantity`, 40, false);
      if (!["required", "for_you"].includes(d.tag)) errors.push(`${w}: unknown tag.`);
      conditions(d.conditions, w);
      bool(d.show, `${w} show`);
    });
  }
  const stepSlugs = new Set(g.steps.map((s) => s.slug));
  g.tips.forEach((t, i) => {
    const w = `Tip ${i + 1}`;
    if (!stepSlugs.has(t?.stepSlug)) errors.push(`${w}: pick a step.`);
    str(t?.authorLabel, `${w} author`, 80);
    str(t?.text, `${w} text`, 200);
  });
  return errors;
}
