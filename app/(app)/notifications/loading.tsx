import { Bone, LoadingLabel, RowListSkeleton } from "@/components/Skeleton";

export default function NotificationsLoading() {
  return (
    <>
      <LoadingLabel label="Notifications" />
      <div className="flex h-11 items-center">
        <Bone className="h-6 w-36 rounded-lg" />
      </div>
      <Bone className="-mt-1 h-12 w-full rounded-full" />
      <RowListSkeleton rows={6} />
    </>
  );
}
