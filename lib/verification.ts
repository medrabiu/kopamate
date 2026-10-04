/** Limits on verification requests, shared by the Profile page and the request action. */

/** At most this many requests per account; an admin can allow more ("Allow another try"). */
export const MAX_VERIFICATION_ATTEMPTS = 3;
/** Hours to wait after a rejection before sending again. */
export const VERIFICATION_RETRY_HOURS = 24;

/** Why someone can't send a verification request right now, or null if they can. */
export function verificationBlock(
  u: { verification_status: string; verification_attempts: number; verification_rejected_at: Date | string | null; nysc_stage: string },
  now = Date.now(),
): string | null {
  if (u.verification_status === "verified" || u.verification_status === "pending") return null;
  // Prizes are for serving corpers, so only they (and those heading to camp) can get verified.
  if (u.nysc_stage === "waiting") return "You can get verified once you're in camp and have your NYSC ID card.";
  if (u.nysc_stage === "served") return "Verification is for serving corpers, since prizes are for them.";
  if (u.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return "You've used all your verification tries. Message us on WhatsApp and we'll help you get verified.";
  }
  if (u.verification_status === "rejected" && u.verification_rejected_at) {
    const next = new Date(u.verification_rejected_at).getTime() + VERIFICATION_RETRY_HOURS * 3600_000;
    if (next > now) {
      const hours = Math.ceil((next - now) / 3600_000);
      return `You can try again in ${hours} ${hours === 1 ? "hour" : "hours"}. Use that time to get a clear photo of your ID card.`;
    }
  }
  return null;
}
