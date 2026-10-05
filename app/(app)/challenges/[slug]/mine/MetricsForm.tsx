"use client";

import { useActionState, useState } from "react";
import { submitMetrics, type ChallengeFormState } from "@/app/actions/challenges";
import { FormError } from "@/components/forms";

/** Scales a screenshot down (max 1400px, under ~450 KB) and re-saves it as JPEG on the phone. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= 450 * 1024) return blob;
    }
    throw new Error("too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  slug: string;
  entryId: number;
  initial: { views: number | null; likes: number | null; comments: number | null; shares: number | null };
  hasStats: boolean;
};

/** "Add your post stats": numbers from the post's analytics and a screenshot. Optional; the team uses it when judging. */
export default function MetricsForm({ slug, entryId, initial, hasStats }: Props) {
  const [state, action, pending] = useActionState<ChallengeFormState, FormData>(submitMetrics, undefined);
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotError, setShotError] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary h-11 text-sm">
        {hasStats ? "Update your post stats" : "Add your post stats"}
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        if (shot) fd.set("screenshot", shot, "stats.jpg");
        else fd.delete("screenshot");
        return action(fd);
      }}
      className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3.5"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="entry_id" value={entryId} />
      <p className="text-sm text-muted">From your post&apos;s analytics. Optional, but it helps us judge reach.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            ["views", "Views or impressions"],
            ["likes", "Likes"],
            ["comments", "Comments"],
            ["shares", "Shares"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{label}</span>
            <input name={name} inputMode="numeric" defaultValue={initial[name] ?? ""} required={name === "views"} className="field h-11" />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Screenshot of the stats{hasStats ? " (only if it changed)" : ""}</span>
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            setShotError("");
            setShot(null);
            if (!f) return;
            try {
              setShot(await shrink(f));
            } catch {
              setShotError("That picture couldn't be used. Try another screenshot.");
            }
          }}
          className="text-sm"
        />
      </label>
      <FormError message={shotError || state?.error} />
      {state?.ok && (
        <p role="status" className="text-sm font-bold text-lime-ink">
          Saved. Thanks!
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary h-12 text-[15px]">
        {pending ? "Saving…" : "Save stats"}
      </button>
    </form>
  );
}
