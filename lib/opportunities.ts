import "server-only";

/**
 * Opportunities for corpers, added by admins (/admin/opportunities). Not shown to users yet: Opportunities is
 * coming soon, with applying done inside Kopamate, so nothing sends people out of the app.
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
