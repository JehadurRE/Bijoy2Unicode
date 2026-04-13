import fs from "node:fs";
import JSZip from "jszip";

const OUT = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated-unicode.docx";
const buf = fs.readFileSync(OUT);
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml").async("string");
const t = (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
  .map((m) => m.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, ""))
  .join(" | ");
const idx = t.indexOf("কর্ম");
console.log("first hit at", idx);
console.log("context:", JSON.stringify(t.slice(Math.max(0, idx - 30), idx + 60)));
// Look for variants
for (const target of ["কর্ম", "কর্মকর্তা", "কর্মকতার্", "কম্রকর্তা"]) {
  const i = t.indexOf(target);
  console.log(target, "→", i >= 0 ? "found at " + i : "NOT FOUND");
}
