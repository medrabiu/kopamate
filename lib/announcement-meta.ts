/**
 * Announcement types and the starting templates on /admin/announcements. The type sets the label on the Home
 * carousel and in Notifications. Templates only prefill the form: everything stays editable before posting.
 * Words in [brackets] are placeholders to replace.
 */

export const KINDS = ["update", "promotion", "event", "reminder", "contest", "general"] as const;
export type AnnouncementKind = (typeof KINDS)[number];

export const isKind = (v: unknown): v is AnnouncementKind => KINDS.includes(v as AnnouncementKind);

/** Label and accent: lime for product news, pink for everything that asks people to act. */
export const KIND_META: Record<AnnouncementKind, { label: string; emoji: string; accent: "lime" | "pink" }> = {
  update: { label: "App update", emoji: "🚀", accent: "lime" },
  promotion: { label: "Promotion", emoji: "🎉", accent: "pink" },
  event: { label: "Event", emoji: "📅", accent: "pink" },
  reminder: { label: "Reminder", emoji: "⏰", accent: "pink" },
  contest: { label: "Contest", emoji: "🏆", accent: "lime" },
  general: { label: "Kopamate team", emoji: "📣", accent: "pink" },
};

export type Template = {
  key: string;
  kind: AnnouncementKind;
  name: string;
  hint: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
};

export const TEMPLATES: Template[] = [
  {
    key: "update",
    kind: "update",
    name: "App update",
    hint: "A new feature or improvement",
    title: "New on Kopamate: [feature]",
    body: "You can now [what it does]. Open it and give it a try.",
    buttonLabel: "Try it",
    buttonUrl: "/home",
  },
  {
    key: "promotion",
    kind: "promotion",
    name: "Promotion",
    hint: "A prize, bonus or giveaway",
    title: "Win ₦[amount] this week",
    body: "The top [number] inviters by Sunday night win [prize]. Share your link with corpers in your state.",
    buttonLabel: "Invite friends",
    buttonUrl: "/invite",
  },
  {
    key: "contest",
    kind: "contest",
    name: "Contest",
    hint: "A quiz challenge or competition",
    title: "[Contest name] starts [day]",
    body: "[How to take part]. Winners are announced on [date].",
    buttonLabel: "Play now",
    buttonUrl: "/quiz",
  },
  {
    key: "event",
    kind: "event",
    name: "Event",
    hint: "A meetup, CDS day or camp activity",
    title: "[Event] on [day]",
    body: "Corpers in [state], join us at [place] from [time].",
    buttonLabel: "",
    buttonUrl: "",
  },
  {
    key: "reminder",
    kind: "reminder",
    name: "Reminder",
    hint: "A deadline or something to finish",
    title: "Don't forget: [thing]",
    body: "[What to do] before [deadline]. It only takes a minute.",
    buttonLabel: "Do it now",
    buttonUrl: "/profile",
  },
  {
    key: "blank",
    kind: "general",
    name: "Blank",
    hint: "Start from scratch",
    title: "",
    body: "",
    buttonLabel: "",
    buttonUrl: "",
  },
];
