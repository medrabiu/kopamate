import { Bone, CardSkeleton, LoadingLabel, TitleSkeleton } from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <>
      <LoadingLabel label="Home" />
      <div className="flex h-11 items-center justify-between">
        <TitleSkeleton />
        <Bone className="size-10 rounded-full" />
      </div>
      <CardSkeleton className="h-[300px]" />
      <div className="grid grid-cols-2 gap-3">
        <Bone className="h-[88px] rounded-[20px]" />
        <Bone className="h-[88px] rounded-[20px]" />
      </div>
      <Bone className="h-6 w-44 rounded-lg" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="size-[52px] shrink-0 rounded-full" />
        ))}
      </div>
    </>
  );
}
