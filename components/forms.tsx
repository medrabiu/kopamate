"use client";

import { STATES } from "@/lib/states";
import { ChevronDown } from "./icons";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink-ink">
      {message}
    </p>
  );
}

export function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function PhoneInput({ defaultValue, id = "whatsapp", autoFocus }: { defaultValue?: string; id?: string; autoFocus?: boolean }) {
  return (
    <div className="flex gap-2">
      <div className="flex h-13 items-center rounded-[14px] border border-line bg-surface px-3.5 font-medium">+234</div>
      <input
        id={id}
        name="whatsapp"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="803 123 4567"
        required
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        className="field"
      />
    </div>
  );
}

export function StateSelect({ defaultValue, id = "state" }: { defaultValue?: string; id?: string }) {
  return (
    <div className="relative">
      <select id={id} name="state" required defaultValue={defaultValue || ""} className="field appearance-none pr-10">
        <option value="" disabled>
          Choose your state
        </option>
        {STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={20} className="pointer-events-none absolute right-4 top-4 text-muted" />
    </div>
  );
}

export function PinInput({ id = "pin", name = "pin", autoComplete = "new-password" }: { id?: string; name?: string; autoComplete?: string }) {
  return (
    <input
      id={id}
      name={name}
      type="password"
      inputMode="numeric"
      pattern="\d{4}"
      maxLength={4}
      minLength={4}
      autoComplete={autoComplete}
      placeholder="••••"
      required
      className="field tracking-[0.5em]"
    />
  );
}

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <a
      href="/auth/google"
      className="flex h-13 items-center justify-center gap-2.5 rounded-full bg-ink font-bold text-bg transition-opacity hover:opacity-90"
    >
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-faint">
      <span className="h-px flex-1 bg-surface-2" />
      {text}
      <span className="h-px flex-1 bg-surface-2" />
    </div>
  );
}
