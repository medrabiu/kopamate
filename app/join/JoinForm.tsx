"use client";

import { useActionState } from "react";
import { signupWithPhone, finishSignup, type FormState } from "@/app/actions/auth";
import { Divider, Field, FormError, GoogleButton, PhoneInput, PinInput, StageAndState, UsernameInput } from "@/components/forms";

export function PhoneSignupForm({ googleOn }: { googleOn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupWithPhone, undefined);
  const f = state?.fields ?? {};
  return (
    <div className="flex flex-col gap-5">
      {googleOn && (
        <>
          <GoogleButton />
          <Divider text="or sign up with your number" />
        </>
      )}
      <form action={action} className="flex flex-col gap-4">
        <FormError message={state?.error} />
        <Field label="Username" id="nickname">
          <UsernameInput defaultValue={f.nickname} />
        </Field>
        <Field label="WhatsApp number" id="whatsapp">
          <PhoneInput defaultValue={f.whatsapp} />
        </Field>
        <StageAndState defaultStage={f.stage} defaultState={f.state} />
        <Field label="Create a 4-digit PIN (to log in later)" id="pin">
          <PinInput />
        </Field>
        <p className="text-[13px] text-faint">You can add a photo and your state code later.</p>
        <button type="submit" disabled={pending} className="btn-primary mt-2">
          {pending ? "Creating your account…" : "Create my account"}
        </button>
      </form>
    </div>
  );
}

export function FinishForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(finishSignup, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="Username" id="nickname">
        <UsernameInput defaultValue={f.nickname ?? nickname} />
      </Field>
      <Field label="WhatsApp number" id="whatsapp">
        <PhoneInput defaultValue={f.whatsapp} autoFocus />
      </Field>
      <StageAndState defaultStage={f.stage} defaultState={f.state} />
      <button type="submit" disabled={pending} className="btn-primary mt-2">
        {pending ? "Finishing…" : "Finish"}
      </button>
    </form>
  );
}
