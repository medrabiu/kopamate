import { needFor } from "./needs-meta";
import type { BusinessType } from "./types";

/** Who pays for a purchase: the buyer's wallet (needs), or their business (supplies and B2B services). */
export type BuyMode = "need" | "supply" | "service";

/** What buying from this seller means for this buyer, or why they can't. */
export function buyMode(seller: BusinessType, buyerType: BusinessType | null): BuyMode | null {
  if (seller.kind === "b2b") return buyerType ? "service" : null;
  if (seller.kind === "supplier") return buyerType?.supply_type === seller.slug ? "supply" : null;
  if (seller.sells_supply && buyerType?.supply_type === seller.slug) return "supply";
  return seller.need_key ? "need" : null;
}

/** B2B services: what a carpenter's piece, a creator's campaign or a mechanic's job does for the buyer. */
export const SERVICE_EFFECT: Record<string, string> = {
  content_creator: "+5% customers for 7 days",
  carpenter: "+0.1 to your rating",
  mechanic: "+10% capacity for 3 days",
};


export type Offer = { title: string; unit: string; cta: string; payNote: string; multi: boolean };

/** What a shop offers this viewer today, and why they can't buy it (or null when they can). */
export function offerFor(
  seller: BusinessType,
  viewerType: BusinessType | null,
  o: { isMine: boolean; sameState: boolean; viewerState: string | null; unitName: string; slots: boolean },
): { mode: BuyMode | null; offer: Offer; why: string | null } {
  const mode = o.isMine ? null : buyMode(seller, viewerType);
  const need = seller.need_key ? needFor(seller.need_key) : null;
  const offer: Offer =
    seller.kind === "supplier" || mode === "supply"
      ? { title: `${seller.kind === "supplier" ? seller.name : "Supplies"} · 1 lot`, unit: " a lot", cta: "Order for my shop", payNote: "Paid from your business cash.", multi: true }
      : seller.kind === "b2b"
        ? { title: `1 ${o.unitName} · ${SERVICE_EFFECT[seller.slug] ?? ""}`, unit: "", cta: "Order", payNote: "Paid from your business cash.", multi: false }
        : {
            title: `1 ${o.unitName}${need ? ` · sorts your ${need.label.toLowerCase()}` : ""}`,
            unit: "",
            cta: o.slots ? "Book" : "Buy",
            payNote: "Paid from your wallet. Buying early just resets the timer.",
            multi: false,
          };
  const why = o.isMine
    ? "This is your business."
    : !o.sameState
      ? `You can buy from businesses in ${o.viewerState ?? "your state"} for now.`
      : !mode
        ? seller.kind === "supplier"
          ? `Only businesses that use ${seller.name.toLowerCase()} supplies can order here.`
          : seller.kind === "b2b"
            ? "Start a business to order this."
            : "Nothing here for you to buy."
        : null;
  return { mode, offer, why };
}
