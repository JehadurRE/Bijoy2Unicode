// Spot-check that English fragments are preserved in the converted output.
//
// Run: npx --yes tsx tools/check-english.mjs

import fs from "node:fs";
import JSZip from "jszip";

const OUT = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated-unicode.docx";
const buf = fs.readFileSync(OUT);
const zip = await JSZip.loadAsync(buf);

const xml = await zip.file("word/document.xml").async("string");
const allText = (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
  .map((m) =>
    m
      .replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  )
  .join(" ");

const probes = [
  "BIO",
  "Data",
  "DDG",
  "BCS",
  "Photo",
  "Note",
  "Page",
  "Sl",
  "No",
  "Official",
  "Visit",
  "Training",
  "Workshop",
  "MD.",
];
for (const p of probes) {
  const idx = allText.indexOf(p);
  if (idx >= 0) {
    const ctx = allText.slice(Math.max(0, idx - 20), idx + p.length + 20);
    console.log(`✓ "${p}" found: …${ctx.replace(/\s+/g, " ")}…`);
  } else {
    console.log(`× "${p}" NOT found`);
  }
}

console.log("\n--- First 800 chars of converted body ---");
console.log(allText.replace(/\s+/g, " ").slice(0, 800));
