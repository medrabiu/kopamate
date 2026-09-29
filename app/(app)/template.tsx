/**
 * Re-mounts on every navigation inside the app, so each new page fades in briefly.
 * The animation is switched off for people who prefer reduced motion (globals.css).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-col gap-5">{children}</div>;
}
