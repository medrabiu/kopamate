"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Sheet from "@/components/Sheet";
import { PersonButton } from "@/components/PersonSheet";
import { ChevronRight } from "@/components/icons";
import type { FriendBonus } from "@/lib/referral-bonus";
import { formatNgn } from "@/lib/reward-meta";

export type Friend = {
  id: string;
  nickname: string;
  photo_version: number;
  ago: string;
  verified: boolean;
  /** Their referral bonus status, when the bonus is on. */
  bonus?: FriendBonus;
};

function BonusTag({ bonus }: { bonus?: FriendBonus }) {
  if (!bonus || bonus.status === "none") return null;
  if (bonus.status === "earned") return <span className="text-xs font-bold text-lime-ink">+{formatNgn(bonus.amount ?? 0)}</span>;
  if (bonus.status === "paid") return <span className="text-xs text-muted">{formatNgn(bonus.amount ?? 0)} withdrawn</span>;
  return <span className="text-xs text-faint">Not verified yet</span>;
}

/** Overlapping avatars and the latest joiner; "See all" opens the full list in a sheet. */
export default function FriendsJoined({ friends }: { friends: Friend[] }) {
  const [open, setOpen] = useState(false);
  const [latest] = friends;
  const others = friends.length - 1;

  return (
    <section className="card flex flex-col gap-3 !p-[18px]" aria-labelledby="friends-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="friends-title" className="h-display text-lg">
          Friends who joined
        </h2>
        {friends.length > 0 && (
          <button type="button" onClick={() => setOpen(true)} className="-my-2 py-2 text-sm font-bold text-lime-ink">
            See all
          </button>
        )}
      </div>

      {latest ? (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-3 text-left">
          <span className="flex shrink-0">
            {friends.slice(0, 4).map((f, i) => (
              <Avatar
                key={f.id}
                id={f.id}
                nickname={f.nickname}
                photoVersion={f.photo_version}
                size={36}
                className={`ring-2 ring-surface ${i > 0 ? "-ml-2.5" : ""}`}
              />
            ))}
            {friends.length > 4 && (
              <span className="-ml-2.5 flex size-9 items-center justify-center rounded-full bg-surface-2 text-xs font-bold ring-2 ring-surface">
                +{friends.length - 4}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug">
            <span className="font-bold">{latest.nickname}</span>
            <span className="text-muted">
              {" "}
              joined {latest.ago.toLowerCase()}
              {others > 0 && ` · ${others} ${others === 1 ? "other" : "others"}`}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-faint" />
        </button>
      ) : (
        <p className="text-sm leading-normal text-muted">No one yet. Post your link on your WhatsApp Status to get your first friend in.</p>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={`Friends who joined · ${friends.length}`}>
        <ul className="-mt-1 max-h-[60vh] overflow-y-auto">
          {friends.map((f, i) => (
            <li key={f.id} className={i < friends.length - 1 ? "border-b border-line" : ""}>
              <PersonButton id={f.id} label={f.nickname} className="flex h-14 w-full items-center gap-3">
                <Avatar id={f.id} nickname={f.nickname} photoVersion={f.photo_version} size={40} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{f.nickname}</span>
                    {f.verified && <VerifiedBadge />}
                  </span>
                  <BonusTag bonus={f.bonus} />
                </span>
                <span className="shrink-0 text-[13px] text-faint">{f.ago}</span>
              </PersonButton>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}
