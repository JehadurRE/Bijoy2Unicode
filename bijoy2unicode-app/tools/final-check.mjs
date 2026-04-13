// Final verification: scan every <w:t> body in the converted .docx for any
// remaining Bijoy bytes and tally specific known-bad fragments.
//
// Run: npx --yes tsx tools/final-check.mjs

import fs from "node:fs";
import JSZip from "jszip";

const OUT = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated-unicode.docx";
const buf = fs.readFileSync(OUT);
const zip = await JSZip.loadAsync(buf);

let totalRuns = 0;
let bijoyRuns = 0;
const samples = [];

for (const name of Object.keys(zip.files)) {
  if (!name.endsWith(".xml")) continue;
  if (name.includes("theme") || name.includes("settings")) continue;
  const xml = await zip.file(name).async("string");
  const tMatches = xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  for (const m of tMatches) {
    totalRuns++;
    const inner = m
      .replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"');
    let hasBijoy = false;
    for (let i = 0; i < inner.length; i++) {
      const c = inner.charCodeAt(i);
      if ((c >= 0x80 && c <= 0x24f) || (c >= 0x2010 && c <= 0x203a)) {
        hasBijoy = true;
        break;
      }
    }
    if (hasBijoy) {
      bijoyRuns++;
      if (samples.length < 20) samples.push({ part: name, text: inner });
    }
  }
}

console.log(`Total <w:t> elements: ${totalRuns}`);
console.log(`<w:t> elements still containing Bijoy bytes: ${bijoyRuns}`);
samples.forEach((s) =>
  console.log(`  [${s.part}] ${JSON.stringify(s.text).slice(0, 120)}`)
);

const target = ["cwiwPwZ", "GwWG", "eQi", "5gvm", "17w`b", "bvg", "wcZvi"];
const targetHits = new Map();
for (const name of Object.keys(zip.files)) {
  if (!name.endsWith(".xml")) continue;
  if (name.includes("theme") || name.includes("settings")) continue;
  const xml = await zip.file(name).async("string");
  const tMatches = xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  for (const m of tMatches) {
    const inner = m
      .replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "")
      .replace(/&amp;/g, "&");
    for (const t of target) {
      if (inner.includes(t)) {
        targetHits.set(t, (targetHits.get(t) ?? 0) + 1);
      }
    }
  }
}
console.log("\nUser-reported fragments still in <w:t> text:");
for (const t of target) {
  console.log(`  "${t}": ${targetHits.get(t) ?? 0}`);
}
