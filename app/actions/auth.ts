"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/session";
import { normalizeNigerianPhone, validatePin, validateUsername } from "@/lib/validate";
import { isState } from "@/lib/states";
import { isStage, STATE_LABEL } from "@/lib/nysc";
import {
  currentIpHash,
  ipLimited,
  isUniqueViolation,
  isUsernameViolation,
  creditChallenges,
  followFromCookie,
  referrerFromCookie,
  uniqueReferralCode,
  usernameTaken,
  usernameTakenError,
  whatsappTaken,
} from "@/lib/signup";
import { track } from "@/lib/stats";
import { checkAutoBadges } from "@/lib/badges";
import { notifyFriendJoined } from "@/lib/push";
import { giveFreeze } from "@/lib/streaks";
import { MAX_PIN_ATTEMPTS, PIN_LOCK_MINUTES } from "@/lib/config";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

function fieldsOf(fd: FormData, names: string[]) {
  return Object.fromEntries(names.map((n) => [n, String(fd.get(n) ?? "")]));
}

/** Sign up with phone number + PIN. */
export async function signupWithPhone(_prev: FormState, fd: FormData): Promise<FormState> {
  const fields = fieldsOf(fd, ["nickname", "whatsapp", "stage", "state"]);
  const nick = validateUsername(fields.nickname);
  if (!nick.ok) return { error: nick.error, fields };
  if (await usernameTaken(nick.value)) return { error: await usernameTakenError(nick.value), fields };
  const phone = normalizeNigerianPhone(fields.whatsapp);
  if (!phone) return { error: "Enter a valid Nigerian WhatsApp number.", fields };
  const stage = isStage(fields.stage) ? fields.stage : "serving";
  if (!isState(fields.state)) return { error: `Choose the ${STATE_LABEL[stage].toLowerCase()}.`, fields };
  const pin = String(fd.get("pin") ?? "");
  if (!validatePin(pin)) return { error: "Your PIN must be 4 digits.", fields };

  const ipHash = await currentIpHash();
  if (await ipLimited(ipHash)) {
    return { error: "Too many sign-ups from this network. Try again in an hour.", fields };
  }
  if (await whatsappTaken(phone)) {
    return { error: "This number already has an account. Log in instead.", fields };
  }

  const referrer = await referrerFromCookie();
  const code = await uniqueReferralCode(nick.value);
  const pinHash = await bcrypt.hash(pin, 10);

  let userId: string;
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (nickname, whatsapp_e164, state, nysc_stage, stage_confirmed_at, pin_hash, referral_code, referred_by,
                         signup_number, completed_at, signup_ip_hash)
      VALUES (${nick.value}, ${phone}, ${fields.state}, ${stage}, now(), ${pinHash}, ${code}, ${referrer?.id ?? null},
              nextval('signup_number_seq'), now(), ${ipHash})
      RETURNING id
    `;
    userId = row.id;
  } catch (err) {
    if (isUsernameViolation(err)) return { error: await usernameTakenError(nick.value), fields };
    if (isUniqueViolation(err)) return { error: "This number already has an account. Log in instead.", fields };
    throw err;
  }

  await createSession(userId);
  await followFromCookie(userId);
  await track("signup_completed", userId, { method: "phone", referred: Boolean(referrer) });
  if (referrer) {
    await track("referral_completed", referrer.id, { referred: userId });
    await creditChallenges(userId, referrer.id);
    const freeze = await giveFreeze(referrer.id);
    after(() => notifyFriendJoined(referrer.id, nick.value, freeze));
  }
  // Early Corper for the new user; First Invite (and maybe Profile Complete) for whoever invited them.
  await checkAutoBadges([userId, referrer?.id]);
  revalidateTag("stats");
  redirect("/home?welcome=1");
}

/** Second step for Google users: WhatsApp number, nickname, NYSC stage and state. */
export async function finishSignup(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.completed_at) redirect("/home");

  const fields = fieldsOf(fd, ["nickname", "whatsapp", "stage", "state"]);
  const nick = validateUsername(fields.nickname);
  if (!nick.ok) return { error: nick.error, fields };
  if (await usernameTaken(nick.value, user.id)) return { error: await usernameTakenError(nick.value), fields };
  const phone = normalizeNigerianPhone(fields.whatsapp);
  if (!phone) return { error: "Enter a valid Nigerian WhatsApp number.", fields };
  const stage = isStage(fields.stage) ? fields.stage : "serving";
  if (!isState(fields.state)) return { error: `Choose the ${STATE_LABEL[stage].toLowerCase()}.`, fields };
  if (await whatsappTaken(phone, user.id)) {
    return { error: "This number is already used by another account.", fields };
  }

  const referrer = await referrerFromCookie(user.id);
  try {
    await sql`
      UPDATE users SET nickname = ${nick.value}, whatsapp_e164 = ${phone}, state = ${fields.state},
        nysc_stage = ${stage}, stage_confirmed_at = now(), referred_by = ${referrer?.id ?? null},
        signup_number = nextval('signup_number_seq'), completed_at = now()
      WHERE id = ${user.id} AND completed_at IS NULL
    `;
  } catch (err) {
    if (isUsernameViolation(err)) return { error: await usernameTakenError(nick.value), fields };
    if (isUniqueViolation(err)) return { error: "This number is already used by another account.", fields };
    throw err;
  }

  await followFromCookie(user.id);
  await track("signup_completed", user.id, { method: "google", referred: Boolean(referrer) });
  if (referrer) {
    await track("referral_completed", referrer.id, { referred: user.id });
    await creditChallenges(user.id, referrer.id);
    const freeze = await giveFreeze(referrer.id);
    after(() => notifyFriendJoined(referrer.id, nick.value, freeze));
  }
  await checkAutoBadges([user.id, referrer?.id]);
  revalidateTag("stats");
  redirect("/home?welcome=1");
}

/** Log in with phone number + PIN. */
export async function loginWithPhone(_prev: FormState, fd: FormData): Promise<FormState> {
  const fields = fieldsOf(fd, ["whatsapp"]);
  const phone = normalizeNigerianPhone(fields.whatsapp);
  const pin = String(fd.get("pin") ?? "");
  if (!phone || !validatePin(pin)) return { error: "Enter your WhatsApp number and 4-digit PIN.", fields };

  const rows = await sql<
    { id: string; pin_hash: string | null; is_banned: boolean; failed_pin_attempts: number; locked: boolean }[]
  >`
    SELECT id, pin_hash, is_banned, failed_pin_attempts,
           (pin_locked_until IS NOT NULL AND pin_locked_until > now()) AS locked
    FROM users WHERE whatsapp_e164 = ${phone}
  `;
  const u = rows[0];
  if (!u) return { error: "No account with that number. Sign up instead.", fields };
  if (u.is_banned) return { error: "This account has been suspended.", fields };
  if (!u.pin_hash) return { error: "This account uses Google. Continue with Google instead.", fields };
  if (u.locked) return { error: `Too many wrong PINs. Try again in ${PIN_LOCK_MINUTES} minutes.`, fields };

  const ok = await bcrypt.compare(pin, u.pin_hash);
  if (!ok) {
    const attempts = u.failed_pin_attempts + 1;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await sql`
        UPDATE users SET failed_pin_attempts = 0,
          pin_locked_until = now() + (${PIN_LOCK_MINUTES} * interval '1 minute')
        WHERE id = ${u.id}
      `;
      return { error: `Too many wrong PINs. Try again in ${PIN_LOCK_MINUTES} minutes.`, fields };
    }
    await sql`UPDATE users SET failed_pin_attempts = ${attempts} WHERE id = ${u.id}`;
    return { error: "Wrong PIN. Try again.", fields };
  }

  await sql`UPDATE users SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ${u.id}`;
  await createSession(u.id);
  // Came from someone's profile link? Follow them now that you're logged in.
  await followFromCookie(u.id);
  redirect("/home");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
