import { Bone, CardSkeleton, LoadingLabel } from "@/components/Skeleton";

export default function QuizLoading() {
  return (
    <>
      <LoadingLabel label="Daily Quiz" />
      <div className="flex h-11 items-center justify-between">
        <Bone className="h-6 w-32 rounded-lg" />
        <Bone className="h-9 w-16 rounded-full" />
      </div>
      <CardSkeleton className="h-[340px]" />
    </>
  );
}
