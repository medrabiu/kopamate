import { Bone, LoadingLabel } from "@/components/Skeleton";

/** Same shape as the Profile header (cover, overlapping photo, name, stats, two buttons), so nothing jumps. */
export default function ProfileLoading() {
  return (
    <>
      <LoadingLabel label="Profile" />
      <div className="-mb-2 flex h-11 items-center justify-between">
        <h1 className="h-display text-[28px]">Profile</h1>
        <Bone className="size-7 rounded-full" />
      </div>
      <div className="flex flex-col">
        <Bone className="h-28 w-full rounded-3xl" />
        <div className="relative z-10 -mt-11 px-1">
          <div className="inline-block rounded-full border-4 border-bg bg-bg">
            <Bone className="size-[84px] rounded-full" />
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-2 px-1">
          <Bone className="h-7 w-32 rounded-lg" />
          <Bone className="h-4 w-20 rounded-md" />
          <Bone className="h-4 w-52 rounded-md" />
          <Bone className="mt-1 h-4 w-64 rounded-md" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Bone className="h-10 rounded-full" />
          <Bone className="h-10 rounded-full" />
        </div>
      </div>
    </>
  );
}
