"use client";

import { useActionState } from "react";
import { loginWithPhone, type FormState } from "@/app/actions/auth";
import { Field, FormError, PhoneInput, PinInput } from "@/components/forms";

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginWithPhone, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error ?? initialError} />
      <Field label="WhatsApp number" id="whatsapp">
        <PhoneInput defaultValue={state?.fields?.whatsapp} />
      </Field>
      <Field label="PIN" id="pin">
        <PinInput autoComplete="current-password" />
      </Field>
      <button type="submit" disabled={pending} className="btn-primary mt-2">
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
