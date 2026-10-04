/**
 * My Hustle checks against a LOCAL database: ledger totals, idempotent open/close, determinism, limits.
 * Usage: DATABASE_URL=postgres://localhost:5432/kopamate_dev npm run test:hustle
 * Refuses to run on anything but localhost. Creates its own test users and deletes them afterwards.
 */
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL || "";
if (!/@?(localhost|127\.0\.0\.1)(:\d+)?\//.test(url) && !/^postgres(ql)?:\/\/localhost/.test(url)) {
  console.error("hustle-test only runs against a local database (DATABASE_URL on localhost).");
  process.exit(1);
}

const { sql, transaction } = await import("../lib/db.ts");
const { startBusiness, validateBusinessName } = await import("../lib/hustle/business.ts");
const { openDay, closeThrough, getPlanContext } = await import("../lib/hustle/day.ts");
const { addDays, getBusinessByOwner, cardFor } = await import("../lib/hustle/data.ts");
const { creditTaskReward, payAllawee, transfer, lagosMonth, TASK_REWARDS } = await import("../lib/hustle/wallet.ts");
const { move, business, SYSTEM } = await import("../lib/hustle/ledger.ts");
const { seeded, townCustomers, withNoise, ratingFactor, scoreBand } = await import("../lib/hustle/engine.ts");
const { buyFromListing, buyBackup, submitReview, MAX_DAILY_FROM_SELLER } = await import("../lib/hustle/trade.ts");
const { getNeeds, firstDueDays } = await import("../lib/hustle/needs.ts");
const { lagosDate } = await import("../lib/util.ts");

const today = lagosDate();
let failures = 0;
const results: string[] = [];
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    results.push(`  ✗ ${name}\n      ${(err as Error).message.split("\n").join("\n      ")}`);
  }
}

