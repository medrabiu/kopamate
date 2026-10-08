"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Avatar from "../Avatar";
import { saveAbout, setHiPolicy, unblock, type AboutState } from "@/app/actions/social";
import {
  BIO_MAX,
  COURSE_MAX,
  HI_POLICIES,
  HI_POLICY_LABEL,
  INTEREST_MAX,
  INTERESTS_MAX,
  LINK_KINDS,
  LINK_LABEL,
  OPEN_TO,
  OPEN_TO_LABEL,
  SCHOOL_MAX,
  SUGGESTED_INTERESTS,
  type HiPolicy,
  type Links,
} from "@/lib/social-rules";

export type About = {
  bio: string | null;
  school: string | null;
  course: string | null;
  interests: string[];
  open_to: string[];
  links: Links;
};

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-h-8 items-start gap-3">
      <span className="w-20 shrink-0 text-[15px] text-muted">{label}</span>
      <span className={`min-w-0 flex-1 text-right text-[15px] font-medium break-words ${value ? "" : "text-faint"}`}>{value || "Not added"}</span>
    </div>
  );
}

/** Profile → Settings → About you: shown as rows, edited in one form. Everything is optional and checked on the server. */
export function AboutYou({ about, schools }: { about: About; schools: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AboutState, FormData>(saveAbout, undefined);
  const [interests, setInterests] = useState<string[]>(about.interests);
  const [draft, setDraft] = useState("");
  const [openTo, setOpenTo] = useState<string[]>(about.open_to);
  const [bio, setBio] = useState(about.bio ?? "");
  // Every field is kept in state: after a failed save React resets uncontrolled inputs, which would lose typing.
  const [school, setSchool] = useState(about.school ?? "");
  const [course, setCourse] = useState(about.course ?? "");
  const [links, setLinks] = useState<Record<string, string>>(Object.fromEntries(LINK_KINDS.map((k) => [k, about.links[k] ?? ""])));

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const addInterest = (t: string) => {
    const v = t.trim().replace(/^#/, "").slice(0, INTEREST_MAX);
    if (!v || interests.length >= INTERESTS_MAX || interests.some((i) => i.toLowerCase() === v.toLowerCase())) return;
    setInterests([...interests, v]);
    setDraft("");
  };

  if (!open) {
    return (
      <section id="about" className="flex scroll-mt-5 flex-col gap-2 rounded-[20px] border border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold">About you</span>
          <button type="button" onClick={() => setOpen(true)} className="-my-2 py-2 pl-1 text-sm font-bold text-lime-ink">
            Edit
          </button>
        </div>
        <Row label="Bio" value={about.bio} />
        <Row label="School" value={about.school} />
        <Row label="Course" value={about.course} />
        <Row label="Interests" value={about.interests.join(", ")} />
        <Row label="Open to" value={about.open_to.map((o) => OPEN_TO_LABEL[o as keyof typeof OPEN_TO_LABEL] ?? o).join(", ")} />
        <Row label="Links" value={LINK_KINDS.filter((k) => about.links[k]).map((k) => LINK_LABEL[k]).join(", ")} />
        {state?.ok && (
          <p role="status" className="text-sm text-lime-ink">
            Saved.
          </p>
        )}
      </section>
    );
  }

  return (
    <form id="about" action={action} className="flex scroll-mt-5 flex-col gap-4 rounded-[20px] border border-line px-4 py-4">
      <span className="font-bold">About you</span>

      <label className="flex flex-col gap-1.5">
        <span className="label">Bio</span>
        <textarea name="bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))} rows={3} className="field h-auto py-3" placeholder="Hi, I'm Ada. Corper in Lagos, into design and food." />
        <span className="text-right text-xs text-faint">
          {bio.length}/{BIO_MAX} · no links here (add them below)
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label">School</span>
        <input name="school" value={school} onChange={(e) => setSchool(e.target.value)} maxLength={SCHOOL_MAX} list="school-list" className="field" placeholder="University of Lagos" autoComplete="off" />
        <datalist id="school-list">
          {schools.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label">Course</span>
        <input name="course" value={course} onChange={(e) => setCourse(e.target.value)} maxLength={COURSE_MAX} className="field" placeholder="Computer Science" autoComplete="off" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Interests (up to {INTERESTS_MAX})</legend>
        {interests.map((i) => (
          <input key={i} type="hidden" name="interests" value={i} />
        ))}
        <div className="flex flex-wrap gap-2">
          {interests.map((i) => (
            <button key={i} type="button" onClick={() => setInterests(interests.filter((x) => x !== i))} className="rounded-full bg-lime px-3 py-1.5 text-sm font-bold text-on-accent" aria-label={`Remove ${i}`}>
              {i} ✕
            </button>
          ))}
        </div>
        {interests.length < INTERESTS_MAX && (
          <>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addInterest(draft);
                  }
                }}
                maxLength={INTEREST_MAX}
                className="field h-11"
                placeholder="Add your own"
                aria-label="Add an interest"
              />
              <button type="button" onClick={() => addInterest(draft)} className="h-11 shrink-0 rounded-full border border-line px-4 text-sm font-bold">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_INTERESTS.filter((s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase())).map((s) => (
                <button key={s} type="button" onClick={() => addInterest(s)} className="rounded-full border border-line px-3 py-1 text-[13px] text-muted">
                  + {s}
                </button>
              ))}
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Open to</legend>
        <div className="flex flex-wrap gap-2">
          {OPEN_TO.map((o) => {
            const on = openTo.includes(o);
            return (
              <label key={o} className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm font-bold ${on ? "border-lime bg-lime text-on-accent" : "border-line"}`}>
                <input
                  type="checkbox"
                  name="open_to"
                  value={o}
                  checked={on}
                  onChange={() => setOpenTo(on ? openTo.filter((x) => x !== o) : [...openTo, o])}
                  className="sr-only"
                />
                {OPEN_TO_LABEL[o]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Links (your handle or a link)</legend>
        {LINK_KINDS.map((k) => (
          <label key={k} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm font-bold">{LINK_LABEL[k]}</span>
            <input
              name={`link_${k}`}
              value={links[k]}
              onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value }))}
              maxLength={200}
              placeholder={k === "website" ? "https://…" : k === "linkedin" ? "linkedin.com/in/you" : "@yourhandle"}
              autoCapitalize="none"
              autoCorrect="off"
              className="field h-11"
            />
          </label>
        ))}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-pink-ink">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-12 text-[15px]">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary h-12 text-[15px]">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/** "Who can say hi to me": Everyone, People I follow, or No one. */
export function HiPolicyRow({ policy }: { policy: HiPolicy }) {
  const [value, setValue] = useState(policy);
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-14 items-center gap-3 px-4 py-3">
      <span className="flex-1 text-[15px]">Who can say hi to me</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as HiPolicy;
          const prev = value;
          setValue(next);
          start(async () => {
            const r = await setHiPolicy(next);
            if (!r.ok) setValue(prev);
          });
        }}
        className="h-10 rounded-full border border-line bg-bg px-3 text-sm font-bold"
      >
        {HI_POLICIES.map((p) => (
          <option key={p} value={p}>
            {HI_POLICY_LABEL[p]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** People you've blocked, with Unblock. */
export function BlockedList({ people }: { people: { id: string; nickname: string; photo_version: number }[] }) {
  const [list, setList] = useState(people);
  const [pending, start] = useTransition();
  if (list.length === 0) return <p className="px-4 py-3 text-sm text-muted">You haven&apos;t blocked anyone.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
          <Avatar id={p.id} nickname={p.nickname} photoVersion={p.photo_version} size={36} />
          <span className="min-w-0 flex-1 truncate font-medium">{p.nickname}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await unblock(p.id);
                if (r.ok) setList((l) => l.filter((x) => x.id !== p.id));
              })
            }
            className="h-9 rounded-full border border-line px-3.5 text-sm font-bold"
          >
            Unblock
          </button>
        </li>
      ))}
    </ul>
  );
}
