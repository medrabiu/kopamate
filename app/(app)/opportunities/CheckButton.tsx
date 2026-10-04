"use client";

import { useFormStatus } from "react-dom";
import { checkForOpportunities } from "@/app/actions/opportunities";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary h-12 text-[15px]">
      {pending ? "Checking…" : "Check for new"}
    </button>
  );
}

/** Runs a fresh fetch from the opportunity sites and reloads the list. */
export default function CheckButton() {
  return (
    <form action={checkForOpportunities}>
      <Submit />
    </form>
  );
}
