import { OPEN_TO, OPEN_TO_LABEL, SUGGESTED_INTERESTS } from "@/lib/social-rules";

export type FilterValues = { school: string; interest: string; open: string };

/**
 * School, Interest and Open to filters as a plain GET form, so filtered views are in the address and can be
 * shared. `keep` carries other params (like the state page tab or the search text).
 */
export default function PeopleFilters({ action, values, keep = {}, schools }: { action: string; values: FilterValues; keep?: Record<string, string>; schools: string[] }) {
  const active = Boolean(values.school || values.interest || values.open);
  return (
    <details className="group rounded-2xl border border-line" open={active}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span>Filters{active ? " · on" : ""}</span>
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t border-line px-4 py-3">
        {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label className="flex flex-col gap-1 text-sm text-muted">
          School
          <input name="school" defaultValue={values.school} list="filter-schools" maxLength={80} className="field h-11" placeholder="Any school" autoComplete="off" />
          <datalist id="filter-schools">
            {schools.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Interest
            <input name="interest" defaultValue={values.interest} list="filter-interests" maxLength={24} className="field h-11" placeholder="Any" autoComplete="off" />
            <datalist id="filter-interests">
              {SUGGESTED_INTERESTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Open to
            <select name="open" defaultValue={values.open} className="field h-11">
              <option value="">Anything</option>
              {OPEN_TO.map((o) => (
                <option key={o} value={o}>
                  {OPEN_TO_LABEL[o]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="h-10 flex-1 rounded-full bg-lime text-sm font-bold text-on-accent">Apply</button>
          {active && (
            <a
              href={`${action}${Object.values(keep).some(Boolean) ? `?${new URLSearchParams(Object.entries(keep).filter(([, v]) => v))}` : ""}`}
              className="flex h-10 flex-1 items-center justify-center rounded-full border border-line text-sm font-bold"
            >
              Clear
            </a>
          )}
        </div>
      </form>
    </details>
  );
}

/** Reads filters from search params, keeping only valid values. */
export function readFilters(sp: Record<string, string | undefined>): FilterValues {
  const clip = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);
  const open = clip(sp.open, 20);
  return { school: clip(sp.school, 80), interest: clip(sp.interest, 24), open: (OPEN_TO as readonly string[]).includes(open) ? open : "" };
}
