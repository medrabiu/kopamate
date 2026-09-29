import { Bone, CardSkeleton, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

export default function InviteLoading() {
  return (
    <>
      <LoadingLabel label="Invite" />
      <div className="flex flex-col gap-1.5">
        <h1 className="h-display text-[28px]">Invite friends</h1>
        <Bone className="h-5 w-64 rounded-lg" />
      </div>
      <CardSkeleton className="h-[210px]" />
      <Bone className="h-6 w-48 rounded-lg" />
      <RowListSkeleton rows={3} />
    </>
  );
}
