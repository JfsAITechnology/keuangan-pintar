import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((m) => m[1])
  .filter((s) => s.trim());

for (const [i, code] of scripts.entries()) {
  try {
    new Function(code);
  } catch (error) {
    throw new Error(`index.html inline script ${i + 1} failed syntax check: ${error.message}`);
  }
}

try {
  new Function(sw);
} catch (error) {
  throw new Error(`sw.js failed syntax check: ${error.message}`);
}

const requiredIds = [
  "authView","authForm","authEmail","authPassword","authSubmit","appView",
  "appStatus","balance","income","expense","monthLabel","transactions",
  "dailyBreakdown","chart","entryForm","saveEntryBtn","entryAmount",
  "entryCategory","entryDate","scannerModal","receipt","ocrResult"
];

for (const id of requiredIds) {
  const pattern = new RegExp(`id=["']${id.replace(/[.*+?^{}()|[\\]\\\\]/g, "\\\\$&")}["']`);
  if (!pattern.test(html)) throw new Error(`Missing required DOM id: ${id}`);
}

const requiredSnippets = [
  'button type="submit" id="saveEntryBtn"',
  'cache:"no-store"',
  'user.is_anonymous',
  '.range(from,from+999)',
  'source:"manual"',
  'source:"ocr"',
  'type==="income"',
  'type==="expense"'
];

for (const snippet of requiredSnippets) {
  if (!html.includes(snippet)) throw new Error(`Missing critical runtime guard/snippet: ${snippet}`);
}

if (/service_role|sb_secret_/i.test(html)) {
  throw new Error("Secret/service-role credential found in browser code.");
}

if (!sw.includes('keuangan-pintar-v5')) {
  throw new Error("Service Worker cache version was not bumped to v5.");
}

console.log("Keuangan Pintar static validation: PASS");
console.log(`Inline scripts checked: ${scripts.length}`);
console.log(`Required DOM ids checked: ${requiredIds.length}`);
