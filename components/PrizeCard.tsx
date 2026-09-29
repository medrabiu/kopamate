import Link from "next/link";

export default function PrizeCard({ text, href }: { text: string; href?: string }) {
  const body = (
    <>
      <span className="h-display block text-lg text-pink">Prizes are coming</span>
      <span className="mt-1 block text-[15px] leading-relaxed">{text}</span>
    </>
  );
  const cls = "block rounded-[20px] border-[1.5px] border-pink px-[18px] py-4";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
