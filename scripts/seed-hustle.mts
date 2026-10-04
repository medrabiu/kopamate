/**
 * Local testing only: gives seed accounts My Hustle businesses and opens today's shops, so the Market, shop
 * pages and leaderboards have something in them. Refuses to run on anything but localhost.
 * Usage: DATABASE_URL=postgres://localhost:5432/kopamate_dev npm run db:seed-hustle -- Enugu Kano
 */
const url = process.env.DATABASE_URL || "";
if (!/(localhost|127\.0\.0\.1)/.test(url) || /supabase|neon|amazonaws/.test(url)) {
  console.error("seed-hustle only runs against a local database (DATABASE_URL on localhost).");
  process.exit(1);
}
const { sql } = await import("../lib/db.ts");
const { startBusiness } = await import("../lib/hustle/business.ts");
const { getPlanContext, openDay } = await import("../lib/hustle/day.ts");
const { cardFor, getBusinessByOwner } = await import("../lib/hustle/data.ts");
const { BIZ_COLORS, TYPE_ICON } = await import("../lib/hustle/types.ts");
const { lagosDate } = await import("../lib/util.ts");

const states = process.argv.slice(2).length ? process.argv.slice(2) : ["Enugu", "Kano", "Lagos"];
const TYPES = ["buka", "barber", "salon", "laundry", "phone_repair", "pos_agent", "keke_rider", "crop_farm", "cosmetics_supplier", "carpenter", "content_creator", "cyber_cafe", "tailor", "suya_spot"];
const NAMES: Record<string, string> = {
  buka: "Kitchen", barber: "Cuts", salon: "Braids", laundry: "FreshFold", phone_repair: "Gadgets", pos_agent: "Quick Cash", keke_rider: "Rides",
  crop_farm: "Farm", cosmetics_supplier: "Beauty Supplies", carpenter: "Woodworks", content_creator: "Media", cyber_cafe: "Cyber Hub", tailor: "Stitches", suya_spot: "Suya",
};
let made = 0;
for (const state of states) {
  const people = await sql<{ id: string; nickname: string }[]>`
    SELECT u.id, u.nickname FROM users u WHERE u.is_seed AND u.state = ${state}
      AND NOT EXISTS (SELECT 1 FROM hustle_businesses b WHERE b.owner_user_id = u.id) ORDER BY u.created_at LIMIT ${TYPES.length}
  `;
  for (const [i, p] of people.entries()) {
    const type = TYPES[i % TYPES.length];
    const name = `${p.nickname.replace(/[^A-Za-z]/g, "").slice(0, 10) || "Corper"}'s ${NAMES[type]}`;
    const r = await startBusiness(p.id, state, { type, name, icon: TYPE_ICON[type] ?? "star", color: BIZ_COLORS[i % BIZ_COLORS.length] });
    if ("error" in r) {
      console.log(`  ${state} ${type}: ${r.error}`);
      continue;
    }
    made++;
  }
  // Open today's shop for everyone in the state who hasn't.
  const owners = await sql<{ owner_user_id: string }[]>`
    SELECT b.owner_user_id FROM hustle_businesses b JOIN users u ON u.id = b.owner_user_id
    WHERE b.state = ${state} AND u.is_seed AND NOT EXISTS (SELECT 1 FROM hustle_days d WHERE d.business_id = b.id AND d.day_date = ${lagosDate()} AND d.opened_at IS NOT NULL)
  `;
  for (const { owner_user_id } of owners) {
    const b = (await getBusinessByOwner(sql, owner_user_id))!;
    const ctx = await getPlanContext(b);
    const card = await cardFor(sql, b, ctx.date);
    const price = Math.min(ctx.bounds.max, Math.max(ctx.bounds.min, Math.round(ctx.refPrice * (0.9 + Math.random() * 0.25) / ctx.step) * ctx.step));
    const r = await openDay(owner_user_id, { units: ctx.capacity, price, card: card?.id ?? null, choice: card ? card.options.length - 1 : null });
    if ("error" in r) console.log(`  ${b.name}: ${r.error}`);
  }
  console.log(`${state}: ${people.length} new businesses, ${owners.length} shops opened`);
}
console.log(`Done: ${made} businesses.`);
await sql.end();
