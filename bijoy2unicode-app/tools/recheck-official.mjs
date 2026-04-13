// Locate every "Official Visit" run in the original .docx with full context
// so we can verify Latin runs (Calibri / Times New Roman) aren't being
// misclassified as Bijoy.
//
// Run: npx --yes tsx tools/recheck-official.mjs

import fs from "node:fs";
import JSZip from "jszip";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml").async("string");

let pos = xml.indexOf("Official Visit");
let occurrence = 0;
while (pos >= 0 && occurrence < 8) {
  const ctxStart = Math.max(0, pos - 400);
  const ctxEnd = Math.min(xml.length, pos + 200);
  console.log(`\n--- occurrence ${occurrence} @ ${pos} ---`);
  console.log(xml.slice(ctxStart, ctxEnd));
  pos = xml.indexOf("Official Visit", pos + 1);
  occurrence++;
}
