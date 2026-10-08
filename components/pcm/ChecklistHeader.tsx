import Link from "next/link";
import { LogoMark } from "../Logo";
import { APP_NAME } from "@/lib/config";

/** The NYSC checklist pages' header. The same for everyone (cached pages): the links swap via data-signed-in. */
export default function ChecklistHeader() {
  return (
        <header className="pcm-noprint sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[600px] items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="h-display text-lg">{APP_NAME}</span>
            </Link>
            {/* Swapped by ChecklistApp once it knows the visitor is signed in (data-signed-in on <html>). */}
            <nav className="pcm-when-out flex items-center gap-1.5">
              <Link href="/login" className="rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2">
                Log in
              </Link>
              <Link href="/join" className="rounded-full bg-lime px-4 py-2 text-[15px] font-bold text-on-accent">
                Join
              </Link>
            </nav>
            <nav className="pcm-when-in items-center">
              <Link href="/home" className="rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2">
                Open the app
              </Link>
            </nav>
          </div>
        </header>
  );
}
