"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { CameraIcon } from "@/components/icons";
import { PhoneInput, StateSelect } from "@/components/forms";
import {
  changePin,
  deleteAccount,
  removePhoto,
  toggleShowInList,
  updateField,
  uploadPhoto,
  type ProfileState,
} from "@/app/actions/profile";
import { logout } from "@/app/actions/auth";

type FieldName = "nickname" | "whatsapp" | "state" | "state_code";

/** A profile row that opens an inline form when you tap Edit. */
export function EditableRow({
  field,
  label,
  display,
  value,
  muted,
  actionLabel = "Edit",
}: {
  field: FieldName;
  label: string;
  display: string;
  value: string;
  muted?: boolean;
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateField, undefined);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <div className="border-b border-surface-2 py-3">
      {!open ? (
        <div className="flex min-h-9 items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-faint">{label}</div>
            <div className={`truncate text-base font-medium ${muted ? "text-faint" : ""}`}>{display}</div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="py-2.5 text-sm font-bold text-lime">
            {actionLabel}
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-2.5">
          <input type="hidden" name="field" value={field} />
          <label htmlFor={`f-${field}`} className="text-[13px] text-faint">
            {label}
          </label>
          {field === "state" ? (
            <StateSelect id={`f-${field}`} defaultValue={value} />
          ) : field === "whatsapp" ? (
            <PhoneInput id={`f-${field}`} defaultValue={value.replace("+234", "0")} />
          ) : (
            <input
              id={`f-${field}`}
              name="value"
              defaultValue={value}
              maxLength={field === "nickname" ? 20 : 16}
              placeholder={field === "state_code" ? "EN/26B/1234" : undefined}
              className="field"
              autoFocus
            />
          )}
          {state?.error && <p className="text-sm text-pink">{state.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary h-11 flex-1 text-[15px]">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11 flex-1 text-[15px]">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

async function resizeImage(file: File, max = 400): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    // Centre-crop to a square, then scale down.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(max, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
    let blob = await toBlob("image/webp", 0.8);
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.8);
    if (!blob) throw new Error("Could not process photo");
    if (blob.size > 280 * 1024) blob = (await toBlob("image/jpeg", 0.6)) ?? blob;
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoPicker({ id, nickname, photoVersion }: { id: string; nickname: string; photoVersion: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("That photo is over 5 MB. Try a smaller one.");
    setError(null);
    start(async () => {
      try {
        const blob = await resizeImage(file);
        const fd = new FormData();
        fd.append("photo", new File([blob], "photo", { type: blob.type }));
        const res = await uploadPhoto(fd);
        if (res?.error) setError(res.error);
      } catch {
        setError("Couldn't upload that photo. Try another.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className={pending ? "opacity-50" : ""}>
          <Avatar id={id} nickname={nickname} photoVersion={photoVersion} size={104} />
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={photoVersion > 0 ? "Change photo" : "Add a photo"}
          className="absolute -bottom-0.5 -right-0.5 flex size-10 items-center justify-center rounded-full border-[3px] border-bg bg-pink text-bg"
        >
          <CameraIcon size={18} strokeWidth={2.2} />
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>
      {pending && <p className="text-sm text-muted">Uploading…</p>}
      {error && <p className="text-sm text-pink">{error}</p>}
      {photoVersion > 0 && !pending && (
        <form action={removePhoto}>
          <button type="submit" className="text-xs text-faint underline">
            Remove photo
          </button>
        </form>
      )}
    </div>
  );
}

export function ShowInListToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div id="show-label" className="text-base font-medium">
          Show me in the Corpers list
        </div>
        <div className="text-[13px] text-faint">Others see your nickname and photo only</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="show-label"
        disabled={pending}
        onClick={() => start(() => toggleShowInList())}
        className={`flex h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition-colors ${on ? "justify-end bg-lime" : "justify-start bg-surface-2"}`}
      >
        <span className={`size-6 rounded-full ${on ? "bg-bg" : "bg-faint"}`} />
      </button>
    </div>
  );
}

export function ChangePinRow() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ProfileState, FormData>(changePin, undefined);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  return (
    <div className="border-b border-surface-2 py-3">
      {!open ? (
        <div className="flex min-h-9 items-center gap-3">
          <div className="flex-1">
            <div className="text-[13px] text-faint">PIN</div>
            <div className="text-base font-medium">{state?.ok ? "PIN changed" : "••••"}</div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="py-2.5 text-sm font-bold text-lime">
            Change
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-2.5">
          <label className="text-[13px] text-faint" htmlFor="pin-current">
            Current PIN
          </label>
          <input id="pin-current" name="current" type="password" inputMode="numeric" maxLength={4} required className="field tracking-[0.5em]" />
          <label className="text-[13px] text-faint" htmlFor="pin-next">
            New PIN
          </label>
          <input id="pin-next" name="next" type="password" inputMode="numeric" maxLength={4} required className="field tracking-[0.5em]" />
          {state?.error && <p className="text-sm text-pink">{state.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary h-11 flex-1 text-[15px]">
              Save
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11 flex-1 text-[15px]">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AccountActions() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-4">
      <form action={logout}>
        <button type="submit" className="btn-secondary">
          Log out
        </button>
      </form>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="text-center text-xs text-faint underline">
          Delete my account
        </button>
      ) : (
        <form action={deleteAccount} className="flex flex-col gap-2.5 rounded-2xl border border-pink/40 p-4">
          <label htmlFor="confirm" className="text-sm">
            This removes your account, position and referrals for good. Type <b>DELETE</b> to confirm.
          </label>
          <input id="confirm" name="confirm" autoComplete="off" className="field" />
          <div className="flex gap-2">
            <button type="submit" className="flex h-11 flex-1 items-center justify-center rounded-full bg-pink font-bold text-bg">
              Delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn-secondary h-11 flex-1">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
