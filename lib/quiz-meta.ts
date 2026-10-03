/** Quiz display helpers shared by server and client components. */

/** Per question: true right, false wrong, null ran out of time. */
export type Mark = boolean | null;

export const markEmoji = (m: Mark) => (m === true ? "🟩" : m === false ? "🟥" : "⬜");
