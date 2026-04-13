// Find the remaining "eQi" runs in the input and inspect them.
import fs from "node:fs";
import JSZip from "jszip";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml").async("string");

const runRe = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
let m;
let count = 0;
while ((m = runRe.exec(xml))) {
  const body = m[2];
  const text = (body.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
    .map((t) => t.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, ""))
    .join("");
  if (!text.includes("eQi")) continue;
  count++;
  console.log(`\n--- run ${count} ---`);
  console.log("text:", JSON.stringify(text));
  console.log("body:", body.slice(0, 300));
  // Walk back to enclosing <w:p> to see paragraph context.
  const pStart = xml.lastIndexOf("<w:p ", m.index);
  const pEnd = xml.indexOf("</w:p>", m.index);
  const pBody = xml.slice(pStart, pEnd);
  const pPr = pBody.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
  console.log("pPr:", pPr?.[1]?.slice(0, 300) || "(none)");
}
