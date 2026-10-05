"use client";

import { useActionState, useState } from "react";
import { joinChallenge, type ChallengeFormState } from "@/app/actions/challenges";
import { FormError } from "@/components/forms";
import type { Participant } from "@/lib/challenges";

type Props = {
  slug: string;
  tags: { x?: string; tiktok?: string; instagram?: string };
  rules: string[];
  initial: Participant | null;
  /** Follow us buttons, rendered on the server. */
  follow: React.ReactNode;
};

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3.5">
      <h2 className="flex items-center gap-3 font-bold">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-lime text-on-accent" : "border border-line text-muted"}`}
          aria-hidden="true"
        >
          {done ? "✓" : n}
        </span>
        {title}
        {done && <span className="sr-only">(done)</span>}
      </h2>
      {children}
    </section>
  );
}

function Tick({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[15px]">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-lime" />
      <span>{label}</span>
    </label>
  );
}

/** Steps 2–4 of joining: handles and follows, WhatsApp Channel, rules. The server checks everything again. */
export default function JoinForm({ slug, tags, rules, initial, follow }: Props) {
  const [state, action, pending] = useActionState<ChallengeFormState, FormData>(joinChallenge, undefined);
  const f = state?.fields;
  const [handles, setHandles] = useState({
    x: f?.x_handle ?? initial?.x_handle ?? "",
    tiktok: f?.tiktok_handle ?? initial?.tiktok_handle ?? "",
    instagram: f?.instagram_handle ?? initial?.instagram_handle ?? "",
  });
  const [followX, setFollowX] = useState(initial?.confirmed_follow_x ?? false);
  const [followOther, setFollowOther] = useState(initial?.confirmed_follow_other ?? false);
  const [whatsapp, setWhatsapp] = useState(initial?.confirmed_whatsapp_channel ?? false);
  const [rulesOk, setRulesOk] = useState(Boolean(initial));
  const posting = handles.x.trim() || handles.tiktok.trim() || handles.instagram.trim();
  const needsOther = Boolean(handles.tiktok.trim() || handles.instagram.trim());
  const followDone = Boolean(posting) && followX && (!needsOther || followOther);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />

      <Step n={2} done={followDone} title="Follow us">
        {follow}
        <p className="text-sm text-muted">Your handles, for the accounts you&apos;ll post from (at least one):</p>
        {(
          [
            ["x", "X", "x_handle"],
            ["tiktok", "TikTok", "tiktok_handle"],
            ["instagram", "Instagram", "instagram_handle"],
          ] as const
        ).map(([key, label, name]) => (
          <label key={key} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm font-bold">{label}</span>
            <span className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted" aria-hidden="true">
                @
              </span>
              <input
                name={name}
                value={handles[key]}
                onChange={(e) => setHandles((h) => ({ ...h, [key]: e.target.value.replace(/^@+/, "") }))}
                placeholder="yourhandle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={60}
                className="field h-12 pl-8"
              />
            </span>
          </label>
        ))}
        <Tick name="follow_x" label={`I follow ${tags.x ?? "@kopamate"} on X`} checked={followX} onChange={setFollowX} />
        {needsOther && (
          <Tick
            name="follow_other"
            label={`I follow ${tags.tiktok ?? "@kopamate"} on ${[handles.tiktok.trim() && "TikTok", handles.instagram.trim() && "Instagram"].filter(Boolean).join(" and ")}`}
            checked={followOther}
            onChange={setFollowOther}
          />
        )}
      </Step>

      <Step n={3} done={whatsapp} title="Join our WhatsApp Channel">
        <p className="text-sm text-muted">Use the WhatsApp Channel button above, then tick:</p>
        <Tick name="whatsapp" label="I've joined the Kopamate WhatsApp Channel" checked={whatsapp} onChange={setWhatsapp} />
      </Step>

      <Step n={4} done={rulesOk} title="Accept the rules">
        <ul className="flex max-h-56 list-disc flex-col gap-2 overflow-y-auto rounded-2xl bg-surface-2 py-3 pr-3 pl-8 text-sm leading-relaxed text-muted">
          {rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <Tick name="rules" label="I've read and accept the rules" checked={rulesOk} onChange={setRulesOk} />
      </Step>

      <p className="text-xs text-muted">We can&apos;t see who follows us automatically, so we check finalists by hand. Ticking a box you haven&apos;t done disqualifies you.</p>
      <FormError message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Joining…" : initial ? "Save" : "I'm in"}
      </button>
    </form>
  );
}
