"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Confetti from "./Confetti";
import { ChevronRight } from "./icons";
import { formatNgn } from "@/lib/reward-meta";

const SEEN_KEY = "km_seen_rewards";

type Props = {
  /** Unclaimed (revealed) rewards: confetti the first time each one is seen on this device. */
  unclaimedIds: string[];
  unclaimedTotal: number;
  hiddenCount: number;
  underReview: boolean;
};

/** Top of Home: "You won ₦X! Claim it", or a smaller note while an amount is still hidden. */
export default function RewardBanner({ unclaimedIds, unclaimedTotal, hiddenCount, underReview }: Props) {
  const [fire, setFire] = useState(false);
  const key = unclaimedIds.join(",");

  useEffect(() => {
    if (unclaimedIds.length === 0) return;
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
      if (unclaimedIds.some((id) => !seen.has(id))) {
        setFire(true);
        for (const id of unclaimedIds) seen.add(id);
        // Keep the list short: only the most recent ids matter.
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-50)));
      }
    } catch {
      // Storage blocked or corrupt: no confetti, nothing breaks.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (unclaimedIds.length > 0) {
    return (
      <>
        <Confetti fire={fire} />
        <Link href="/rewards#your-rewards" className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-lime px-[18px] py-4">
          <span className="min-w-0 flex-1">
            <span className="h-display block text-xl leading-tight text-lime-ink">🎉 You won {formatNgn(unclaimedTotal)}!</span>
            <span className="text-sm font-bold text-muted">{underReview ? "Your account is under review" : "Claim it"}</span>
          </span>
          <ChevronRight size={22} className="shrink-0 text-lime-ink" />
        </Link>
      </>
    );
  }

  if (hiddenCount > 0) {
    return (
      <Link href="/rewards#your-rewards" className="flex items-center gap-3 rounded-2xl border-[1.5px] border-lime px-3.5 py-2.5 text-sm">
        <span className="min-w-0 flex-1 font-bold">🎁 Reward coming, amount revealed soon</span>
        <ChevronRight size={18} className="shrink-0 text-lime-ink" />
      </Link>
    );
  }
  return null;
}
