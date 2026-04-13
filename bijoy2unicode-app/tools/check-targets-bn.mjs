// Verify the specific Bangla phrases the user mentioned are correct in the
// converted output.
//
// Run: npx --yes tsx tools/check-targets-bn.mjs

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
  .join(" | ");

const targets = [
  "রেকর্ড",
  "বিস্তারিত",
  "সংক্রান্ত",
  "তথ্যসমূহঃ",
  "নূরুল",
  "মোঃ",
  "ফরিদী",
  "মহাপরিচালক",
  "কর্মকর্তা",
];
for (const t of targets) {
  if (allText.includes(t)) {
    console.log(`✓ "${t}" found`);
  } else {
    console.log(`× "${t}" NOT found`);
  }
}
