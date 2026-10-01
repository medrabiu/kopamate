import Countdown, { Deadline } from "./Countdown";
import { BadgeGlyph } from "./BadgeIcon";
import { ClockIcon } from "./icons";

type Props = {
  deadline: string;
  /** The signed-in user already holds the Early Corper badge. */
  hasBadge?: boolean;
  variant: "landing" | "home";
};

/**
 * Early Corper countdown. Disappears when the deadline passes (live, and on the server once it has).
 * Landing: a card above "Join now". Home: a slim banner above the carousel.
 */
export default function EarlyCorperBanner({ deadline, hasBadge, variant }: Props) {
  if (new Date(deadline).getTime() <= Date.now()) return null;

  if (variant === "landing") {
    return (
      <Deadline to={deadline}>
        <section className="flex flex-col gap-1 rounded-[20px] border-[1.5px] border-lime px-[18px] py-3.5" aria-label="Early Corper countdown">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-bold">
            <ClockIcon size={18} className="text-lime-ink" />
            Early Corper badge closes in
            <Countdown to={deadline} className="h-display text-lime-ink" />
          </p>
          <p className="text-sm text-muted">Early Corpers qualify for the first rewards drop.</p>
        </section>
      </Deadline>
    );
  }

  return (
    <Deadline to={deadline}>
      <section aria-label="Early Corper countdown" className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 text-sm">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">
          {hasBadge ? <BadgeGlyph icon="check" size={16} /> : <ClockIcon size={16} strokeWidth={2.6} />}
        </span>
        <p className="min-w-0 flex-1 leading-snug">
          {hasBadge ? (
            <>
              <span className="font-bold">You&apos;re an Early Corper</span>
              <span className="text-muted"> · first rewards drop when the countdown ends</span>
            </>
          ) : (
            <span className="font-bold">Early Corper badge closes in</span>
          )}
        </p>
        <Countdown to={deadline} className="h-display shrink-0 text-[15px] text-lime-ink" />
      </section>
    </Deadline>
  );
}
