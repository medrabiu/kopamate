import Link from "next/link";
import Ring from "./Ring";
import CardShare from "./CardShare";

type Props = {
  answered: boolean;
  pct: number;
  done: number;
  total: number;
  /** The next step, or null at 100%. */
  next: { slug: string; title: string; campPack: boolean } | null;
  shareUrl: string;
  batchLabel: string;
};

/** Home, for people waiting for call-up or posted: their checklist progress and the next step. */
export default function PcmHomeCard({ answered, pct, done, total, next, shareUrl, batchLabel }: Props) {
  const ready = answered && !next;
  const title = !answered ? "Build your NYSC plan in 30 seconds" : ready ? "You're Camp Ready!" : `Next: ${next!.title}`;
  const href = !answered ? "/nysc-checklist#questions" : `/nysc-checklist#${next ? (next.campPack ? "camp-pack" : next.slug) : "my-plan"}`;
  const pill = "flex h-12 w-full items-center justify-center rounded-full bg-on-accent text-[15px] font-bold text-lime";

  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-lime p-5 text-on-accent" aria-label="Get camp-ready">
      <div className="flex items-center gap-4">
        <Ring pct={answered ? pct : 0} size={72} stroke={8} track="rgb(14 14 16 / 0.15)" color="#0e0e10">
          <span className="h-display text-lg leading-none">{answered ? pct : 0}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold tracking-wide uppercase opacity-70">Get camp-ready</span>
          <span className="h-display line-clamp-2 block text-[18px] leading-tight">{title}</span>
          {answered && (
            <span className="mt-0.5 block text-sm font-medium opacity-75">
              {done} of {total} steps done
            </span>
          )}
        </div>
      </div>
      {ready ? (
        <CardShare url={shareUrl} text={`I'm Camp Ready ✅ ${batchLabel}. Get your free personal NYSC checklist on Kopamate:`} className={pill} />
      ) : (
        <Link href={href} className={pill}>
          {answered ? "Continue my checklist" : "Start"}
        </Link>
      )}
    </section>
  );
}
