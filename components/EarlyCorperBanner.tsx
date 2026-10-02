import Countdown, { Deadline } from "./Countdown";
import { ClockIcon } from "./icons";

/**
 * Landing: the Early Corper countdown card above "Join now".
 * Disappears when the deadline passes (live, and on the server once it has).
 */
export default function EarlyCorperBanner({ deadline }: { deadline: string }) {
  if (new Date(deadline).getTime() <= Date.now()) return null;
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
