import { Bone, CardSkeleton, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

export default function RewardsLoading() {
  return (
    <>
      <LoadingLabel label="Rewards" />
      <h1 className="h-display text-[28px]">Rewards</h1>
      <CardSkeleton className="h-[120px]" />
      <Bone className="h-6 w-40 rounded-lg" />
      <RowListSkeleton rows={2} />
    </>
  );
}
