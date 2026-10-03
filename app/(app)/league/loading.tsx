import { Bone, CardSkeleton, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

export default function LeagueLoading() {
  return (
    <>
      <LoadingLabel label="State League" />
      <div className="flex h-11 items-center justify-between">
        <Bone className="h-6 w-36 rounded-lg" />
        <Bone className="h-4 w-24 rounded-lg" />
      </div>
      <CardSkeleton className="h-[240px]" />
      <Bone className="h-6 w-24 rounded-lg" />
      <RowListSkeleton rows={5} />
    </>
  );
}
