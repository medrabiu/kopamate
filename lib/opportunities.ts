import "server-only";
import { sql } from "./db";

/**
 * Opportunities for corpers, collected from public RSS feeds when an admin presses "Fetch now"
 * (/admin/opportunities). Not shown to users yet: Opportunities is coming soon, with applying done inside
 * Kopamate, so nothing sends people out of the app. Admins can hide, pin and add their own meanwhile.
 */

export const CATEGORIES = ["jobs", "internships", "scholarships", "fellowships", "grants", "contests", "programs"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  jobs: "Jobs",
  internships: "Internships",
  scholarships: "Scholarships",
  fellowships: "Fellowships",
  grants: "Grants",
  contests: "Contests",
  programs: "Programs",
};

export const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category);

export type Opportunity = {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  source: string;
  category: Category;
  deadline: string | null;
  published_at: Date;
  pinned: boolean;
};

type Feed = { name: string; url: string; jobs?: boolean };

const FEEDS: Feed[] = [
  { name: "Opportunities For Africans", url: "https://www.opportunitiesforafricans.com/feed/" },
  { name: "Opportunity Desk", url: "https://www.opportunitydesk.org/feed/" },
  { name: "Opportunities for Youth", url: "https://opportunitiesforyouth.org/feed/" },
  { name: "Hot Nigerian Jobs", url: "https://www.hotnigerianjobs.com/feed/rss.xml", jobs: true },
];

/** Most items kept from one feed per run (the jobs feed lists hundreds). */
const PER_FEED = 40;
/** Fetched items older than this are deleted (pinned and admin-added ones stay). */
const KEEP_DAYS = 60;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const plain = (s: string) => decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (item: string, name: string) => item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
const tags = (item: string, name: string) => [...item.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "gi"))].map((m) => plain(m[1]));

/** Jobs a fresh graduate can get: graduate/trainee/entry/NYSC roles or up to ~2 years' experience, not senior posts. */
const ENTRY = /graduate|trainee|entry[- ]level|intern|nysc|corps? member|fresh|no experience|0\s*-\s*[12] years?|1\s*-\s*[23] years?|(?<!\d)[12] years?/i;
const SENIOR = /\b(senior|snr|manager|head|director|lead|principal|chief|supervisor|vp)\b/i;
/** Posts only open to people in one other country, or US-only, which corpers in Nigeria can't apply for. */
const ELSEWHERE =
  /\b(?:from|based in|residents of|citizens of|in)\s+(?:the\s+)?(?:kenya|rwanda|uganda|tanzania|ghana|south africa|ethiopia|egypt|morocco|zambia|zimbabwe|malawi|botswana|namibia|senegal|cameroon|india|pakistan|bangladesh|philippines|indonesia|canada|australia)\b|\bu\.?s\.?[- ]based\b|\bu\.s\. (?:small business|citizens|residents)\b/i;
/** "Deadline: January 5, 2027", "Application Deadline: 30 November 2026", "Deadline: Ongoing". */
const DEADLINE =
  /^(?:Application\s+)?Deadline:\s*((?:[A-Z][a-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})|(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+,?\s+\d{4})|Ongoing|Varies|Rolling|Open|Not specified)[.,;:]?/;

function categorize(text: string): Category {
  if (/\bintern(ship)?s?\b/i.test(text)) return "internships";
  if (/fellowship|fellows\b/i.test(text)) return "fellowships";
  if (/scholarship|master'?s|\bmba\b|\bphd\b|postgraduate|undergraduate|study in/i.test(text)) return "scholarships";
  if (/\bgrants?\b|funding|accelerator|incubat|seed fund|investment/i.test(text)) return "grants";
  if (/competition|contest|challenge|hackathon|essay|award|prize/i.test(text)) return "contests";
  if (/\bjobs?\b|recruit|hiring|vacanc|position/i.test(text)) return "jobs";
  return "programs";
}

/** The title decides; the site's own tags only break a tie when the title says nothing specific. */
function categoryOf(title: string, siteTags: string[]): Category {
  const fromTitle = categorize(title);
  return fromTitle === "programs" ? categorize(`${title} ${siteTags.join(" ")}`) : fromTitle;
}

type Parsed = Omit<Opportunity, "id" | "pinned">;

export function parseFeed(xml: string, feed: Feed): Parsed[] {
  const out: Parsed[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const title = plain(tag(item, "title")).slice(0, 200);
    const url = plain(tag(item, "link"));
    if (!title || !/^https:\/\//.test(url)) continue;
    let summary = plain(tag(item, "description"))
      .replace(/The post .* appeared first on .*$/i, "")
      .trim();
    // Opportunity sites start the summary with the deadline.
    let deadline: string | null = null;
    const dl = summary.match(DEADLINE);
    if (dl) {
      deadline = dl[1];
      summary = summary.slice(dl[0].length).trim();
    }
    summary = summary.replace(/(\[…\]|…|\.\.\.)$/, "").trim();
    if (summary.length > 220) summary = summary.slice(0, 217).replace(/\s+\S*$/, "") + "…";

    if (SENIOR.test(title) || ELSEWHERE.test(title)) continue;
    if (feed.jobs && !ENTRY.test(`${title} ${summary}`)) continue;
    const date = new Date(plain(tag(item, "pubDate")));
    out.push({
      url,
      title,
      summary: summary || null,
      source: feed.name,
      category: feed.jobs ? (/\binterns?(hips?)?\b/i.test(title) ? "internships" : "jobs") : categoryOf(title, tags(item, "category")),
      deadline,
      published_at: Number.isNaN(date.getTime()) ? new Date() : date,
    });
    if (out.length >= PER_FEED) break;
  }
  return out;
}

/** Fetches every feed, saves new items and drops old ones. One bad feed doesn't stop the others. */
export async function fetchOpportunities() {
  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "KopamateBot/1.0 (+https://www.kopamate.com)", Accept: "application/rss+xml, application/xml, text/xml" },
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
        if (!res.ok) return { feed: feed.name, error: `HTTP ${res.status}`, items: [] as Parsed[] };
        return { feed: feed.name, items: parseFeed(await res.text(), feed) };
      } catch (err) {
        return { feed: feed.name, error: err instanceof Error ? err.message : "failed", items: [] as Parsed[] };
      }
    }),
  );

  const items = results.flatMap((r) => r.items);
  let added = 0;
  if (items.length > 0) {
    const rows = await sql`
      INSERT INTO opportunities ${sql(items.map((i) => ({ ...i, published_at: i.published_at.toISOString() })), "url", "title", "summary", "source", "category", "deadline", "published_at")}
      ON CONFLICT (url) DO NOTHING
      RETURNING id
    `;
    added = rows.length;
  }
  await sql`
    DELETE FROM opportunities
    WHERE NOT pinned AND added_by IS NULL AND published_at < now() - ${KEEP_DAYS} * interval '1 day'
  `;
  return { added, feeds: results.map((r) => ({ feed: r.feed, found: r.items.length, ...(r.error ? { error: r.error } : {}) })) };
}
