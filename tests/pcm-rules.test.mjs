// Unit tests for lib/pcm-rules.ts. Run with: npm run test:pcm
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GUIDE as G } from "../content/pcm-guide.ts";
import {
  anchorTarget,
  applyAnswers,
  appliesTo,
  emptyPlan,
  fillLetter,
  guideProblems,
  mergePlans,
  parseRichText,
  readiness,
  resolveFixPath,
  sanitizePlan,
  stepDone,
  tickKey,
  toggleTick,
  visibleDocuments,
  visiblePacking,
  visibleSituations,
} from "../lib/pcm-rules.ts";

const all = { studied: "ng", qual: "uni", married: "no", over30: "no", health: "no", stage: "s0" };

test("appliesTo: empty matches everyone, every key must match", () => {
  assert.equal(appliesTo({}, {}), true);
  assert.equal(appliesTo(null, all), true);
  assert.equal(appliesTo({ married: "yes" }, all), false);
  assert.equal(appliesTo({ married: "yes" }, { ...all, married: "yes" }), true);
  assert.equal(appliesTo({ qual: "poly", married: "yes" }, { ...all, qual: "poly" }), false);
  assert.equal(appliesTo({ qual: "poly", married: "yes" }, { ...all, qual: "poly", married: "yes" }), true);
  assert.equal(appliesTo({ studied: "abroad" }, {}), false);
});

test("pre-ticking from 'Where are you now?'", () => {
  const ticked = (stage) => Object.keys(applyAnswers(emptyPlan(), { ...all, stage }).ticks).sort();
  assert.deepEqual(ticked("s0"), []);
  assert.deepEqual(ticked("s1"), ["step:senate"]);
  assert.deepEqual(ticked("s2"), ["step:nerd", "step:register", "step:senate"]);
  assert.deepEqual(ticked("s3"), ["step:callup", "step:nerd", "step:register", "step:senate"]);
});

test("changing answers never un-ticks", () => {
  let p = applyAnswers(emptyPlan(), { ...all, stage: "s3" });
  p = toggleTick(p, tickKey.step("medical"), true);
  p = applyAnswers(p, { ...all, stage: "s0" });
  assert.ok(p.ticks["step:callup"] && p.ticks["step:medical"] && p.ticks["step:senate"]);
});

test("readiness over the steps that apply, and the next step", () => {
  let p = applyAnswers(emptyPlan(), { ...all, stage: "s2" });
  let r = readiness(G, p);
  assert.equal(r.total, 7);
  assert.equal(r.done, 3);
  assert.equal(r.pct, 43);
  assert.equal(r.next.slug, "callup");
  p = applyAnswers(p, { ...all, stage: "s3" });
  assert.equal(readiness(G, p).next.slug, "medical");
});

test("Camp Pack completes its steps", () => {
  const poly = { ...all, qual: "poly" };
  let p = applyAnswers(emptyPlan(), poly);
  const docsStep = G.steps.find((s) => s.opens === "camp_docs");
  const docs = visibleDocuments(G, poly);
  assert.ok(docs.some((d) => d.slug === "ond"), "OND shows for poly");
  assert.ok(!visibleDocuments(G, all).some((d) => d.slug === "ond"), "OND hidden for university");
  for (const d of docs.slice(0, -1)) p = toggleTick(p, tickKey.doc(d.slug), true);
  assert.equal(stepDone(G, p, docsStep), false);
  p = toggleTick(p, tickKey.doc(docs.at(-1).slug), true);
  assert.equal(stepDone(G, p, docsStep), true);
  // Packing the same way.
  const packStep = G.steps.find((s) => s.opens === "camp_packing");
  for (const i of visiblePacking(G, poly)) p = toggleTick(p, tickKey.pack(i.slug), true);
  assert.equal(stepDone(G, p, packStep), true);
  // Unticking one makes it not done again.
  p = toggleTick(p, tickKey.pack("bucket"), false);
  assert.equal(stepDone(G, p, packStep), false);
});

test("situations: matching ones only after answering, then always-shown ones", () => {
  assert.deepEqual(visibleSituations(G, {}).map((s) => s.slug), ["senate-list"]);
  assert.deepEqual(
    visibleSituations(G, { ...all, married: "yes", studied: "abroad" }).map((s) => s.slug),
    ["married", "abroad", "senate-list"],
  );
});

test("fix paths: NIN to NIMC, JAMB to JAMB, others and course to the school", () => {
  assert.equal(resolveFixPath(G, "name", "nin").slug, "nimc");
  assert.equal(resolveFixPath(G, "dob", "jamb").slug, "jamb");
  assert.equal(resolveFixPath(G, "name", "sor").slug, "school");
  assert.equal(resolveFixPath(G, "dob", "senate").slug, "school");
  assert.equal(resolveFixPath(G, "course", null).slug, "school");
  assert.equal(resolveFixPath(G, "course", "nin").slug, "school");
  assert.equal(resolveFixPath(G, "name", null), null);
});

