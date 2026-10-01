// Kept apart from lib/util.ts (which uses Node's crypto) so client components can use it
// without pulling a crypto polyfill into the browser bundle.
const AVATAR_COLORS = ["#C6F432", "#FF4FA3", "#FFB547", "#8B7BFF", "#4FD1C5"];

/** Stable default-avatar colour picked from the user id. */
export function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
