// Trace the full font-inheritance chain for known leftover Bijoy fragments
// (cwiwPwZ bs, GwWG, eQi 5gvm 17w`b). Useful when a particular fragment
// wasn't being converted.
//
// Run: npx --yes tsx tools/trace-low-ascii.mjs

import fs from "node:fs";
import JSZip from "jszip";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);

const docXml = await zip.file("word/document.xml").async("string");
const stylesXml = await zip.file("word/styles.xml").async("string");

// Parse styles map.
const styles = new Map();
const styleRe = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g;
let sm;
while ((sm = styleRe.exec(stylesXml))) {
  const id = sm[1].match(/w:styleId="([^"]+)"/)?.[1];
  if (!id) continue;
  const basedOn = sm[2].match(/<w:basedOn\b[^>]*w:val="([^"]+)"/)?.[1];
  const ft = sm[2].match(/<w:rFonts\b[^/>]*\/?>/)?.[0];
  styles.set(id, {
    basedOn,
    ascii: ft?.match(/w:ascii="([^"]+)"/)?.[1],
    hAnsi: ft?.match(/w:hAnsi="([^"]+)"/)?.[1],
    cs: ft?.match(/w:cs="([^"]+)"/)?.[1],
  });
}

// docDefaults
const ddM = stylesXml.match(/<w:rPrDefault\b[^>]*>([\s\S]*?)<\/w:rPrDefault>/);
const ddFontTag = ddM?.[1].match(/<w:rFonts\b[^/>]*\/?>/)?.[0];
const docDefault = {
  ascii: ddFontTag?.match(/w:ascii="([^"]+)"/)?.[1],
  hAnsi: ddFontTag?.match(/w:hAnsi="([^"]+)"/)?.[1],
  cs: ddFontTag?.match(/w:cs="([^"]+)"/)?.[1],
};
console.log("docDefaults:", docDefault);

function resolveStyle(id) {
  if (!id) return { ...docDefault };
  const s = styles.get(id);
  if (!s) return { ...docDefault };
  const base = resolveStyle(s.basedOn);
  return {
    ascii: s.ascii ?? base.ascii,
    hAnsi: s.hAnsi ?? base.hAnsi,
    cs: s.cs ?? base.cs,
  };
}

const targets = ["cwiwPwZ bs", "GwWG", "eQi 5gvm 17w`b"];
const paraRe = /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g;
let pm;
while ((pm = paraRe.exec(docXml))) {
  const pBody = pm[2];
  const matchedTarget = targets.find((t) => pBody.includes(t));
  if (!matchedTarget) continue;

  const pPr = pBody.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
  const paraStyle = pPr?.[1].match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1];
  const pFontTag = pPr?.[1]
    .match(/<w:rPr\b[^>]*>[\s\S]*?<w:rFonts\b[^/>]*\/?>/)?.[0]
    ?.match(/<w:rFonts\b[^/>]*\/?>/)?.[0];

  const paraStyleFont = resolveStyle(paraStyle);
  console.log(`\n=== "${matchedTarget}" ===`);
  console.log("paraStyle:", paraStyle);
  console.log("paraStyle resolved font:", paraStyleFont);
  console.log("paragraph <w:pPr><w:rPr><w:rFonts>:", pFontTag);

  const runRe = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
  let rm;
  while ((rm = runRe.exec(pBody))) {
    const body = rm[2];
    if (!body.includes(matchedTarget)) continue;
    const rPrFontTag = body.match(/<w:rFonts\b[^/>]*\/?>/)?.[0];
    const rStyle = body.match(/<w:rStyle\b[^>]*w:val="([^"]+)"/)?.[1];
    console.log("  run <w:rStyle>:", rStyle);
    console.log("  run <w:rFonts>:", rPrFontTag);
    if (rStyle) {
      console.log("  run-style resolved:", resolveStyle(rStyle));
    }
    console.log(
      "  run text:",
      body.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/)?.[1]
    );
  }
}
