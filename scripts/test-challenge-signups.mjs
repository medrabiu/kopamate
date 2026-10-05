// Sign-up attribution and the "counts" rule for challenges, against a LOCAL database only.
// Everything runs in one transaction that is rolled back, so the database is left as it was.
// Usage: DATABASE_URL=postgres://…@localhost:5432/kopamate_dev npm run test:challenges
import assert from "node:assert/strict";
import postgres from "postgres";
import { countedSql, recordChallengeSignup } from "../lib/challenge-signups.ts";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at a local database (localhost).");
  process.exit(1);
}

const db = postgres(url, { max: 1, onnotice: () => {} });
const ROLLBACK = new Error("rollback");
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};

try {
  await db.begin(async (sql) => {
    const tag = Math.random().toString(36).slice(2, 8);
    const user = async (name, extra = {}) => {
      const [u] = await sql`
        INSERT INTO users (nickname, referral_code, completed_at, state, verification_status, verified_at)
        VALUES (${`t${tag}${name}`}, ${`t${tag}${name}`}, now(), 'Lagos', ${extra.verified ? "verified" : "none"}, ${extra.verified ? new Date() : null})
        RETURNING id
      `;
      return u.id;
    };
    const challenge = async (opens, closes, status = "open") => {
      const [c] = await sql`
        INSERT INTO challenges (slug, title, badge_name, prize_split, status, opens_at, closes_at)
        VALUES (${`t-${tag}-${Math.random().toString(36).slice(2, 6)}`}, 'Test', 'Test', '[]', ${status}, ${opens}, ${closes})
        RETURNING id
      `;
      return c.id;
    };
    const join = (cId, uId) => sql`INSERT INTO challenge_participants (challenge_id, user_id, x_handle) VALUES (${cId}, ${uId}, 'someone')`;
    const entry = async (cId, uId, code) => {
      const [e] = await sql`
        INSERT INTO challenge_entries (challenge_id, user_id, platform, post_url, format, entry_code)
        VALUES (${cId}, ${uId}, 'x', ${`https://x.com/a/status/${Math.floor(Math.random() * 1e12)}`}, 'video', ${code})
        RETURNING id
      `;
      return e.id;
    };
    const counted = async (cId, newUserId) => {
      const [r] = await sql`
        SELECT ${countedSql(sql)} AS counted FROM challenge_signups s
        JOIN users nu ON nu.id = s.new_user_id JOIN challenges c ON c.id = s.challenge_id
        WHERE s.challenge_id = ${cId} AND s.new_user_id = ${newUserId}
      `;
      return r?.counted ?? null;
    };
    const signupRow = async (cId, newUserId) =>
      (await sql`SELECT entry_id, referrer_user_id FROM challenge_signups WHERE challenge_id = ${cId} AND new_user_id = ${newUserId}`)[0];

    const hourAgo = new Date(Date.now() - 3_600_000);
    const inAWeek = new Date(Date.now() + 7 * 86_400_000);
    const open = await challenge(hourAgo, inAWeek);
    const referrer = await user("ref", { verified: true });
    const other = await user("oth", { verified: true });
    const outsider = await user("out", { verified: true });
    await join(open, referrer);
    await join(open, other);
    const code = `e${tag}`.slice(0, 7);
    const otherCode = `o${tag}`.slice(0, 7);
    const myEntry = await entry(open, referrer, code);
    await entry(open, other, otherCode);

    await check("sign-up through an entry link is credited to the person and the entry", async () => {
      const a = await user("a");
      assert.equal(await recordChallengeSignup(sql, { newUserId: a, referrerId: referrer, entryCode: code }), 1);
      const row = await signupRow(open, a);
      assert.equal(row.referrer_user_id, referrer);
      assert.equal(row.entry_id, myEntry);
    });

    await check("sign-up through the normal invite link is credited to the person, no entry", async () => {
      const b = await user("b");
      assert.equal(await recordChallengeSignup(sql, { newUserId: b, referrerId: referrer, entryCode: null }), 1);
      assert.equal((await signupRow(open, b)).entry_id, null);
    });

    await check("an entry code that isn't the referrer's own entry is ignored", async () => {
      const c = await user("c");
      await recordChallengeSignup(sql, { newUserId: c, referrerId: referrer, entryCode: otherCode });
      assert.equal((await signupRow(open, c)).entry_id, null);
    });

    await check("no cookie / a referrer who isn't in the challenge records nothing", async () => {
      const d = await user("d");
      assert.equal(await recordChallengeSignup(sql, { newUserId: d, referrerId: outsider, entryCode: null }), 0);
    });

    await check("self-referral records nothing", async () => {
      assert.equal(await recordChallengeSignup(sql, { newUserId: referrer, referrerId: referrer, entryCode: code }), 0);
    });

    await check("the same new user is only recorded once per challenge", async () => {
      const e = await user("e");
      assert.equal(await recordChallengeSignup(sql, { newUserId: e, referrerId: referrer, entryCode: code }), 1);
      assert.equal(await recordChallengeSignup(sql, { newUserId: e, referrerId: other, entryCode: otherCode }), 0);
      assert.equal((await signupRow(open, e)).referrer_user_id, referrer);
    });

    await check("outside the window (closed, not yet open, or not status open) records nothing", async () => {
      const ended = await challenge(new Date(Date.now() - 7 * 86_400_000), hourAgo);
      const later = await challenge(inAWeek, new Date(Date.now() + 14 * 86_400_000));
      const draft = await challenge(hourAgo, inAWeek, "draft");
      // Someone who is only in those three challenges, not the open one.
      const elsewhere = await user("els", { verified: true });
      for (const c of [ended, later, draft]) await join(c, elsewhere);
      const f = await user("f");
      assert.equal(await recordChallengeSignup(sql, { newUserId: f, referrerId: elsewhere, entryCode: null }), 0);
    });

    await check("a sign-up counts only once the new user is verified, by the deadline", async () => {
      const g = await user("g");
      await recordChallengeSignup(sql, { newUserId: g, referrerId: referrer, entryCode: code });
      assert.equal(await counted(open, g), false);
      await sql`UPDATE users SET verification_status = 'verified', verified_at = now() WHERE id = ${g}`;
      assert.equal(await counted(open, g), true);
      // Verified after verify_by: doesn't count.
      await sql`UPDATE challenges SET verify_by = now() - interval '1 minute' WHERE id = ${open}`;
      assert.equal(await counted(open, g), false);
      await sql`UPDATE challenges SET verify_by = NULL WHERE id = ${open}`;
      assert.equal(await counted(open, g), true);
    });

    await check("flagged, banned or voided sign-ups don't count", async () => {
      const h = await user("h", { verified: true });
      await recordChallengeSignup(sql, { newUserId: h, referrerId: referrer, entryCode: code });
      assert.equal(await counted(open, h), true);
      await sql`UPDATE users SET is_flagged = true WHERE id = ${h}`;
      assert.equal(await counted(open, h), false);
      await sql`UPDATE users SET is_flagged = false, is_banned = true WHERE id = ${h}`;
      assert.equal(await counted(open, h), false);
      await sql`UPDATE users SET is_banned = false WHERE id = ${h}`;
      await sql`UPDATE challenge_signups SET void_reason = 'test' WHERE new_user_id = ${h}`;
      assert.equal(await counted(open, h), false);
    });

    throw ROLLBACK;
  });
} catch (err) {
  if (err !== ROLLBACK) {
    console.error(err);
    process.exitCode = 1;
  }
} finally {
  await db.end();
}
console.log(`${passed} sign-up checks passed${process.exitCode ? ", then one failed" : ""}.`);