// Test users, all in Kano. Phone numbers in a range the app never hands out.
const RUN = Date.now().toString().slice(-6);
async function makeUser(i: number) {
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (nickname, whatsapp_e164, state, completed_at, referral_code)
    VALUES (${`ht_${RUN}_${i}`}, ${`+23499${RUN}${i}`}, 'Kano', now(), ${`ht${RUN}${i}`})
    RETURNING id
  `;
  return u.id;
}

/** Every wallet and business balance must equal what the ledger says went in minus what went out. */
async function ledgerBalanced(ids: string[]) {
  const rows = await sql<{ kind: string; id: string; balance: number; ledger: number }[]>`
    WITH pots AS (
      SELECT 'wallet' AS kind, user_id AS id, balance::float8 AS balance FROM hustle_wallets WHERE user_id = ANY(${ids}::uuid[])
      UNION ALL
      SELECT 'business', id, cash::float8 FROM hustle_businesses WHERE owner_user_id = ANY(${ids}::uuid[])
    )
    SELECT p.kind, p.id, p.balance,
      coalesce((SELECT sum(amount) FROM hustle_ledger WHERE to_kind = p.kind AND to_id = p.id), 0)::float8 -
      coalesce((SELECT sum(amount) FROM hustle_ledger WHERE from_kind = p.kind AND from_id = p.id), 0)::float8 AS ledger
    FROM pots p
  `;
  const off = rows.filter((r) => Math.abs(r.balance - r.ledger) > 0.001);
  assert.equal(off.length, 0, `balances differ from ledger: ${JSON.stringify(off)}`);
  return rows.length;
}

const users: string[] = [];
try {
  for (let i = 0; i < 14; i++) users.push(await makeUser(i));
  const [A, B, C, D, E, F, G, H, J, K, L, M, N, O] = users;
  const person = async (id: string) =>
    (await sql<{ id: string; nickname: string; state: string; is_flagged: boolean }[]>`SELECT id, nickname, state, is_flagged FROM users WHERE id = ${id}`)[0];

  await check("name filter blocks brands and bad words, allows normal names", () => {
    assert.equal(validateBusinessName("Ada's Kitchen").ok, true);
    assert.equal(validateBusinessName("Tunde Cuts & Co.").ok, true);
    assert.equal(validateBusinessName("MTN Data Hub").ok, false);
    assert.equal(validateBusinessName("Shoprite Express").ok, false);
    assert.equal(validateBusinessName("Mumu Foods").ok, false);
    assert.equal(validateBusinessName("ab").ok, false);
  });

  await check("start a business: grant in, setup out, wallet with Allawee", async () => {
    const r = await startBusiness(A, "Kano", { type: "buka", name: `Ada Kitchen ${RUN}`, icon: "pot", color: "#ff8a3d" });
    assert.ok("ok" in r, JSON.stringify(r));
    const b = (await getBusinessByOwner(sql, A))!;
    assert.equal(b.cash, 50000 - 35000);
    const [w] = await sql<{ balance: number }[]>`SELECT balance::float8 AS balance FROM hustle_wallets WHERE user_id = ${A}`;
    assert.equal(w.balance, 20000);
    const again = await startBusiness(A, "Kano", { type: "barber", name: `Second ${RUN}`, icon: "star", color: "#ff8a3d" });
    assert.ok("error" in again, "a second business must be refused");
  });
  for (const [u, type, name] of [
    [B, "buka", `Mama B ${RUN}`],
    [C, "crop_farm", `Musa Farm ${RUN}`],
    [D, "barber", `Tunde Cuts ${RUN}`],
    [E, "pos_agent", `Quick Cash ${RUN}`],
    [F, "salon", `Amaka Braids ${RUN}`],
  ] as const) {
    const r = await startBusiness(u, "Kano", { type, name, icon: "star", color: "#c6f432" });
    assert.ok("ok" in r, JSON.stringify(r));
  }

  await check("pure engine: same seed gives the same numbers; price and rating move demand the right way", () => {
    assert.equal(seeded("x", today, "demand"), seeded("x", today, "demand"));
    assert.notEqual(seeded("x", today, "demand"), seeded("y", today, "demand"));
    assert.equal(withNoise(12.3, "biz", today), withNoise(12.3, "biz", today));
    assert.ok(townCustomers(18, 500, 600, 0) < townCustomers(18, 500, 500, 0));
    assert.ok(townCustomers(18, 500, 500, 1) < townCustomers(18, 500, 500, 0));
    assert.equal(ratingFactor(4), 1);
    assert.ok(Math.abs(ratingFactor(3) - 0.8) < 1e-9 && Math.abs(ratingFactor(5) - 1.15) < 1e-9);
  });

  const planFor = async (u: string, units?: number, price?: number) => {
    const b = (await getBusinessByOwner(sql, u))!;
    const card = await cardFor(sql, b, today);
    const ctx = await getPlanContext(b);
    return { units: units ?? Math.min(ctx.capacity, 10), price: price ?? ctx.refPrice, card: card?.id ?? null, choice: card ? card.options.length - 1 : null };
  };

  await check("price floor/ceiling, capacity and the decision are enforced on the server", async () => {
    const p = await planFor(A);
    assert.ok("error" in (await openDay(A, { ...p, price: 100 })), "price under floor");
    assert.ok("error" in (await openDay(A, { ...p, price: 5000 })), "price over ceiling");
    assert.ok("error" in (await openDay(A, { ...p, units: 999 })), "units over capacity");
    if (p.card !== null) assert.ok("error" in (await openDay(A, { ...p, choice: null })), "decision required");
    assert.ok("error" in (await openDay(A, { ...p, price: 505 + 0.5 })), "whole naira only");
  });

  await check("openDay runs once: two at the same time give exactly one open shop", async () => {
    const p = await planFor(A, 12, 500);
    const [r1, r2] = await Promise.all([openDay(A, p), openDay(A, p)]);
    const oks = [r1, r2].filter((r) => "ok" in r).length;
    assert.equal(oks, 1, JSON.stringify([r1, r2]));
    assert.ok("error" in (await openDay(A, p)), "third open must fail");
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM hustle_ledger WHERE from_id = (SELECT id FROM hustle_businesses WHERE owner_user_id = ${A}) AND reason = 'backup_market'`;
    assert.equal(n.n, 1, "supplies bought once");
  });

  await check("results are deterministic: the same business and date give the same day", async () => {
    // Open B, remember the day, undo it from the ledger, open again with the same plan.
    const b = (await getBusinessByOwner(sql, B))!;
    const [{ mark }] = await sql<{ mark: number }[]>`SELECT coalesce(max(id), 0)::int AS mark FROM hustle_ledger`;
    const p = await planFor(B, 15, 550);
    assert.ok("ok" in (await openDay(B, p)));
    const read = () => sql`SELECT units_sold_town, town_demand, revenue::float8, cost_of_goods::float8, other::float8 FROM hustle_days WHERE business_id = ${b.id} AND day_date = ${today}`;
    const [first] = await read();
    await transaction(async (tx) => {
      await tx`DELETE FROM hustle_days WHERE business_id = ${b.id} AND day_date = ${today}`;
      await tx`DELETE FROM hustle_listings WHERE business_id = ${b.id} AND day_date = ${today}`;
      await tx`DELETE FROM hustle_inventory WHERE business_id = ${b.id}`;
      await tx`DELETE FROM hustle_receivables WHERE business_id = ${b.id}`;
      await tx`DELETE FROM hustle_modifiers WHERE business_id = ${b.id}`;
      await tx`DELETE FROM hustle_ledger WHERE id > ${mark} AND (from_id = ${b.id} OR to_id = ${b.id})`;
      await tx`UPDATE hustle_businesses SET rating = 4.0, cash = (
        SELECT coalesce(sum(CASE WHEN to_id = ${b.id} THEN amount ELSE -amount END), 0) FROM hustle_ledger WHERE from_id = ${b.id} OR to_id = ${b.id}
      ) WHERE id = ${b.id}`;
    });
    assert.ok("ok" in (await openDay(B, p)));
    const [second] = await read();
    assert.deepEqual(second, first);
  });

  await check("every kind of business opens (supplier, slots, no-supply, salon)", async () => {
    for (const u of [C, D, E, F]) {
      const r = await openDay(u, await planFor(u));
      assert.ok("ok" in r, JSON.stringify(r));
    }
  });

  await check("parallel purchases never oversell a listing", async () => {
    const pos = (await getBusinessByOwner(sql, E))!;
    await sql`UPDATE hustle_listings SET units_available = 2 WHERE business_id = ${pos.id} AND day_date = ${today}`;
    const [l] = await sql<{ id: number }[]>`SELECT id::int AS id FROM hustle_listings WHERE business_id = ${pos.id} AND day_date = ${today}`;
    const buyers = [G, H, J, K, L, M];
    // Buyers without a business: an empty wallet, then this month's Allawee.
    for (const u of buyers) await sql`INSERT INTO hustle_wallets (user_id) VALUES (${u}) ON CONFLICT DO NOTHING`;
    for (const u of buyers) await transaction((tx) => payAllawee(tx, u, 20000));
    const results = await Promise.all(buyers.map(async (u) => buyFromListing(await person(u), l.id, 1)));
    const oks = results.filter((r) => "ok" in r).length;
    assert.equal(oks, 2, JSON.stringify(results));
    const [after] = await sql<{ n: number }[]>`SELECT units_available AS n FROM hustle_listings WHERE id = ${l.id}`;
    assert.equal(after.n, 0);
    const [d] = await sql<{ n: number }[]>`SELECT units_sold_players AS n FROM hustle_days WHERE business_id = ${pos.id} AND day_date = ${today}`;
    assert.equal(d.n, 2);
    await ledgerBalanced(users);
  });

  await check("needs: buying early resets the timer (never stacks); no buying from yourself; same state only; 3 a day per seller", async () => {
    const pos = (await getBusinessByOwner(sql, E))!;
    await sql`UPDATE hustle_listings SET units_available = 20 WHERE business_id = ${pos.id} AND day_date = ${today}`;
    const [l] = await sql<{ id: number }[]>`SELECT id::int AS id FROM hustle_listings WHERE business_id = ${pos.id} AND day_date = ${today}`;
    const buyer = await person(N);
    await sql`INSERT INTO hustle_wallets (user_id) VALUES (${N}) ON CONFLICT DO NOTHING`;
    await transaction((tx) => payAllawee(tx, N, 20000));
    assert.ok("ok" in (await buyFromListing(buyer, l.id, 1)));
    const again = await buyFromListing(buyer, l.id, 1);
    assert.ok("ok" in again, JSON.stringify(again));
    const [cash] = await sql<{ days: number }[]>`SELECT extract(epoch FROM satisfied_until - now()) / 86400 AS days FROM hustle_needs WHERE user_id = ${N} AND need_key = 'cash'`;
    assert.ok(cash.days > 6.9 && cash.days <= 7.01, `reset to 7 days from now, not stacked (got ${cash.days})`);
    const own = await buyFromListing(await person(E), l.id, 1);
    assert.ok("error" in own && own.error.includes("own"), JSON.stringify(own));
    const away = await buyFromListing({ ...buyer, state: "Lagos" }, l.id, 1);
    assert.ok("error" in away, "other state refused");
    const flagged = await buyFromListing({ ...buyer, is_flagged: true }, l.id, 1);
    assert.ok("error" in flagged, "flagged buyer refused");
    // Daily limit: pretend O already bought 3 times today.
    await sql`INSERT INTO hustle_wallets (user_id) VALUES (${O}) ON CONFLICT DO NOTHING`;
    await transaction((tx) => payAllawee(tx, O, 20000));
    for (let i = 0; i < MAX_DAILY_FROM_SELLER; i++) {
      await sql`INSERT INTO hustle_orders (buyer_kind, buyer_id, buyer_user_id, seller_business_id, qty, unit_price, total) VALUES ('user', ${O}, ${O}, ${pos.id}, 1, 100, 100)`;
    }
    const limited = await buyFromListing(await person(O), l.id, 1);
    assert.ok("error" in limited && limited.error.includes("times today"), JSON.stringify(limited));
    const needs = await getNeeds(sql, N);
    assert.ok(needs.needs.find((n) => n.key === "cash")!.daysLeft >= 6);
  });

  await check("backup shop only when no player sells the need", async () => {
    const r1 = await buyBackup(await person(N), "cash");
    assert.ok("error" in r1, "a player sells cash-outs today");
    const r2 = await buyBackup(await person(N), "laundry");
    assert.ok("ok" in r2, JSON.stringify(r2));
  });

  await check("supplies from a player go into stock, get used first, and the tip shows the saving", async () => {
    const farm = (await getBusinessByOwner(sql, C))!;
    await sql`UPDATE hustle_listings SET units_available = 5 WHERE business_id = ${farm.id} AND day_date = ${today}`;
    const [l] = await sql<{ id: number; price: number }[]>`SELECT id::int AS id, price FROM hustle_listings WHERE business_id = ${farm.id} AND day_date = ${today}`;
    // H runs a buka that hasn't opened; J is a carpenter who gets the buka's upkeep.
    assert.ok("ok" in (await startBusiness(H, "Kano", { type: "buka", name: `Mama H ${RUN}`, icon: "pot", color: "#ff8a3d" })));
    assert.ok("ok" in (await startBusiness(J, "Kano", { type: "carpenter", name: `Wood J ${RUN}`, icon: "wrench", color: "#ff8a3d" })));
    assert.ok("ok" in (await openDay(J, await planFor(J, 1))));
    const notBuka = await buyFromListing(await person(D), l.id, 1);
    assert.ok("error" in notBuka, "a barber can't order farm lots");
    const r = await buyFromListing(await person(H), l.id, 2);
    assert.ok("ok" in r, JSON.stringify(r));
    const p = await planFor(H, 8, 500);
    assert.ok("ok" in (await openDay(H, p)));
    const h = (await getBusinessByOwner(sql, H))!;
    const [day] = await sql<{ tips: { text: string }[]; supply_extra: number }[]>`SELECT tips, supply_extra::float8 FROM hustle_days WHERE business_id = ${h.id} AND day_date = ${today}`;
    assert.ok(day.tips.some((t) => t.text.includes("saved you")), JSON.stringify(day.tips));
    assert.equal(day.supply_extra, 0, "no backup lots needed");
    await transaction((tx) => closeThrough(tx, h.id, today));
    const j = (await getBusinessByOwner(sql, J))!;
    const [up] = await sql`SELECT 1 FROM hustle_ledger WHERE reason = 'upkeep' AND from_id = ${h.id} AND to_id = ${j.id}`;
    assert.ok(up, "upkeep paid to the carpenter who opened");
    await ledgerBalanced(users);
  });

  await check("one review per order, by the buyer; rating moves towards the stars", async () => {
    const [o] = await sql<{ id: number; seller: string }[]>`SELECT id::int AS id, seller_business_id AS seller FROM hustle_orders WHERE buyer_user_id = ${N} AND seller_business_id IS NOT NULL LIMIT 1`;
    const before = (await getBusinessByOwner(sql, E))!.rating;
    assert.ok("error" in (await submitReview(M, o.id, 5, "")), "not the buyer");
    assert.ok("error" in (await submitReview(N, o.id, 5, "visit www.spam.com")), "no links");
    assert.ok("ok" in (await submitReview(N, o.id, 1, "Slow")));
    assert.ok("error" in (await submitReview(N, o.id, 5, "")), "only once");
    const after = (await getBusinessByOwner(sql, E))!.rating;
    assert.ok(after < before);
  });

  await check("new players: hair, laundry and data come due on days 1, 2 and 3; the rest at their full interval", async () => {
    for (const u of [A, B, C, D]) {
      const due = ["grooming", "laundry", "data"].map((k) => firstDueDays(u, k, 7)).sort();
      assert.deepEqual(due, [1, 2, 3]);
      assert.equal(firstDueDays(u, "clothes", 30), 30);
    }
    // Someone who has never bought anything: those three are due within 3 days.
    await sql`DELETE FROM hustle_needs WHERE user_id = ${A}`;
    const { needs } = await getNeeds(sql, A);
    for (const k of ["grooming", "laundry", "data"]) assert.ok(needs.find((n) => n.key === k)!.daysLeft <= 3, k);
    assert.ok(needs.find((n) => n.key === "clothes")!.daysLeft >= 29);
  });

  await check("score bands: Silver+ needs 7 days and 20 customers; under 5 businesses in the state caps at Silver", () => {
    const ok = { days: 7, served: 20, stateBusinesses: 5 };
    assert.equal(scoreBand(0.95, ok), "Diamond");
    assert.equal(scoreBand(0.65, ok), "Gold");
    assert.equal(scoreBand(0.95, { ...ok, days: 6 }), "Bronze");
    assert.equal(scoreBand(0.95, { ...ok, served: 19 }), "Bronze");
    assert.equal(scoreBand(0.95, { ...ok, stateBusinesses: 4 }), "Silver");
    assert.equal(scoreBand(0.45, { ...ok, stateBusinesses: 1 }), "Silver");
    assert.equal(scoreBand(0.2, ok), "Bronze");
  });

  await check("task rewards stop at the daily cap and pay once per ref", async () => {
    let got = 0;
    for (let i = 0; i < 8; i++) got += await creditTaskReward(C, "quiz", TASK_REWARDS.quiz, `day-${i}`);
    assert.equal(got, 500);
    assert.equal(await creditTaskReward(D, "follow", 20, "same-person"), 20);
    assert.equal(await creditTaskReward(D, "follow", 20, "same-person"), 0);
    assert.equal(await creditTaskReward("00000000-0000-0000-0000-000000000000", "quiz", 100), 0, "no wallet, no reward");
  });

  await check("invest and pay myself move money between pots and refuse overdrafts", async () => {
    assert.ok("ok" in (await transfer(D, "invest", 5000)));
    assert.ok("ok" in (await transfer(D, "draw", 2000)));
    const r = await transfer(D, "invest", 10_000_000);
    assert.ok("error" in r && r.error.includes("wallet"));
    assert.ok("error" in (await transfer(D, "draw", -5)));
  });

  await check("Allawee pays once a month", async () => {
    const m = lagosMonth();
    const paid = await transaction((tx) => payAllawee(tx, A, 20000, m));
    assert.equal(paid, 0, "already paid at start");
    const [y, mo] = m.split("-").map(Number);
    const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;
    assert.equal(await transaction((tx) => payAllawee(tx, A, 20000, next)), 20000);
    assert.equal(await transaction((tx) => payAllawee(tx, A, 20000, next)), 0);
  });

  await check("random money operations keep every balance equal to the ledger", async () => {
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    for (let i = 0; i < 150; i++) {
      const u = pick(users);
      const op = Math.floor(Math.random() * 4);
      if (op === 0) await transfer(u, "invest", 1 + Math.floor(Math.random() * 30000));
      else if (op === 1) await transfer(u, "draw", 1 + Math.floor(Math.random() * 30000));
      else if (op === 2) await creditTaskReward(u, pick(["quiz", "follow"]), 1 + Math.floor(Math.random() * 150), `r${i}`);
      else await Promise.all([transfer(u, "invest", 700), transfer(u, "draw", 700)]);
    }
    await ledgerBalanced(users);
  });

  await check("closing is idempotent: twice changes nothing the second time", async () => {
    const ids = (await sql<{ id: string }[]>`SELECT id FROM hustle_businesses WHERE owner_user_id = ANY(${users}::uuid[])`).map((r) => r.id);
    const pots = [...users, ...ids];
    // Only the test players' money: other local businesses are left alone.
    const snapshot = () => sql<{ n: number; s: number }[]>`
      SELECT count(*)::int AS n, coalesce(sum(amount), 0)::float8 AS s FROM hustle_ledger WHERE from_id = ANY(${pots}::uuid[]) OR to_id = ANY(${pots}::uuid[])
    `;
    for (const id of ids) await transaction((tx) => closeThrough(tx, id, today));
    const [before] = await snapshot();
    for (const id of ids) assert.equal(await transaction((tx) => closeThrough(tx, id, today)), 0);
    const [after] = await snapshot();
    assert.deepEqual(after, before);
    const days = await sql`SELECT profit, tips FROM hustle_days WHERE business_id = ANY(${ids}::uuid[]) AND day_date = ${today}`;
    assert.ok(days.every((d) => d.profit !== null && Array.isArray(d.tips) && d.tips.length > 0), "every day has profit and tips");
    await ledgerBalanced(users);
  });

  await check("a day that was never opened still pays rent after the grace days", async () => {
    const b = (await getBusinessByOwner(sql, E))!;
    // Pretend the business started 10 days ago, and close the day after today without opening.
    await sql`UPDATE hustle_businesses SET created_at = now() - interval '10 days' WHERE id = ${b.id}`;
    const tomorrow = addDays(today, 1);
    const before = (await getBusinessByOwner(sql, E))!.cash;
    await transaction((tx) => closeThrough(tx, b.id, tomorrow));
    const after = (await getBusinessByOwner(sql, E))!.cash;
    assert.equal(before - after, 500, "POS agent rent is ₦500");
  });

  await check("deep in the red: restructured to ₦10,000, stage 1, Comeback badge", async () => {
    const b = (await getBusinessByOwner(sql, F))!;
    await transaction((tx) => move(tx, business(b.id), SYSTEM, b.cash + 20000, "admin_adjust", { allowNegative: true, note: "test" }));
    await transaction((tx) => closeThrough(tx, b.id, addDays(today, 1)));
    const after = (await getBusinessByOwner(sql, F))!;
    assert.equal(after.status, "restructured");
    assert.equal(after.cash, 10000, "₦10,000 to restart (tomorrow is still rent-free: grace days)");
    const [badge] = await sql`SELECT 1 FROM user_badges WHERE user_id = ${F} AND badge_slug = 'hustle_comeback'`;
    assert.ok(badge);
    await ledgerBalanced(users);
  });
} catch (err) {
  failures++;
  results.push(`  ✗ setup failed\n      ${(err as Error).stack}`);
} finally {
  // Clean up: test users (cascades to businesses, wallets, days...) and their ledger rows.
  const bizIds = (await sql<{ id: string }[]>`SELECT id FROM hustle_businesses WHERE owner_user_id = ANY(${users}::uuid[])`).map((r) => r.id);
  const all = [...users, ...bizIds];
  if (all.length) await sql`DELETE FROM hustle_ledger WHERE from_id = ANY(${all}::uuid[]) OR to_id = ANY(${all}::uuid[])`;
  if (users.length) await sql`DELETE FROM users WHERE id = ANY(${users}::uuid[])`;
  console.log(`My Hustle checks\n${results.join("\n")}\n${failures ? `${failures} failed` : "All passed"}`);
  await sql.end();
  process.exit(failures ? 1 : 0);
}
