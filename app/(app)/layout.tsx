import BottomNav from "@/components/BottomNav";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-5 pb-[112px] pt-5">{children}</main>
      <BottomNav />
    </>
  );
}
