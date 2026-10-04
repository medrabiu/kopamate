import { LockIcon } from "./icons";

/** Made-up sample cards behind the blur: nothing real, nothing to tap. */
const SAMPLES = [
  { tag: "Jobs", dot: "#C6F432", title: "Graduate Trainee, Lagos", meta: "Full-time · Closes 31 Oct" },
  { tag: "Scholarships", dot: "#FFB547", title: "Fully funded Master's for young Africans", meta: "Closes 15 Nov" },
  { tag: "Internships", dot: "#4FD1C5", title: "Tech internship for NYSC members", meta: "Remote · Closes 20 Nov" },
];

/**
 * Opportunities is coming soon: people will find jobs and scholarships and apply without leaving Kopamate.
 * Until then this shows a blurred preview with nothing that leads out of the app.
 * `page`: the taller version for /opportunities.
 */
export default function OpportunitiesTeaser({ page = false }: { page?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line">
      <div aria-hidden="true" className={`flex flex-col gap-2.5 p-4 blur-[6px] select-none ${page ? "" : "max-h-[200px]"}`}>
        {(page ? [...SAMPLES, ...SAMPLES] : SAMPLES).map((s, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[18px] border border-line p-3.5">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
              <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
              {s.tag}
            </span>
            <span className="font-bold">{s.title}</span>
            <span className="text-xs text-faint">{s.meta}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/40 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-lime-ink">
          <LockIcon size={20} />
        </span>
        <p className="h-display text-lg leading-tight">Coming soon</p>
        <p className="max-w-[280px] text-sm text-muted">Jobs, internships and scholarships you can apply for right here in Kopamate.</p>
      </div>
    </div>
  );
}
