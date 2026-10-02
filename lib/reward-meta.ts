/** Reward constants and formatting shared by server and client code (no database access). */

export const REWARD_KINDS = ["cash", "airtime", "data"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export const REWARD_STATUSES = ["hidden", "unclaimed", "claimed", "processing", "paid", "rejected"] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

export const KIND_LABEL: Record<RewardKind, string> = { cash: "Cash", airtime: "Airtime", data: "Data" };

export const STATUS_LABEL: Record<RewardStatus, string> = {
  hidden: "Hidden",
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  processing: "Processing",
  paid: "Paid",
  rejected: "Rejected",
};

/** Banks offered in the claim form. "Other" lets the user type the bank name. */
export const BANKS = [
  "Access",
  "Fidelity",
  "First Bank",
  "FCMB",
  "GTBank",
  "Kuda",
  "Moniepoint",
  "OPay",
  "PalmPay",
  "Polaris",
  "Stanbic IBTC",
  "Sterling",
  "UBA",
  "Union",
  "Wema",
  "Zenith",
] as const;

/** Largest amount accepted for one reward. */
export const MAX_REWARD_NGN = 10_000_000;

export function formatNgn(n: number) {
  return `₦${new Intl.NumberFormat("en-NG").format(n)}`;
}

/** Parses an admin-typed amount like "30,000" or "₦5000". Empty gives null; anything invalid gives NaN. */
export function parseAmount(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[₦,\s]/g, "");
  if (!s) return null;
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return n >= 1 && n <= MAX_REWARD_NGN ? n : NaN;
}

/** "GTBank ••••6789" for showing payout details without the full account number. */
export function maskAccount(bank: string | null, account: string | null) {
  if (!account) return bank ?? "";
  return `${bank ?? ""} ••••${account.slice(-4)}`.trim();
}
