"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitEntry, type ChallengeFormState } from "@/app/actions/challenges";
import CopyLink from "@/components/challenges/CopyLink";
import { FormError } from "@/components/forms";
import { FORMAT_LABEL, FORMATS } from "@/lib/challenge-rules";

type Props = {
  slug: string;
  /** A free code for this entry's link, so it can be copied into the post before submitting. */
  code: string;
  appUrl: string;
  number: number;
  max: number;
  tag: string;
  hashtag: string | null;
};

/** Add a post: pick the format, copy this entry's link into the post, paste the post link, confirm. */
export default function EntryForm({ slug, code, appUrl, number, max, tag, hashtag }: Props) {
  const [state, action, pending] = useActionState<ChallengeFormState, FormData>(submitEntry, undefined);
  const [format, setFormat] = useState(state?.fields?.format ?? "");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      setFormat("");
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="entry_code" value={code} />
      <div>
        <h2 className="h-display text-xl">
          Entry {number} of {max}
        </h2>
        <p className="mt-0.5 text-sm text-muted">More entries = more chances. Each entry is looked at on its own.</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">What did you make?</legend>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <label
              key={f}
              className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm font-bold ${format === f ? "border-lime bg-lime text-on-accent" : "border-line"}`}
            >
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
              {FORMAT_LABEL[f]}
            </label>
          ))}
        </div>
      </fieldset>

      {format && (
        <div className="quiz-rise flex flex-col gap-2 rounded-2xl border border-lime p-3.5">
          <p className="text-sm font-bold">This entry&apos;s Kopamate link</p>
          <CopyLink url={`${appUrl}/c/${code}`} />
          <p className="text-sm text-muted">Put this link in your caption or bio. Everyone who joins through it counts for this entry.</p>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="label">Link to your post on X, TikTok or Instagram</span>
        <input
          name="post_url"
          type="url"
          inputMode="url"
          required
          defaultValue={state?.ok ? "" : state?.fields?.post_url}
          placeholder="https://www.tiktok.com/@you/video/…"
          className="field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label">Anything we should know? (optional)</span>
        <input name="note" maxLength={200} defaultValue={state?.ok ? "" : state?.fields?.note} className="field" />
      </label>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="label mb-2">Before you submit</legend>
        {[
          ["c_public", "My post is public"],
          ["c_tagged", `I tagged ${tag}`],
          ["c_link", "My Kopamate link is in the caption or bio"],
          ["c_original", "It's my own original work"],
        ].map(([name, label]) => (
          <label key={name} className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" name={name} required className="mt-0.5 size-5 shrink-0 accent-lime" />
            <span>{label}</span>
          </label>
        ))}
        {hashtag && <p className="text-sm text-faint">Tip: {hashtag} is welcome but optional.</p>}
      </fieldset>

      <FormError message={state?.error} />
      {state?.ok && (
        <p role="status" className="rounded-2xl border border-lime px-4 py-3 text-sm">
          Entry added 🎉 We&apos;ll check it soon.
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Adding…" : "Submit entry"}
      </button>
    </form>
  );
}
