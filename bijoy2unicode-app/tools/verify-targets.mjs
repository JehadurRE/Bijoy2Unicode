// Confirm the converted output has English fragments preserved as-is.
//
// Run: npx --yes tsx tools/verify-targets.mjs

import fs from "node:fs";
import JSZip from "jszip";

const OUT = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated-unicode.docx";
const buf = fs.readFileSync(OUT);
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml").async("string");
const allText = (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
  .map((m) => m.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "").replace(/&amp;/g, "&"))
  .join(" | ");

const targets = [
  "Official/Private",
  "Official Visit",
  "13th South Asian Games-2019",
  "South Asian Games",
  "Workshop",
  "FAT",
  "Type of visit",
  "Sl. No",
  "MD. NURUL",
];

for (const t of targets) {
  if (allText.includes(t)) {
    console.log(`✓ "${t}" preserved`);
  } else {
    console.log(`× "${t}" NOT FOUND in output`);
  }
}
