/**
 * Where someone is in NYSC. Used on server and client (labels for forms and profiles).
 *
 * - waiting: no call-up letter yet (a prospective corps member). Their state is where they live for now.
 * - posted:  has a call-up letter, camp hasn't started.
 * - serving: in camp or serving.
 * - served:  passed out (an ex-corper).
 *
 * With a batch (like "2026B2": year, batch letter, stream), the daily cron moves people forward on their own:
 * posted → serving once camp has started, serving → served once the service year is over.
 */
export const STAGES = ["serving", "posted", "waiting", "served"] as const;
export type Stage = (typeof STAGES)[number];

/** Stages that count as corpers in the State League and the "Serving" list of each state. */
export const IN_SERVICE: Stage[] = ["posted", "serving"];

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

/** Short labels for the stage chips. */
export const STAGE_CHIP: Record<Stage, string> = {
  serving: "Serving",
  posted: "Got call-up",
  waiting: "Awaiting call-up",
  served: "Passed out",
};

/** The label above the state field for each stage. */
export const STATE_LABEL: Record<Stage, string> = {
  serving: "State you're serving in",
  posted: "State you're posted to",
  waiting: "State you live in",
  served: "State you served in",
};

export const BATCH_LETTERS = ["A", "B", "C"] as const;

/** "2026B" or "2026B2" (stream 1 or 2). */
const BATCH_RE = /^(\d{4})([ABC])([12])?$/;

export function parseBatch(batch: string | null | undefined) {
  const m = batch?.match(BATCH_RE);
  if (!m) return null;
  return { year: Number(m[1]), letter: m[2] as (typeof BATCH_LETTERS)[number], stream: m[3] ? Number(m[3]) : null };
}

/** "2026 Batch B" (with ", Stream II" when `stream` is set and known). */
export function formatBatch(batch: string | null | undefined, stream = false) {
  const b = parseBatch(batch);
  if (!b) return null;
  return `${b.year} Batch ${b.letter}${stream && b.stream ? `, Stream ${b.stream === 1 ? "I" : "II"}` : ""}`;
}

/** The batch a state code belongs to, without the stream: LA/26B/1234 → "2026B". */
export function batchFromStateCode(code: string | null | undefined) {
  const m = code?.match(/^[A-Z]{2}\/(\d{2})([ABC])\//);
  return m ? `20${m[1]}${m[2]}` : null;
}

/**
 * Roughly when a batch's orientation camp starts (the 1st of that month, Lagos time). Each batch has two
 * streams about two months apart; dates move by weeks every year, so the checks below allow slack.
 * Unknown stream: assume the later one, so nobody is moved on too early.
 */
const CAMP_MONTH: Record<string, [number, number]> = { A: [3, 5], B: [6, 8], C: [10, 12] }; // 0-based months; 12 = next January

export function campStart(batch: string) {
  const b = parseBatch(batch);
  if (!b) return null;
  const month = CAMP_MONTH[b.letter][(b.stream ?? 2) - 1];
  return new Date(Date.UTC(b.year, month, 1));
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

/** Service lasts a year from camp; two months of slack on top (passing out can run late). */
export function serviceOver(batch: string, now = new Date()) {
  const start = campStart(batch);
  return start ? now >= addMonths(start, 14) : false;
}

/** Camp has started (with a month of slack, since the call-up comes weeks before). */
export function campStarted(batch: string, now = new Date()) {
  const start = campStart(batch);
  return start ? now >= addMonths(start, 1) : false;
}

/** Why a stage and batch don't fit together, or null. Only catches the clear cases. */
export function batchProblem(stage: Stage, batch: string | null, now = new Date()) {
  if (!batch) return null;
  const start = campStart(batch)!;
  if ((stage === "serving" || stage === "posted") && serviceOver(batch, now)) {
    return `${formatBatch(batch, true)} has passed out already. Pick "Passed out", or check your batch.`;
  }
  if (stage === "served" && now < addMonths(start, 10)) {
    return `${formatBatch(batch, true)} hasn't passed out yet. Pick "Serving", or check your batch.`;
  }
  return null;
}

/** Years to offer in the batch picker: next year down to 30 years ago (ex-corpers can be any age). */
export function batchYears(stage: Stage, now = new Date()) {
  const y = now.getFullYear();
  const from = stage === "served" ? y : y + 1;
  const to = stage === "served" ? y - 30 : y - 2;
  const years: number[] = [];
  for (let i = from; i >= to; i--) years.push(i);
  return years;
}

/** The line under a name on profiles: "Serving in Lagos · 2026 Batch B", "Posted to Kano", "Awaiting call-up". */
export function stageLine(stage: Stage, state: string | null, batch: string | null) {
  const b = formatBatch(batch);
  const withBatch = (s: string) => (b ? `${s} · ${b}` : s);
  switch (stage) {
    case "waiting":
      return "Awaiting call-up";
    case "posted":
      return state ? `Posted to ${state}` : "Got call-up";
    case "served":
      return withBatch(state ? `Served in ${state}` : "Ex-corper");
    default:
      return withBatch(state ? `Serving in ${state}` : "Corper");
  }
}
