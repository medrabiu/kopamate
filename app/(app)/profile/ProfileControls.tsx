"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { CameraIcon, CheckIcon } from "@/components/icons";
import IdCardGuide from "@/components/IdCardGuide";
import { PhoneInput, StateSelect } from "@/components/forms";
import {
  changePin,
  deleteAccount,
  removePhoto,
  requestVerification,
  toggleShowInList,
  updateField,
  uploadPhoto,
  type ProfileState,
} from "@/app/actions/profile";
import { logout } from "@/app/actions/auth";
import { getTheme, setTheme } from "@/lib/theme";

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
          <button type="button" onClick={() => setOpen(true)} className="py-2.5 text-sm font-bold text-lime-ink">
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
          {state?.error && <p className="text-sm text-pink-ink">{state.error}</p>}
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

async function resizeImage(file: File, max = 400, quality = 0.8): Promise<Blob> {
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
    let blob = await toBlob("image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", quality);
    if (!blob) throw new Error("Could not process photo");
    if (blob.size > 280 * 1024) blob = (await toBlob("image/jpeg", 0.6)) ?? blob;
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Scales a photo down to fit max×max (no cropping) and re-encodes it as JPEG, which also strips metadata. */
async function shrinkImage(file: File, max: number, maxBytes: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const toBlob = (q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    let blob = await toBlob(0.82);
    if (blob && blob.size > maxBytes) blob = await toBlob(0.6);
    if (!blob || blob.size > maxBytes) throw new Error("too large");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Verification = { status: "none" | "pending" | "verified" | "rejected"; note: string | null; stateCode: string | null };

/** Get verified for prizes: state code + a photo of the NYSC ID card, checked by an admin. */
export function VerificationCard({ status, note, stateCode }: Verification) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(requestVerification, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const cardFile = useRef<Blob | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (status === "verified") {
    return (
      <section id="verify" className="card flex items-center gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">
          <CheckIcon size={20} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Verified corper</div>
          <div className="text-sm text-muted">You can win prizes. State code {stateCode}</div>
        </div>
      </section>
    );
  }

  if (status === "pending" || state?.ok) {
    return (
      <section id="verify" className="card flex flex-col gap-1">
        <div className="font-bold">Checking your ID</div>
        <p className="text-sm leading-normal text-muted">
          We&apos;ve got your state code and ID card. We&apos;ll check them soon and your photo is deleted once we&apos;re done.
        </p>
      </section>
    );
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo of your ID card.");
    if (file.size > 15 * 1024 * 1024) return setError("That photo is over 15 MB. Try a smaller one.");
    setError(null);
    start(async () => {
      try {
        const blob = await shrinkImage(file, 1600, 850 * 1024);
        cardFile.current = blob;
        setPreview(URL.createObjectURL(blob));
      } catch {
        setError("Couldn't read that photo. Try another.");
      }
    });
  }

  function submit(fd: FormData) {
    if (!cardFile.current) return setError("Add a photo of your NYSC ID card.");
    fd.set("id_card", new File([cardFile.current], "id-card.jpg", { type: "image/jpeg" }));
    action(fd);
  }

  return (
    <section id="verify" className="card flex flex-col gap-3">
      <div>
        <h2 className="h-display text-xl">Get verified</h2>
        <p className="mt-1 text-sm leading-normal text-muted">
          Only verified corpers can win prizes. Add your state code and a clear photo of your NYSC ID card. Only our team sees it,
          and we delete the photo once we&apos;ve checked it.
        </p>
      </div>
      {status === "rejected" && note && (
        <p role="alert" className="rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink-ink">
          {note}
        </p>
      )}
      <form action={submit} className="flex flex-col gap-3">
        <label htmlFor="v-code" className="label">
          State code
        </label>
        <input
          id="v-code"
          name="state_code"
          defaultValue={stateCode ?? ""}
          maxLength={16}
          placeholder="EN/26B/1234"
          autoCapitalize="characters"
          required
          className="field"
        />
        <span className="label">NYSC ID card</span>
        {!preview && <IdCardGuide />}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[14px] border-[1.5px] border-dashed border-line p-3 text-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your ID card" className="max-h-48 rounded-lg object-contain" />
          ) : (
            <>
              <CameraIcon size={24} className="text-faint" />
              <span className="text-sm font-medium">{busy ? "Preparing photo…" : "Take or choose a photo"}</span>
            </>
          )}
          {preview && <span className="text-xs text-faint">Tap to change</span>}
          <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
        </label>
        {(error || state?.error) && <p className="text-sm text-pink-ink">{error || state?.error}</p>}
        <button type="submit" disabled={pending || busy} className="btn-primary h-12 text-[15px]">
          {pending ? "Sending…" : "Send for checking"}
        </button>
      </form>
    </section>
  );
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
        const [blob, thumb] = await Promise.all([resizeImage(file), resizeImage(file, 144, 0.75)]);
        const fd = new FormData();
        fd.append("photo", new File([blob], "photo", { type: blob.type }));
        fd.append("thumb", new File([thumb], "thumb", { type: thumb.type }));
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
          className="absolute -bottom-0.5 -right-0.5 flex size-10 items-center justify-center rounded-full border-[3px] border-bg bg-pink text-on-accent"
        >
          <CameraIcon size={18} strokeWidth={2.2} />
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>
      {pending && <p className="text-sm text-muted">Uploading…</p>}
      {error && <p className="text-sm text-pink-ink">{error}</p>}
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

function SwitchRow({
  id,
  title,
  hint,
  on,
  disabled,
  onToggle,
}: {
  id: string;
  title: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-surface-2 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div id={id} className="text-base font-medium">
          {title}
        </div>
        <div className="text-[13px] text-faint">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition-colors ${on ? "justify-end bg-lime" : "justify-start bg-surface-2"}`}
      >
        <span className={`size-6 rounded-full ${on ? "bg-on-accent" : "bg-faint"}`} />
      </button>
    </div>
  );
}

export function ShowInListToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <SwitchRow
      id="show-label"
      title="Show me in the Corpers list"
      hint="Others see your nickname and photo only"
      on={on}
      disabled={pending}
      onToggle={() => start(() => toggleShowInList())}
    />
  );
}

/** Saved in a cookie on this device, so it applies before sign-in and on every page. */
export function LightModeToggle({ initial }: { initial: boolean }) {
  const [light, setLight] = useState(initial);
  useEffect(() => setLight(getTheme() === "light"), []);
  return (
    <SwitchRow
      id="light-label"
      title="Light mode"
      hint="Saved on this device"
      on={light}
      onToggle={() => {
        const next = !light;
        setTheme(next ? "light" : "dark");
        setLight(next);
      }}
    />
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
          <button type="button" onClick={() => setOpen(true)} className="py-2.5 text-sm font-bold text-lime-ink">
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
          {state?.error && <p className="text-sm text-pink-ink">{state.error}</p>}
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
            <button type="submit" className="flex h-11 flex-1 items-center justify-center rounded-full bg-pink font-bold text-on-accent">
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
