"use client";

import { useState } from "react";
import { STATES } from "@/lib/states";
import { BATCH_LETTERS, batchYears, parseBatch, STAGE_CHIP, STAGES, STATE_LABEL, type Stage } from "@/lib/nysc";
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

/** Username with an @ in front, like on X. Rules are checked again on the server (lib/validate.ts). */
export function UsernameInput({ defaultValue, autoFocus }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted" aria-hidden="true">
          @
        </span>
        <input
          id="nickname"
          name="nickname"
          required
          minLength={2}
          maxLength={20}
          pattern="@?[A-Za-z0-9_.]{2,20}"
          title="2 to 20 letters, numbers, _ or . (no spaces)"
          placeholder="ada_obi"
          defaultValue={defaultValue}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-describedby="username-hint"
          className="field pl-9"
        />
      </div>
      <p id="username-hint" className="text-[13px] text-faint">
        Letters, numbers, _ or . (no spaces). Only you can have it.
      </p>
    </>
  );
}

export function PhoneInput({ defaultValue, id = "whatsapp", autoFocus }: { defaultValue?: string; id?: string; autoFocus?: boolean }) {
  return (
    <div className="flex gap-2">
      <div className="flex h-13 items-center rounded-[14px] border border-line px-3.5 font-medium">+234</div>
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

export function StateSelect({ defaultValue, id = "state", required = true }: { defaultValue?: string; id?: string; required?: boolean }) {
  return (
    <div className="relative">
      <select id={id} name="state" required={required} defaultValue={defaultValue || ""} className="field appearance-none pr-10">
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

/** Where you are in NYSC, as four chips (one tap; "Serving" is picked already). Posts `stage`. */
export function StageChips({ value, onChange }: { value: Stage; onChange: (stage: Stage) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="label mb-1.5">Where are you in NYSC?</legend>
      <div className="grid grid-cols-2 gap-2">
        {STAGES.map((s) => (
          <label
            key={s}
            className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-line px-3 text-[15px] font-medium text-muted has-[:checked]:border-lime has-[:checked]:bg-lime/10 has-[:checked]:font-bold has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime"
          >
            <input type="radio" name="stage" value={s} checked={value === s} onChange={() => onChange(s)} className="sr-only" />
            {STAGE_CHIP[s]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Stage chips plus the state, whose label follows the stage ("State you're posted to"…). */
export function StageAndState({ defaultStage, defaultState }: { defaultStage?: string; defaultState?: string }) {
  const [stage, setStage] = useState<Stage>((STAGES as readonly string[]).includes(defaultStage ?? "") ? (defaultStage as Stage) : "serving");
  return (
    <>
      <StageChips value={stage} onChange={setStage} />
      <Field label={STATE_LABEL[stage]} id="state">
        <StateSelect defaultValue={defaultState} />
      </Field>
    </>
  );
}

const STREAMS = [
  ["", "Not sure"],
  ["1", "Stream I"],
  ["2", "Stream II"],
] as const;

/** Batch as year + letter + stream. Posts `batch_year`, `batch_letter` and `batch_stream`. */
export function BatchPicker({ stage, defaultValue, required }: { stage: Stage; defaultValue?: string | null; required?: boolean }) {
  const b = parseBatch(defaultValue);
  const select = "field appearance-none pr-8";
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="label mb-1.5">Batch{required ? "" : " (optional)"}</legend>
      <div className="grid grid-cols-3 gap-2">
        {[
          { name: "batch_year", label: "Year", value: b ? String(b.year) : "", options: batchYears(stage).map((y) => [String(y), String(y)]) },
          { name: "batch_letter", label: "Batch", value: b?.letter ?? "", options: BATCH_LETTERS.map((l) => [l, `Batch ${l}`]) },
        ].map((f) => (
          <div key={f.name} className="relative">
            <select name={f.name} aria-label={f.label} required={required} defaultValue={f.value} className={select}>
              <option value="">{f.label}</option>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-[17px] text-muted" />
          </div>
        ))}
        <div className="relative">
          <select name="batch_stream" aria-label="Stream" defaultValue={b?.stream ? String(b.stream) : ""} className={select}>
            {STREAMS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-[17px] text-muted" />
        </div>
      </div>
    </fieldset>
  );
}
