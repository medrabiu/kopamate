import { Bone, CardSkeleton, LoadingLabel, TitleSkeleton } from "@/components/Skeleton";

/** Header (streak, bell, photo), the quiz card, New from your state, then the three Explore tiles. */
export default function HomeLoading() {
  return (
    <>
      <LoadingLabel label="Home" />
      <div className="flex h-11 items-center justify-between">
        <TitleSkeleton />
        <div className="flex items-center gap-2">
          <Bone className="h-9 w-16 rounded-full" />
          <Bone className="size-10 rounded-full" />
          <Bone className="size-10 rounded-full" />
        </div>
      </div>
      <CardSkeleton className="h-[260px]" />
      <Bone className="h-6 w-44 rounded-lg" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="size-14 shrink-0 rounded-full" />
        ))}
      </div>
      <Bone className="h-6 w-24 rounded-lg" />
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Bone key={i} className="aspect-[4/3] rounded-[18px]" />
        ))}
      </div>
    </>
  );
}
