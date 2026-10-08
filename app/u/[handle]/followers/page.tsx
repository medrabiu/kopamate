import type { Metadata } from "next";
import FollowListPage from "@/components/social/FollowListPage";

export const metadata: Metadata = { title: "Followers", robots: { index: false, follow: false } };

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ page?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const [{ handle }, { page }] = await Promise.all([params, searchParams]);
  return <FollowListPage segment={handle} list="followers" page={Math.max(1, Math.min(1000, Number(page) || 1))} />;
}
