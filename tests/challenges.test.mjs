// Unit tests for lib/challenge-rules.ts. Run with: npm run test:challenges
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanHandle,
  duplicateWinners,
  nextStep,
  normalizePostUrl,
  poolFor,
  prizeAmounts,
  splitProblem,
} from "../lib/challenge-rules.ts";

const pool = { pool_base: 100000, pool_step_entries: 50, pool_step_amount: 10000, pool_cap: 200000 };
const split = [
  { key: "first", label: "1st place", pct: 50 },
  { key: "second", label: "2nd place", pct: 20 },
  { key: "third", label: "3rd place", pct: 10 },
  { key: "recruiter", label: "Top Recruiter", pct: 10 },
  { key: "rising", label: "Rising creator", pct: 10 },
];

test("pool at 0, 49, 50, 999 approved entries and the cap", () => {
  assert.equal(poolFor(pool, 0), 100000);
  assert.equal(poolFor(pool, 49), 100000);
  assert.equal(poolFor(pool, 50), 110000);
  assert.equal(poolFor(pool, 99), 110000);
  assert.equal(poolFor(pool, 500), 200000);
  assert.equal(poolFor(pool, 999), 200000);
  assert.equal(poolFor(pool, -5), 100000);
});

test("next step: entries still needed and how much it adds", () => {
  assert.deepEqual(nextStep(pool, 0), { entries: 50, amount: 10000 });
  assert.deepEqual(nextStep(pool, 38), { entries: 12, amount: 10000 });
  assert.deepEqual(nextStep(pool, 50), { entries: 50, amount: 10000 });
  assert.equal(nextStep(pool, 500), null);
  assert.deepEqual(nextStep({ ...pool, pool_cap: 105000 }, 0), { entries: 50, amount: 5000 });
});

test("prize amounts add up to the pool", () => {
  const at100 = prizeAmounts(100000, split).map((p) => p.amount);
  assert.deepEqual(at100, [50000, 20000, 10000, 10000, 10000]);
  const at200 = prizeAmounts(200000, split).map((p) => p.amount);
  assert.deepEqual(at200, [100000, 40000, 20000, 20000, 20000]);
  assert.equal(at200.reduce((a, b) => a + b, 0), 200000);
});

test("prize split must add up to 100%", () => {
  assert.equal(splitProblem(split), null);
  assert.match(splitProblem([{ key: "a", label: "A", pct: 60 }]), /60%/);
  assert.match(splitProblem([...split, split[0]]), /own key/);
});

test("one prize per person", () => {
  assert.deepEqual(duplicateWinners([{ prize_key: "first", user_id: "a" }, { prize_key: "second", user_id: "b" }]), []);
  assert.deepEqual(duplicateWinners([{ prize_key: "first", user_id: "a" }, { prize_key: "recruiter", user_id: "a" }]), ["a"]);
});

test("post links are checked and cleaned", () => {
  assert.deepEqual(normalizePostUrl("https://twitter.com/Kopamate/status/1234567890?s=20&t=abc"), {
    platform: "x",
    url: "https://x.com/kopamate/status/1234567890",
  });
  assert.deepEqual(normalizePostUrl("x.com/someone/status/1234567890/"), { platform: "x", url: "https://x.com/someone/status/1234567890" });
  assert.deepEqual(normalizePostUrl("https://www.tiktok.com/@Corper.Life/video/7301234567890?is_from_webapp=1"), {
    platform: "tiktok",
    url: "https://www.tiktok.com/@corper.life/video/7301234567890",
  });
  assert.deepEqual(normalizePostUrl("https://www.instagram.com/reels/C1aBcD_eF2/?igsh=xyz"), {
    platform: "instagram",
    url: "https://www.instagram.com/reel/C1aBcD_eF2",
  });
  assert.deepEqual(normalizePostUrl("https://instagram.com/someone/p/C1aBcD_eF2"), {
    platform: "instagram",
    url: "https://www.instagram.com/p/C1aBcD_eF2",
  });
  assert.ok("error" in normalizePostUrl("https://vm.tiktok.com/ZMabc123/"));
  assert.ok("error" in normalizePostUrl("https://x.com/kopamate"));
  assert.ok("error" in normalizePostUrl("https://facebook.com/post/1"));
  assert.ok("error" in normalizePostUrl("not a link at all"));
});

test("handles", () => {
  assert.equal(cleanHandle("@Kopamate"), "Kopamate");
  assert.equal(cleanHandle("https://x.com/kopamate"), "kopamate");
  assert.equal(cleanHandle("https://www.tiktok.com/@corper.life"), "corper.life");
  assert.equal(cleanHandle(""), null);
  assert.equal(cleanHandle("no spaces allowed"), null);
});
