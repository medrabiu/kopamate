import { Bone, LoadingLabel } from "@/components/Skeleton";

export default function OpportunitiesLoading() {
  return (
    <>
      <LoadingLabel label="Opportunities" />
      <div className="flex h-11 items-center">
        <Bone className="h-6 w-36 rounded-lg" />
      </div>
      <div className="-mt-1 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Bone key={i} className="h-[150px] w-full rounded-[20px]" />
      ))}
    </>
  );
}
