"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setHustlePreview } from "@/app/actions/hustle";
import { UI_SETTING_LABEL, UI_SETTINGS, type UiSetting } from "@/lib/hustle/ui-rules";

const SHORT: Record<UiSetting, string> = { graphical: "Graphical", text: "Text", graphical_only: "Graphical only" };

/** Admins only: "Viewing: Graphical ▾". Changes this admin's own view (a cookie), never what players see. */
export default function PreviewPill({ preview, global, fallback }: { preview: UiSetting | null; global: UiSetting; fallback: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end">
      <label className="relative flex h-8 items-center gap-1 rounded-full border border-line bg-surface-2 pl-3 pr-7 text-xs font-bold">
        <span className="text-muted">Viewing:</span>
        <span className={preview ? "text-amber-ink" : ""}>
          {SHORT[preview ?? global]}
          {/* Graphical for everyone, but this admin sees text: their own Lite mode, or Save-Data. */}
          {fallback && " · Lite"}
        </span>
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 text-muted">
          ▾
        </span>
        <select
          aria-label="Preview My Hustle as (only you see this)"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={preview ?? ""}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              await setHustlePreview(e.target.value || null);
              router.refresh();
            })
          }
        >
          <option value="">Everyone&apos;s setting ({UI_SETTING_LABEL[global]})</option>
          {UI_SETTINGS.map((m) => (
            <option key={m} value={m}>
              Preview: {UI_SETTING_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
