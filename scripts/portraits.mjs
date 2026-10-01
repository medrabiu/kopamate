// Illustrated portraits for seed accounts: flat, friendly faces in a range of skin tones, hairstyles
// and outfits, drawn as SVG and rendered to PNG with Next's built-in image renderer (no downloads,
// no photos of real people). Deterministic: the same seed always gives the same face.
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";

const SKIN = ["#8D5524", "#6B3E26", "#A0662F", "#7A4A2A", "#5C3317", "#B97A4B", "#9C6338", "#4E2A14", "#C68B59"];
const HAIR = ["#1B1210", "#241612", "#2E1B12", "#120C0A", "#3B2417"];
const SHIRT = ["#C9A86A", "#C9A86A", "#C9A86A", "#F2F0E8", "#2E5E4E", "#8B1E3F", "#2B4C7E", "#E07A2E", "#5B3F8C"];
const BG = ["#E8F5C8", "#FFD6E8", "#FFE7C2", "#DCD7FF", "#CFF3EE", "#F1EDE4", "#D7ECFF"];
const WRAP = ["#E0457B", "#F2A541", "#2E8B57", "#5B3F8C", "#D7263D", "#1F7A8C"];

/** Small seeded random generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Darker shade of a hex colour, for shadows and features. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.max(0, Math.round(v * (1 - amount)))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** SVG markup for one portrait. `look` is "f" or "m" and only steers the style choices. */
export function portraitSvg(seed, look) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const skin = pick(SKIN);
  const skinDark = shade(skin, 0.18);
  const hair = pick(HAIR);
  const shirt = pick(SHIRT);
  const bg = pick(BG);
  const feminine = look === "f";
  const style = feminine ? pick(["braids", "bun", "afro", "headwrap", "braids", "low"]) : pick(["low", "fade", "afro", "low", "shaved"]);
  const glasses = r() < 0.22;
  const beard = !feminine && r() < 0.35;
  const earrings = feminine && r() < 0.6;
  const smileOpen = r() < 0.45;
  const headRy = 88 + Math.floor(r() * 10);

  const parts = [];
  parts.push(`<rect width="400" height="400" fill="${bg}"/>`);
  parts.push(`<circle cx="320" cy="70" r="90" fill="#ffffff" opacity="0.35"/>`);

  // Hair that sits behind the head.
  if (style === "afro") parts.push(`<circle cx="200" cy="150" r="${feminine ? 112 : 100}" fill="${hair}"/>`);
  if (style === "braids") {
    parts.push(`<path d="M112 160 C104 260 118 330 140 360 L260 360 C282 330 296 260 288 160 Z" fill="${hair}"/>`);
    for (let x = 122; x <= 278; x += 16) parts.push(`<path d="M${x} 200 L${x + (x < 200 ? -4 : 4)} 352" stroke="${shade(hair, -0.6)}" stroke-width="2" opacity="0.35"/>`);
  }

  // Shoulders and shirt, with a collar opening.
  parts.push(`<path d="M40 400 C40 318 110 286 200 286 C290 286 360 318 360 400 Z" fill="${shirt}"/>`);
  parts.push(`<path d="M168 290 L200 336 L232 290 Z" fill="${skinDark}"/>`);
  if (shirt === "#C9A86A") {
    parts.push(`<path d="M150 292 L200 344 L176 300 Z" fill="${shade(shirt, 0.12)}"/><path d="M250 292 L200 344 L224 300 Z" fill="${shade(shirt, 0.12)}"/>`);
    parts.push(`<rect x="250" y="330" width="44" height="30" rx="4" fill="${shade(shirt, 0.08)}"/>`);
  }
  // Neck, ears, head.
  parts.push(`<rect x="174" y="236" width="52" height="62" rx="20" fill="${skinDark}"/>`);
  parts.push(`<ellipse cx="122" cy="188" rx="15" ry="20" fill="${skinDark}"/><ellipse cx="278" cy="188" rx="15" ry="20" fill="${skinDark}"/>`);
  if (earrings) {
    const gold = "#F2C14E";
    parts.push(`<circle cx="120" cy="212" r="7" fill="${gold}"/><circle cx="280" cy="212" r="7" fill="${gold}"/>`);
  }
  parts.push(`<ellipse cx="200" cy="180" rx="80" ry="${headRy}" fill="${skin}"/>`);

  // Hair on top of the head.
  if (style === "low" || style === "braids")
    parts.push(`<path d="M120 172 C116 96 284 96 280 172 C268 128 238 108 200 108 C162 108 132 128 120 172 Z" fill="${hair}"/>`);
  if (style === "fade") parts.push(`<path d="M122 150 C122 92 278 92 278 150 L270 132 C250 112 150 112 130 132 Z" fill="${hair}"/>`);
  if (style === "shaved") parts.push(`<path d="M124 160 C124 100 276 100 276 160 C262 122 138 122 124 160 Z" fill="${hair}" opacity="0.55"/>`);
  if (style === "afro") parts.push(`<path d="M116 160 C112 84 288 84 284 160 C266 118 134 118 116 160 Z" fill="${hair}"/>`);
  if (style === "bun") {
    parts.push(`<circle cx="200" cy="74" r="34" fill="${hair}"/>`);
    parts.push(`<path d="M120 170 C116 98 284 98 280 170 C266 126 236 108 200 108 C164 108 134 126 120 170 Z" fill="${hair}"/>`);
  }
  if (style === "headwrap") {
    const wrap = pick(WRAP);
    parts.push(`<path d="M108 168 C96 70 304 70 292 168 C276 120 124 120 108 168 Z" fill="${wrap}"/>`);
    parts.push(`<path d="M200 70 C250 30 300 60 280 100 C262 80 236 76 200 92 Z" fill="${shade(wrap, 0.18)}"/>`);
    parts.push(`<path d="M130 120 C170 104 230 104 270 120" stroke="${shade(wrap, 0.3)}" stroke-width="5" fill="none" opacity="0.5"/>`);
  }

  // Face.
  const browY = 160;
  parts.push(`<path d="M150 ${browY} Q166 ${browY - 8} 182 ${browY}" stroke="${hair}" stroke-width="7" stroke-linecap="round" fill="none"/>`);
  parts.push(`<path d="M218 ${browY} Q234 ${browY - 8} 250 ${browY}" stroke="${hair}" stroke-width="7" stroke-linecap="round" fill="none"/>`);
  parts.push(`<ellipse cx="166" cy="186" rx="9" ry="11" fill="#1A1110"/><ellipse cx="234" cy="186" rx="9" ry="11" fill="#1A1110"/>`);
  parts.push(`<circle cx="169" cy="182" r="3" fill="#ffffff"/><circle cx="237" cy="182" r="3" fill="#ffffff"/>`);
  parts.push(`<path d="M196 196 Q186 222 198 226 Q206 228 210 222" stroke="${shade(skin, 0.3)}" stroke-width="5" stroke-linecap="round" fill="none"/>`);
  if (smileOpen) {
    parts.push(`<path d="M170 240 Q200 274 230 240 Z" fill="#3A1414"/><path d="M178 242 Q200 252 222 242 L222 246 Q200 256 178 246 Z" fill="#ffffff"/>`);
  } else {
    parts.push(`<path d="M172 242 Q200 264 228 242" stroke="#3A1414" stroke-width="6" stroke-linecap="round" fill="none"/>`);
  }
  if (beard) parts.push(`<path d="M128 214 C134 290 266 290 272 214 C262 262 232 276 200 276 C168 276 138 262 128 214 Z" fill="${hair}" opacity="0.85"/>`);
  if (glasses) {
    parts.push(`<rect x="140" y="166" width="54" height="40" rx="14" stroke="#141413" stroke-width="5" fill="#ffffff" fill-opacity="0.12"/>`);
    parts.push(`<rect x="206" y="166" width="54" height="40" rx="14" stroke="#141413" stroke-width="5" fill="#ffffff" fill-opacity="0.12"/>`);
    parts.push(`<path d="M194 184 L206 184" stroke="#141413" stroke-width="5"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="45 30 310 310" width="400" height="400">${parts.join("")}</svg>`;
}

/** Renders an SVG to PNG bytes at `size`×`size`. */
async function renderPng(svg, size) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const res = new ImageResponse(h("img", { src, width: size, height: size }), { width: size, height: size });
  return Buffer.from(await res.arrayBuffer());
}

/** The full photo (400px) and the list thumbnail (144px), like a real upload. */
export async function portrait(seed, look) {
  const svg = portraitSvg(seed, look);
  const [photo, thumb] = await Promise.all([renderPng(svg, 400), renderPng(svg, 144)]);
  return { photo, thumb, mime: "image/png" };
}
