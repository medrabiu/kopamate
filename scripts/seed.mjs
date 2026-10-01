// Fills the database with fake corpers so you can see the app with data.
// Seed accounts (is_seed) count toward totals and show in the Corpers lists, but never hold a
// position, never count as referrals and are never eligible for prizes.
// Never run this against the live database.
// Usage: npm run db:seed            (adds 100 fake users)
//        npm run db:seed -- 1000    (adds 1000)
//        npm run db:seed -- --no-photos   (without portraits)
// Also creates a demo login: WhatsApp 0803 000 0001, PIN 1234.
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { parseConnectionString } from "../lib/connection-string.mjs";
import bcrypt from "bcryptjs";
import { portrait } from "./portraits.mjs";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (/supabase|neon|amazonaws/.test(process.env.DATABASE_URL || "") && !process.argv.includes("--force")) {
  console.error("This looks like a hosted database. Seeding is for local testing only. Add --force if you're sure.");
  process.exit(1);
}

const count = Number(process.argv[2]) || 100;
// Every seed account gets an illustrated portrait unless --no-photos is passed.
const withPhotos = !process.argv.includes("--no-photos");
const sql = postgres({ ...parseConnectionString(process.env.DATABASE_URL), prepare: false, max: 1 });

const STATES = ["Lagos", "Enugu", "FCT", "Kano", "Oyo", "Rivers", "Kaduna", "Anambra", "Ogun", "Edo", "Delta", "Kwara", "Plateau", "Imo", "Osun", "Benue", "Ondo", "Akwa Ibom", "Cross River", "Niger"];
// Names with the portrait style they lean towards ("f"/"m"); it only steers hairstyle and accessories.
const NAMED = {
  f: ["Ada", "Nneka", "Ife", "Sade", "Zainab", "Hauwa", "Amaka", "Bisi", "Ngozi", "Kemi", "Aisha", "Chioma", "Funmi", "Halima", "Temi", "Adaeze", "Blessing", "Precious", "Maryam", "Ifeoma", "Tolu", "Esther", "Rukayat", "Ebun"],
  m: ["Tobi", "Kels", "Musa", "Emeka", "Uche", "Bayo", "Chidi", "Dayo", "Tunde", "Yusuf", "Obinna", "Segun", "Ibrahim", "Ikenna", "Femi", "Kunle", "Sani", "Chinedu", "Abdul", "Victor", "David", "Tayo", "Nnamdi", "Gbenga"],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// Weighted so a few states lead.
const weightedState = () => (Math.random() < 0.45 ? STATES[Math.floor(Math.random() * 4)] : pick(STATES));

try {
  const ids = [];
  const pinHash = await bcrypt.hash("1234", 10);

  const demo = await sql`SELECT id FROM users WHERE whatsapp_e164 = '+2348030000001'`;
  if (demo.length === 0) {
    const [row] = await sql`
      INSERT INTO users (nickname, whatsapp_e164, state, pin_hash, referral_code, signup_number, completed_at, created_at, is_seed)
      VALUES ('Ada', '+2348030000001', 'Enugu', ${pinHash}, 'ada001', nextval('signup_number_seq'), now() - interval '3 days', now() - interval '3 days', true)
      RETURNING id`;
    ids.push(row.id);
    console.log("Demo login: WhatsApp 0803 000 0001, PIN 1234");
  } else {
    ids.push(demo[0].id);
  }

  let added = 0;
  for (let i = 0; i < count; i++) {
    const look = Math.random() < 0.5 ? "f" : "m";
    const name = pick(NAMED[look]) + (Math.random() < 0.3 ? Math.floor(Math.random() * 99) : "");
    const minutesAgo = Math.floor(((count - i) / count) * 3 * 24 * 60);
    // About 40% of seeded users were invited by an earlier user (mostly by a few "top" referrers).
    // Seed referrals never count, so none of this puts seed accounts on a leaderboard.
    const referrer = ids.length > 5 && Math.random() < 0.4 ? (Math.random() < 0.5 ? ids[Math.floor(Math.random() * 5)] : pick(ids)) : null;
    const phone = "+23480" + String(10000000 + Math.floor(Math.random() * 89999999));
    const code = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) + Math.floor(Math.random() * 1e6);
    const pic = withPhotos ? await portrait(Math.floor(Math.random() * 2 ** 31), look) : null;
    const [row] = await sql`
      INSERT INTO users (nickname, whatsapp_e164, state, referral_code, referred_by, signup_number, completed_at, created_at, is_seed,
                         photo_data, photo_mime, photo_thumb_data, photo_thumb_mime, photo_version)
      VALUES (${name}, ${phone}, ${weightedState()}, ${code}, ${referrer}, nextval('signup_number_seq'),
              now() - ${minutesAgo} * interval '1 minute', now() - ${minutesAgo} * interval '1 minute', true,
              ${pic ? pic.photo.toString("base64") : null}, ${pic?.mime ?? null},
              ${pic ? pic.thumb.toString("base64") : null}, ${pic?.mime ?? null}, ${pic ? 1 : 0})
      ON CONFLICT DO NOTHING
      RETURNING id`;
    if (row) {
      ids.push(row.id);
      added++;
    }
  }
  console.log(`Added ${added} seed accounts${withPhotos ? " with portraits" : ""}.`);
} finally {
  await sql.end();
}
