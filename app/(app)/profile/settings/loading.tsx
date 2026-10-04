import { Bone, LoadingLabel } from "@/components/Skeleton";

export default function SettingsLoading() {
  return (
    <>
      <LoadingLabel label="Settings" />
      <div className="flex h-11 items-center">
        <Bone className="h-6 w-28 rounded-lg" />
      </div>
      <Bone className="h-3 w-20 rounded-md" />
      <Bone className="h-[290px] w-full rounded-[20px]" />
      <Bone className="h-3 w-24 rounded-md" />
      <Bone className="h-[170px] w-full rounded-[20px]" />
    </>
  );
}
