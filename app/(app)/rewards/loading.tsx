import { Bone, CardSkeleton, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

/** Wallet card, tabs, then history rows: the same shape as the Rewards page. */
export default function RewardsLoading() {
  return (
    <>
      <LoadingLabel label="Rewards" />
      <h1 className="h-display text-[28px]">Rewards</h1>
      <CardSkeleton className="h-[170px]" />
      <Bone className="h-12 w-full rounded-full" />
      <RowListSkeleton rows={3} />
    </>
  );
}
