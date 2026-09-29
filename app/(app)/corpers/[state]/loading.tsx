import { Bone, LoadingLabel } from "@/components/Skeleton";

export default function StateLoading() {
  return (
    <>
      <LoadingLabel label="corpers in this state" />
      <div className="h-11" />
      <div className="flex flex-col gap-2">
        <Bone className="h-9 w-40 rounded-xl" />
        <Bone className="h-5 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-[22px]">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Bone className="size-[72px] rounded-full" />
            <Bone className="h-4 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </>
  );
}
