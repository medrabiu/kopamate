"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { CameraIcon, ChevronRight, ClockIcon, ShieldIcon } from "@/components/icons";
import IdCardGuide from "@/components/IdCardGuide";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/components/push-client";
import { PhoneInput } from "@/components/forms";
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

type FieldName = "nickname" | "full_name" | "whatsapp";

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
    <div className="px-4 py-3">
      {!open ? (
        <div className="flex min-h-8 items-center gap-3">
          <span className="shrink-0 text-[15px] text-muted">{label}</span>
          <span className={`min-w-0 flex-1 truncate text-right text-[15px] font-medium ${muted ? "text-faint" : ""}`}>{display}</span>
          <button type="button" onClick={() => setOpen(true)} className="-my-2 py-2 pl-1 text-sm font-bold text-lime-ink">
            {actionLabel}
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-2.5">
          <input type="hidden" name="field" value={field} />
          <label htmlFor={`f-${field}`} className="text-[13px] text-faint">
            {label}
          </label>
          {field === "whatsapp" ? (
            <PhoneInput id={`f-${field}`} defaultValue={value.replace("+234", "0")} />
          ) : (
            <input
              id={`f-${field}`}
              name="value"
              defaultValue={value}
              maxLength={field === "nickname" ? 20 : 60}
              placeholder={field === "full_name" ? "As on your NYSC ID card" : undefined}
              autoComplete={field === "full_name" ? "name" : "off"}
              autoCapitalize={field === "full_name" ? "words" : field === "nickname" ? "none" : undefined}
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

/**
 * A 64-bit difference hash: the photo shrunk to 9×8 greys, one bit per "is this pixel brighter than the next".
 * The same photo re-saved, resized or lightly cropped gives (nearly) the same hash, so the server can spot one
 * ID card photo used on several accounts without keeping the photo. Returned as 16 hex digits.
 */
function differenceHash(img: CanvasImageSource): string {
  const c = document.createElement("canvas");
  c.width = 9;
  c.height = 8;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 9, 8);
  const px = ctx.getImageData(0, 0, 9, 8).data;
  const grey = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  };
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (grey(x, y) > grey(x + 1, y) ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Scales a photo down to fit max×max (no cropping) and re-encodes it as JPEG, which also strips metadata.
 * Also returns the photo's difference hash.
 */
async function shrinkImage(file: File, max: number, maxBytes: number): Promise<{ blob: Blob; dhash: string }> {
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
    return { blob, dhash: differenceHash(img) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Verification = {
  status: "none" | "pending" | "verified" | "rejected";
  note: string | null;
  stateCode: string | null;
  fullName: string | null;
  /** The two letters their state's codes start with, for the placeholder (e.g. "LA"). */
  codePrefix: string | null;
  /** Why they can't send a new request right now (waiting after a rejection, or out of tries), if so. */
  blocked: string | null;
};

/** Get verified for prizes: full name, state code and a photo of the NYSC ID card, checked by an admin. */
export function VerificationCard({ status, note, stateCode, fullName, codePrefix, blocked }: Verification) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(requestVerification, undefined);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const cardFile = useRef<{ blob: Blob; dhash: string } | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Links to /profile#verify (Rewards, Home, the checklist) open the form straight away.
  const canSend = status === "none" || status === "rejected";
  useEffect(() => {
    if (!canSend) return;
    const check = () => {
      if (window.location.hash === "#verify" || window.location.hash === "#state-code") setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [canSend]);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (status === "verified") return null;

  if (status === "pending" || state?.ok) {
    return (
      <section id="verify" className="card flex scroll-mt-5 items-center gap-3.5 !p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lime-ink">
          <ClockIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Checking your ID</div>
          <div className="text-sm leading-snug text-muted">We&apos;ll check it soon, then delete the photo.</div>
        </div>
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
        const shrunk = await shrinkImage(file, 1600, 850 * 1024);
        cardFile.current = shrunk;
        setPreview(URL.createObjectURL(shrunk.blob));
      } catch {
        setError("Couldn't read that photo. Try another.");
      }
    });
  }

  function submit(fd: FormData) {
    if (!cardFile.current) return setError("Add a photo of your NYSC ID card.");
    fd.set("id_card", new File([cardFile.current.blob], "id-card.jpg", { type: "image/jpeg" }));
    fd.set("card_dhash", cardFile.current.dhash);
    action(fd);
  }

  return (
    <>
      <button
        id="verify"
        type="button"
        onClick={() => setOpen(true)}
        className="flex scroll-mt-5 items-center gap-3.5 rounded-[20px] border-[1.5px] border-lime px-4 py-3.5 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">
          <ShieldIcon size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{status === "rejected" ? "Verification needs another try" : "Get verified to win"}</span>
          <span className="block text-sm leading-snug text-muted">
            {status === "rejected" && note ? note : "Add your state code and NYSC ID card. Only verified corpers win prizes."}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-lime-ink" />
      </button>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          // Clear #verify so the same link opens the sheet again.
          if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
        }}
        title="Get verified"
      >
        <p className="-mt-1 text-sm leading-normal text-muted">
          Only our team sees your ID card, and we delete the photo once we&apos;ve checked it.
        </p>
        {status === "rejected" && note && (
          <p role="alert" className="rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink-ink">
            {note}
          </p>
        )}
        {blocked ? (
          <p className="rounded-2xl border border-line px-4 py-3 text-sm">{blocked}</p>
        ) : (
        <form action={submit} className="flex flex-col gap-3">
          <label htmlFor="v-name" className="label">
            Full name, as on your ID card
          </label>
          <input
            id="v-name"
            name="full_name"
            defaultValue={fullName ?? ""}
            maxLength={60}
            autoComplete="name"
            autoCapitalize="words"
            required
            className="field"
          />
          <label htmlFor="v-code" className="label">
            State code
          </label>
          <input
            id="v-code"
            name="state_code"
            defaultValue={stateCode ?? ""}
            maxLength={16}
            placeholder={`${codePrefix ?? "LA"}/26B/1234`}
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
        )}
      </Sheet>
    </>
  );
}

/** Avatar with a camera button. With a photo already, the button offers "Choose a new photo" or "Remove photo". */
export function PhotoPicker({ id, nickname, photoVersion, size = 76 }: { id: string; nickname: string; photoVersion: number; size?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const [toast, show] = useToast();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return show("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return show("That photo is over 5 MB. Try a smaller one.");
    start(async () => {
      try {
        const [blob, thumb] = await Promise.all([resizeImage(file), resizeImage(file, 144, 0.75)]);
        const fd = new FormData();
        fd.append("photo", new File([blob], "photo", { type: blob.type }));
        fd.append("thumb", new File([thumb], "thumb", { type: thumb.type }));
        const res = await uploadPhoto(fd);
        show(res?.error ?? "Photo updated");
      } catch {
        show("Couldn't upload that photo. Try another.");
      }
    });
  }

  return (
    <div className="relative shrink-0">
      <div className={pending ? "animate-pulse opacity-50" : ""}>
        <Avatar id={id} nickname={nickname} photoVersion={photoVersion} size={size} />
      </div>
      <button
        type="button"
        onClick={() => (photoVersion > 0 ? setMenu(true) : input.current?.click())}
        aria-label={photoVersion > 0 ? "Change photo" : "Add a photo"}
        disabled={pending}
        className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-[3px] border-surface bg-pink text-on-accent"
      >
        <CameraIcon size={15} strokeWidth={2.4} />
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Profile photo">
        <button
          type="button"
          onClick={() => {
            setMenu(false);
            input.current?.click();
          }}
          className="btn-primary h-12 text-[15px]"
        >
          Choose a new photo
        </button>
        <form action={removePhoto} onSubmit={() => setMenu(false)}>
          <button type="submit" className="btn-secondary h-12 text-[15px]">
            Remove photo
          </button>
        </form>
      </Sheet>
      {toast}
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
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div id={id} className="text-[15px] font-medium">
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
      hint="Others see your username and photo only"
      on={on}
      disabled={pending}
      onToggle={() => start(() => toggleShowInList())}
    />
  );
}

/** Push notifications for this browser: streak reminders, League results, friends joining. */
export function NotificationsToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<"loading" | "on" | "off" | "blocked" | "ios" | "unsupported">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const support = pushSupport();
    if (support !== "ok") return setState(support === "ios-install" ? "ios" : "unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    currentSubscription()
      .then((sub) => setState(sub && Notification.permission === "granted" ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  if (state === "unsupported") return null;
  const hint = {
    loading: "Streak reminders, League results, friends joining",
    on: "Streak reminders, League results, friends joining",
    off: "Streak reminders, League results, friends joining",
    blocked: "Blocked in your browser settings",
    ios: "Add Kopamate to your Home Screen first",
  }[state];

  return (
    <SwitchRow
      id="push-label"
      title="Notifications"
      hint={hint}
      on={state === "on"}
      disabled={busy || state === "loading" || state === "blocked" || state === "ios"}
      onToggle={async () => {
        setBusy(true);
        if (state === "on") {
          await disablePush();
          setState("off");
        } else {
          const r = await enablePush(publicKey);
          setState(r === "on" ? "on" : r === "denied" ? "blocked" : "off");
        }
        setBusy(false);
      }}
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
    <div className="px-4 py-3">
      {!open ? (
        <div className="flex min-h-8 items-center gap-3">
          <span className="shrink-0 text-[15px] text-muted">PIN</span>
          <span className="flex-1 text-right text-[15px] font-medium">{state?.ok ? "PIN changed" : "••••"}</span>
          <button type="button" onClick={() => setOpen(true)} className="-my-2 py-2 pl-1 text-sm font-bold text-lime-ink">
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

/** Admin link (admins only) and Log out in one card; "Delete my account" stays small underneath. */
export function AccountActions({ admin }: { admin: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="divide-y divide-line rounded-[20px] border border-line">
        {admin && (
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium">
            <span className="flex-1">Open admin</span>
            <ChevronRight size={18} className="text-faint" />
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className="w-full px-4 py-3.5 text-left text-[15px] font-bold text-pink-ink">
            Log out
          </button>
        </form>
      </div>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="self-center py-2 text-xs text-faint underline">
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

/** "3 Following" / "0 Followers" in your profile header (X style); tapping opens the list. */
export function FollowStat({ nickname, list, count }: { nickname: string; list: "followers" | "following"; count: number }) {
  const label = list === "followers" ? (count === 1 ? "Follower" : "Followers") : "Following";
  return (
    <Link href={`/u/@${nickname}/${list}`} className="hover:underline">
      <span className="font-bold">{new Intl.NumberFormat("en-NG").format(count)}</span> <span className="text-muted">{label}</span>
    </Link>
  );
}
