/** Badge display details shared by server and client components. */

export type BadgeInfo = { slug: string; name: string; description: string; icon: string; color: string };

/** Filled pill colours. Text on these fills is always dark (contrast checked in both themes). */
export const BADGE_FILL: Record<string, string> = {
  lime: "#C6F432",
  pink: "#FF4FA3",
  amber: "#FFB547",
  violet: "#8B7BFF",
  teal: "#4FD1C5",
};

export const badgeFill = (color: string) => BADGE_FILL[color] ?? BADGE_FILL.lime;

/** How to earn each badge, shown on locked badges. */
export const BADGE_HOW_TO: Record<string, string> = {
  early_corper: "Join before the Early Corper countdown ends.",
  profile_complete: "Finish every profile step.",
  first_invite: "Get a friend to join with your link.",
  prophet: "Coming soon: predict which state will have the most corpers.",
  state_ambassador: "Be the top referrer in your state when camp ends.",
};

export type StepKey = "photo" | "stateCode" | "friend";

/** Profile-completion steps, in order. Each is worth the same share of 100%. */
export const PROFILE_STEPS: { key: StepKey; label: string; action: string; href: string }[] = [
  { key: "photo", label: "Add a photo", action: "Add a photo", href: "/profile#photo" },
  { key: "stateCode", label: "Add your state code", action: "Add your state code", href: "/profile#verify" },
  { key: "friend", label: "Get your first friend to join with your link", action: "Invite a friend", href: "/invite" },
];
