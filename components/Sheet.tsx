"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

type Props = { open: boolean; onClose: () => void; title: string; children: React.ReactNode };

/**
 * A small bottom sheet built on <dialog>, so focus, Escape and screen readers work without extra code.
 * Tapping outside the sheet closes it.
 */
export default function Sheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="sheet m-0 mx-auto mt-auto w-full max-w-[480px] rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="h-display text-xl leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center text-muted">
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
