import { Bone, CardSkeleton, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <>
      <LoadingLabel label="Profile" />
      <h1 className="h-display text-[28px]">Profile</h1>
      <div className="flex flex-col items-center gap-2.5">
        <Bone className="size-[104px] rounded-full" />
        <Bone className="h-7 w-32 rounded-lg" />
        <Bone className="h-4 w-48 rounded-md" />
      </div>
      <CardSkeleton className="h-[120px]" />
      <RowListSkeleton rows={4} />
    </>
  );
}
