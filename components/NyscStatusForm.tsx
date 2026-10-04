"use client";

import { useActionState, useEffect, useState } from "react";
import { updateNyscStatus, type ProfileState } from "@/app/actions/profile";
import { BatchPicker, Field, StageChips, StateSelect } from "./forms";
import { STATE_LABEL, stageLine, type Stage } from "@/lib/nysc";

type Props = {
  stage: Stage;
  batch: string | null;
  state: string | null;
  /** Awaiting call-up (or no state yet): the state can still be picked. */
  canPickState: boolean;
  submitLabel?: string;
  onDone?: () => void;
  onCancel?: () => void;
};

/** Stage chips, batch and (for someone just posted) state. Saves with updateNyscStatus. */
export function NyscStatusForm({ stage: initial, batch, state, canPickState, submitLabel = "Save", onDone, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>(initial);
  const [result, action, pending] = useActionState<ProfileState, FormData>(updateNyscStatus, undefined);
  useEffect(() => {
    if (result?.ok) onDone?.();
  }, [result, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <StageChips value={stage} onChange={setStage} />
      {stage !== "waiting" && (
        <BatchPicker key={stage === "served" ? "served" : "current"} stage={stage} defaultValue={batch} required={stage !== "served"} />
      )}
      {canPickState && (
        <Field label={STATE_LABEL[stage]} id="nysc-state">
          <StateSelect id="nysc-state" defaultValue={state ?? undefined} required={stage !== "waiting"} />
        </Field>
      )}
      {result?.error && <p className="text-sm text-pink-ink">{result.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary h-11 flex-1 text-[15px]">
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary h-11 flex-1 text-[15px]">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** Settings row: your NYSC status, with Edit opening the form in place. */
export function NyscStatusRow(props: Omit<Props, "onDone" | "onCancel" | "submitLabel">) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 py-3">
      {!open ? (
        <div className="flex min-h-8 items-center gap-3">
          <span className="shrink-0 text-[15px] text-muted">NYSC</span>
          <span className="min-w-0 flex-1 truncate text-right text-[15px] font-medium">{stageLine(props.stage, props.state, props.batch)}</span>
          <button type="button" onClick={() => setOpen(true)} className="-my-2 py-2 pl-1 text-sm font-bold text-lime-ink">
            Edit
          </button>
        </div>
      ) : (
        <NyscStatusForm {...props} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      )}
    </div>
  );
}

/** Home, once, for people who joined before NYSC stages existed: confirm where you are and your batch. */
export function ConfirmStageCard(props: Omit<Props, "onDone" | "onCancel" | "submitLabel">) {
  return (
    <section className="card flex flex-col gap-4 border-[1.5px] border-lime" aria-labelledby="stage-title">
      <div className="flex flex-col gap-1">
        <h2 id="stage-title" className="h-display text-xl">
          Still serving?
        </h2>
        <p className="text-sm text-muted">Tell us where you are in NYSC so your profile and your state's League count are right. It takes a few seconds.</p>
      </div>
      <NyscStatusForm {...props} submitLabel="Confirm" />
    </section>
  );
}
