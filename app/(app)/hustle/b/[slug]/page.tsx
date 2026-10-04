import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FollowButton from "@/components/FollowButton";
import { PersonButton } from "@/components/PersonSheet";
import BuyButton from "@/components/hustle/BuyButton";
import { BizLogo, Shopfront } from "@/components/hustle/BizArt";
import { ChevronLeft } from "@/components/icons";
import { sql } from "@/lib/db";
import { getBusinessByOwner, getType } from "@/lib/hustle/data";
import { availability, getReviews, getShop } from "@/lib/hustle/market";
import { needFor } from "@/lib/hustle/needs";
import { buyMode, SERVICE_EFFECT } from "@/lib/hustle/trade";
import { naira } from "@/lib/hustle/types";
import { requireUser } from "@/lib/session";
import { timeAgo } from "@/lib/util";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await getShop((await params).slug);
  return { title: shop?.name ?? "Shop" };
}

const TONE = { lime: "text-lime-ink", amber: "text-amber-ink", muted: "text-muted" } as const;
const BAND = { Bronze: "#d08a4a", Silver: "#b8c2cc", Gold: "#ffd166", Diamond: "#7fc4ff" } as const;

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const shop = await getShop(slug);
  if (!shop) notFound();
  const [reviews, mine, [follow]] = await Promise.all([
    getReviews(shop.id),
    getBusinessByOwner(sql, user.id),
    sql<{ following: boolean; follows_you: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = ${user.id} AND following_id = ${shop.owner_id}) AS following,
             EXISTS (SELECT 1 FROM follows WHERE follower_id = ${shop.owner_id} AND following_id = ${user.id}) AS follows_you
    `,
  ]);
  const myType = mine ? await getType(sql, mine.type_slug) : null;
  const sellerType = (await getType(sql, shop.type_slug))!;
  const isMine = shop.owner_id === user.id;
  const mode = isMine ? null : buyMode(sellerType, myType);
  const a = availability(shop);
  const need = shop.need_key ? needFor(shop.need_key) : null;
  const sameState = user.state === shop.state;

  const offer =
    shop.kind === "supplier" || mode === "supply"
      ? { title: `${sellerType.kind === "supplier" ? sellerType.name : "Supplies"} · 1 lot`, unit: " a lot", cta: "Order", pay: "Paid from your business cash." }
      : shop.kind === "b2b"
        ? { title: `1 ${shop.unit_name} · ${SERVICE_EFFECT[shop.type_slug] ?? ""}`, unit: "", cta: "Order", pay: "Paid from your business cash." }
        : { title: `1 ${shop.unit_name}${need ? ` · sorts your ${need.label.toLowerCase()}` : ""}`, unit: "", cta: shop.slots ? "Book" : "Buy", pay: "Paid from your wallet." };
  const why = isMine
    ? "This is your business."
    : !sameState
      ? `You can buy from businesses in ${user.state ?? "your state"} for now.`
      : !mode
        ? shop.kind === "supplier"
          ? `Only businesses that use ${sellerType.name.toLowerCase()} supplies can order here.`
          : shop.kind === "b2b"
            ? "Start a business to order this."
            : "Nothing here for you to buy."
        : null;

  return (
    <div className="-mx-5 -mt-5 flex flex-col">
      <div className="relative">
        <Shopfront color={shop.color} category={shop.category} height={120} />
        <Link href="/hustle/market" aria-label="Back to market" className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
          <ChevronLeft size={20} />
        </Link>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-6">
        <div className="flex items-end gap-3">
          <div className="relative -mt-8 shrink-0">
            <BizLogo icon={shop.icon} color={shop.color} size={68} ring />
          </div>
          <div className="min-w-0 pt-2">
            <h1 className="h-display truncate text-[22px] leading-tight">{shop.name}</h1>
            <p className="truncate text-[13px] text-muted">
              {shop.type_name} · {shop.state} · Stage {shop.stage} · ★ {shop.rating.toFixed(1)} ({shop.rating_count})
            </p>
          </div>
        </div>
        <p className="text-[15px] leading-snug">{shop.blurb}.</p>
        <div className="flex flex-wrap items-center gap-2">
          <PersonButton id={shop.owner_id} label={shop.owner} className="rounded-full bg-surface-2 px-2.5 py-1.5 text-xs font-bold">
            Run by {isMine ? "you" : shop.owner}
          </PersonButton>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1.5 text-xs font-bold">
            <span className="h-2 w-2 rounded-full" style={{ background: BAND[shop.band as keyof typeof BAND] }} aria-hidden="true" />
            {shop.band}
          </span>
          <span className={`rounded-full bg-surface-2 px-2.5 py-1.5 text-xs ${TONE[a.tone]}`}>{a.text}</span>
          {!isMine && (
            <span className="ml-auto">
              <FollowButton id={shop.owner_id} following={follow.following} followsYou={follow.follows_you} />
            </span>
          )}
        </div>

        <section className="flex flex-col gap-2.5" aria-labelledby="offers-title">
          <h2 id="offers-title" className="h-display text-lg">
            Today
          </h2>
          {shop.listing_id === null || shop.price === null ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">Closed today. Check back tomorrow.</p>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">{offer.title}</span>
                <span className="text-[13px] text-muted">
                  {naira(shop.price)}
                  {offer.unit}
                </span>
              </div>
              {why ? null : (
                <BuyButton
                  listingId={shop.listing_id}
                  shop={shop.name}
                  price={shop.price}
                  left={shop.left ?? 0}
                  label={offer.cta}
                  multi={mode === "supply"}
                  payNote={offer.pay}
                />
              )}
            </div>
          )}
          {why && <p className="text-xs text-faint">{why}</p>}
        </section>

        <section className="flex flex-col gap-2.5" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="h-display text-lg">
            Reviews
          </h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 rounded-2xl bg-surface-2 px-3.5 py-3">
                <span className="text-[13px] font-bold">
                  <span className="text-lime-ink">{"★".repeat(r.stars)}</span>
                  <span className="text-line">{"★".repeat(5 - r.stars)}</span> · {r.nickname}{" "}
                  <span className="font-normal text-faint">· {timeAgo(r.created_at)}</span>
                </span>
                {r.text && <span className="text-sm">{r.text}</span>}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
