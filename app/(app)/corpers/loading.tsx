import { Bone, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

export default function CorpersLoading() {
  return (
    <>
      <LoadingLabel label="Corpers" />
      <div className="flex flex-col gap-1">
        <h1 className="h-display text-[28px]">Corpers</h1>
        <Bone className="h-5 w-52 rounded-lg" />
      </div>
      <Bone className="h-12 w-full rounded-full" />
      <RowListSkeleton rows={8} />
    </>
  );
}
