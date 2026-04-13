// Convert the test docx end-to-end, then scan every output part for any
// leftover Bijoy bytes and pinpoint user-reported fragments.
//
// Run: npx --yes tsx tools/convert-and-diag.mjs

import fs from "node:fs";
import JSZip from "jszip";
import { convertDocx } from "../src/lib/format-converters.ts";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const OUT = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated-unicode.docx";

console.log("=== Re-running conversion ===");
const buf = fs.readFileSync(SRC);
const blob = new Blob([buf]);
const outBlob = await convertDocx(blob, () => {}, false);
const outArr = new Uint8Array(await outBlob.arrayBuffer());
fs.writeFileSync(OUT, outArr);

const inZip = await JSZip.loadAsync(buf);
const outZip = await JSZip.loadAsync(outArr);

console.log("\n=== Files in input docx ===");
console.log(
  Object.keys(inZip.files).filter((n) => n.endsWith(".xml")).sort().join("\n")
);

console.log("\n=== Searching every part of the OUTPUT for any Bijoy bytes ===");
function isBijoyByte(c) {
  return (c >= 0x80 && c <= 0x24f) || (c >= 0x2010 && c <= 0x203a);
}
const partsToCheck = Object.keys(outZip.files).filter(
  (n) => n.endsWith(".xml") && !n.includes("theme") && !n.includes("settings")
);
for (const name of partsToCheck) {
  const xml = await outZip.file(name).async("string");
  const tMatches = xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  let bijoyTextRuns = 0;
  const samples = [];
  for (const m of tMatches) {
    const inner = m.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "");
    const decoded = inner
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"');
    let hasB = false;
    for (let i = 0; i < decoded.length; i++) {
      if (isBijoyByte(decoded.charCodeAt(i))) {
        hasB = true;
        break;
      }
    }
    if (hasB) {
      bijoyTextRuns++;
      if (samples.length < 5) samples.push(decoded);
    }
  }
  if (bijoyTextRuns > 0) {
    console.log(`\n[${name}]  ${bijoyTextRuns} <w:t> elements with Bijoy bytes`);
    samples.forEach((s) => console.log("    ·", JSON.stringify(s).slice(0, 120)));
  }
}

console.log("\n=== Search for specific user-reported fragments ===");
const needles = ["cwiwPwZ", "bs", "bvg", "GwWG", "eQi", "gvm", "w`b"];
for (const name of partsToCheck) {
  const xml = await outZip.file(name).async("string");
  for (const n of needles) {
    if (xml.includes(n)) {
      const idx = xml.indexOf(n);
      const rStart = xml.lastIndexOf("<w:r ", idx);
      const rEnd = xml.indexOf("</w:r>", idx);
      const snippet =
        rStart >= 0 && rEnd > rStart
          ? xml.slice(rStart, rEnd + 6)
          : xml.slice(Math.max(0, idx - 80), idx + 80);
      console.log(`\n[${name}] found "${n}":`);
      console.log("  ", snippet.slice(0, 350));
    }
  }
}
