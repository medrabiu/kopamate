// Unit tests for lib/social-rules.ts and lib/word-filter.ts. Run with: npm run test:social
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAbuse } from "../lib/word-filter.ts";
import {
  checkInterests,
  checkOpenTo,
  checkText,
  cleanLinks,
  handleFromPath,
  hasLink,
  likeness,
  parseLink,
  profileStrength,
  usernameChange,
  waLink,
} from "../lib/social-rules.ts";

test("word filter: whole words, l33t, but not innocent words", () => {
  assert.equal(hasAbuse("you are a b1tch"), true);
  assert.equal(hasAbuse("F U C K"), false, "spaced letters aren't a word");
  assert.equal(hasAbuse("what a mumu"), true);
  assert.equal(hasAbuse("I write code in Lagos"), false, "code is not ode");
  assert.equal(hasAbuse("Mode and episode"), false);
  assert.equal(hasAbuse("Computer Science, UNILAG"), false);
});

test("links are rejected in bios and notes", () => {
  assert.equal(hasLink("follow me on www.site.com"), true);
  assert.equal(hasLink("dm me https://x.com/a"), true);
  assert.equal(hasLink("wa.me/2348031234567"), true);
  assert.equal(hasLink("I love U.S. history and B.Sc. stuff"), false);
  const bio = checkText("Check my page instagram.com/ada", "Bio", 160);
  assert.equal(bio.ok, false);
  assert.match(bio.error, /No links/);
});

test("bio: length, tidy, empty clears", () => {
  assert.deepEqual(checkText("  Hi,   I'm Ada \n from UNILAG ", "Bio", 160), { ok: true, value: "Hi, I'm Ada from UNILAG" });
  assert.deepEqual(checkText("   ", "Bio", 160), { ok: true, value: null });
  assert.equal(checkText("x".repeat(161), "Bio", 160).ok, false);
  assert.equal(checkText("you mumu", "Bio", 160).ok, false);
  // HTML stays plain text (it's escaped when shown); it isn't a link so it's allowed as text.
  assert.deepEqual(checkText("<b>hi</b>", "Bio", 160), { ok: true, value: "<b>hi</b>" });
});

test("interests: max 5, max 24 chars, no duplicates", () => {
  assert.deepEqual(checkInterests(["Tech", "tech", " Design ", "#Music", ""]), { ok: true, value: ["Tech", "Design", "Music"] });
  assert.equal(checkInterests(["a", "b", "c", "d", "e", "f"]).ok, false);
  assert.equal(checkInterests(["x".repeat(25)]).ok, false);
  assert.deepEqual(checkOpenTo(["work", "hacking", "friends"]), ["work", "friends"]);
});

test("links: https only, handles become profile links", () => {
  assert.deepEqual(parseLink("instagram", "@ada.obi"), { ok: true, value: "https://www.instagram.com/ada.obi" });
  assert.deepEqual(parseLink("instagram", "https://instagram.com/ada_obi/"), { ok: true, value: "https://www.instagram.com/ada_obi" });
  assert.deepEqual(parseLink("x", "twitter.com/AdaObi"), { ok: true, value: "https://x.com/AdaObi" });
  assert.deepEqual(parseLink("tiktok", "@ada.creates"), { ok: true, value: "https://www.tiktok.com/@ada.creates" });
  assert.deepEqual(parseLink("linkedin", "https://ng.linkedin.com/in/ada-obi-123"), { ok: true, value: "https://www.linkedin.com/in/ada-obi-123" });
  assert.deepEqual(parseLink("website", "ada.dev"), { ok: true, value: "https://ada.dev/" });
  assert.equal(parseLink("website", "http://ada.dev").ok, false);
  assert.equal(parseLink("website", "javascript:alert(1)").ok, false);
  assert.equal(parseLink("instagram", "http://instagram.com/ada").ok, false);
  assert.equal(parseLink("x", "https://evil.com/ada").ok, false);
  assert.deepEqual(parseLink("x", ""), { ok: true, value: null });
  assert.deepEqual(cleanLinks({ x: "https://x.com/a", website: "javascript:alert(1)", other: "https://z" }), { x: "https://x.com/a" });
});

test("profile strength and the first missing item", () => {
  const empty = { photo: false, bio: null, school: null, course: null, interests: [], open_to: [], links: {} };
  assert.deepEqual(profileStrength(empty), { score: 0, missing: { key: "photo", hint: "add a photo so people recognise you" } });
  const some = { ...empty, photo: true, bio: "Hi" };
  assert.equal(profileStrength(some).score, 40);
  assert.equal(profileStrength(some).missing.key, "school");
  const full = { photo: true, bio: "Hi", school: "UNILAG", course: "CS", interests: ["Tech"], open_to: ["work"], links: { x: "https://x.com/a" } };
  assert.deepEqual(profileStrength(full), { score: 100, missing: null });
});

test("people like you scoring", () => {
  const me = { school: "UNILAG", course: "Computer Science", state: "Lagos", interests: ["Tech", "Music"] };
  assert.equal(likeness(me, { school: "unilag ", course: "computer science", state: "Lagos", interests: ["tech", "Music", "Food"] }), 3 + 2 + 2 + 2);
  assert.equal(likeness(me, { school: null, course: null, state: "Kano", interests: [] }), 0);
});

test("username changes once every 30 days", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(usernameChange(null, now).allowed, true);
  assert.equal(usernameChange(new Date("2026-09-01T12:00:00Z"), now).allowed, true);
  const r = usernameChange(new Date("2026-10-01T12:00:00Z"), now);
  assert.equal(r.allowed, false);
  assert.equal(r.next.toISOString(), "2026-10-31T12:00:00.000Z");
});

test("profile paths and WhatsApp links", () => {
  assert.equal(handleFromPath("@Ada_Obi"), "Ada_Obi");
  assert.equal(handleFromPath("%40ada.obi"), "ada.obi");
  assert.equal(handleFromPath("ada123"), null, "no @: an invite code");
  assert.equal(handleFromPath("@<script>"), null);
  assert.equal(waLink("+2348031234567"), "https://wa.me/2348031234567?text=Hi%20from%20Kopamate");
});