test("fillLetter fills placeholders and never prints undefined", () => {
  const out = fillLetter("{name} of {school} ({matric}): {field} should be {correct}.", { name: "Ada Obi", school: "UNN", field: "name" });
  assert.equal(out, "Ada Obi of UNN (________): name should be ________.");
  const letter = fillLetter(G.fixPaths.find((p) => p.hasLetter).letterTemplate, { name: "Ada", school: "UNN", matric: "2019/1", field: "name", correct: "Ada Obi" });
  assert.ok(!/\{(name|school|matric|field|correct)\}/.test(letter));
  assert.ok(!letter.includes("undefined"));
});

test("merging device progress into an account", () => {
  const account = { ...applyAnswers(emptyPlan(), { ...all, stage: "s1" }, new Date("2026-10-01")), fixAdded: false };
  let device = applyAnswers(emptyPlan(), { ...all, married: "yes", stage: "s0" }, new Date("2026-10-05"));
  device = toggleTick(device, tickKey.pack("bucket"), true, new Date("2026-10-05"));
  device = { ...device, fixAdded: true };
  const m = mergePlans(account, device);
  assert.equal(m.answers.married, "yes", "newest answers win");
  assert.ok(m.ticks["step:senate"] && m.ticks["pack:bucket"], "union of ticks");
  assert.equal(m.fixAdded, true);
  // An older device copy keeps the account's answers but still adds its ticks.
  const old = { ...device, updatedAt: new Date("2026-09-01").toISOString() };
  assert.equal(mergePlans(account, old).answers.married, "no");
  assert.ok(mergePlans(account, old).ticks["pack:bucket"]);
});

test("sanitizePlan drops anything unexpected", () => {
  const p = sanitizePlan({
    answers: { married: "yes", stage: "s9", hack: "x" },
    ticks: { "step:senate": true, "<script>": true, "doc:ond": "yes", "item:married:2": true },
    fixAdded: "true",
  });
  assert.deepEqual(p.answers, { married: "yes" });
  assert.deepEqual(Object.keys(p.ticks).sort(), ["item:married:2", "step:senate"]);
  assert.equal(p.fixAdded, false);
  assert.deepEqual(sanitizePlan("nonsense"), emptyPlan());
});

test("anchors open the right section or sheet", () => {
  assert.deepEqual(anchorTarget(G, "#nerd"), { kind: "step", slug: "nerd" });
  assert.deepEqual(anchorTarget(G, "#married"), { kind: "situation", slug: "married" });
  assert.deepEqual(anchorTarget(G, "#fix"), { kind: "fix", slug: "fix" });
  assert.equal(anchorTarget(G, "#nothing"), null);
  assert.equal(anchorTarget(G, ""), null);
});

test("text escaping: only bold and https links, HTML stays text", () => {
  assert.deepEqual(parseRichText("Hi **there** see [NYSC](https://nysc.gov.ng)."), [
    { t: "text", v: "Hi " },
    { t: "bold", v: "there" },
    { t: "text", v: " see " },
    { t: "link", v: "NYSC", href: "https://nysc.gov.ng" },
    { t: "text", v: "." },
  ]);
  assert.deepEqual(parseRichText("[bad](javascript:alert(1))"), [{ t: "text", v: "[bad](javascript:alert(1))" }]);
  assert.deepEqual(parseRichText("[plain](http://x.com)"), [{ t: "text", v: "[plain](http://x.com)" }]);
  assert.deepEqual(parseRichText("<script>alert(1)</script>"), [{ t: "text", v: "<script>alert(1)</script>" }]);
});

test("the default guide is valid, and validation catches problems", () => {
  assert.deepEqual(guideProblems(G), []);
  const bad = structuredClone(G);
  bad.steps[1].slug = "senate";
  bad.steps[0].title = "";
  bad.documents[0].conditions = { married: "maybe" };
  bad.situations[0].slug = "medical";
  const problems = guideProblems(bad);
  assert.ok(problems.some((p) => p.includes('"senate" is used twice')));
  assert.ok(problems.some((p) => p.includes("title: required")));
  assert.ok(problems.some((p) => p.includes("isn't a valid condition")));
  assert.ok(problems.some((p) => p.includes('"medical" is used twice')), "steps and situations share anchors");
  const big = structuredClone(G);
  big.steps[0].what = "x".repeat(1200);
  big.steps = Array.from({ length: 200 }, (_, i) => ({ ...big.steps[0], slug: `s${i}` }));
  assert.ok(guideProblems(big).some((p) => p.includes("limit is 200 KB")));
});
