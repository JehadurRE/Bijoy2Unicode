// Trace exactly how "13th South Asian Games-2019" and "Official/Private"
// runs got classified (font, paragraph context, why convert was true).
//
// Run: npx --yes tsx tools/trace-false-positives.mjs

import fs from "node:fs";
import JSZip from "jszip";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml").async("string");
const stylesXml = await zip.file("word/styles.xml").async("string");

// Parse styles map (with basedOn).
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
const ddM = stylesXml.match(/<w:rPrDefault\b[^>]*>([\s\S]*?)<\/w:rPrDefault>/);
const ddFontTag = ddM?.[1].match(/<w:rFonts\b[^/>]*\/?>/)?.[0];
const docDefault = {
  ascii: ddFontTag?.match(/w:ascii="([^"]+)"/)?.[1],
  hAnsi: ddFontTag?.match(/w:hAnsi="([^"]+)"/)?.[1],
  cs: ddFontTag?.match(/w:cs="([^"]+)"/)?.[1],
};
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

const targets = ["South Asian Games", "Official/Private"];

const paraRe = /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g;
let pm;
while ((pm = paraRe.exec(xml))) {
  const pBody = pm[2];
  const matchedTarget = targets.find((t) => pBody.includes(t));
  if (!matchedTarget) continue;

  const pPr = pBody.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
  const paraStyle = pPr?.[1].match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1];
  const pFontTag = pPr?.[1]
    .match(/<w:rPr\b[^>]*>[\s\S]*?<w:rFonts\b[^/>]*\/?>/)?.[0]
    ?.match(/<w:rFonts\b[^/>]*\/?>/)?.[0];

  console.log(`\n=== "${matchedTarget}" ===`);
  console.log("paraStyle:", paraStyle);
  console.log("paraStyle resolved:", resolveStyle(paraStyle));
  console.log("paragraph <w:pPr><w:rFonts>:", pFontTag);

  const runRe = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
  let rm;
  while ((rm = runRe.exec(pBody))) {
    const body = rm[2];
    const text = (body.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
      .map((t) => t.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, ""))
      .join("");
    if (!text || !targets.some((t) => text.includes(t.split("/")[0]) || text.includes(t))) {
      // Show all runs in this paragraph too, for context.
      if (text) {
        console.log("  - run:", JSON.stringify(text).slice(0, 80), "rFonts:",
          body.match(/<w:rFonts\b[^/>]*\/?>/)?.[0] || "(none)");
      }
      continue;
    }
    const rPrFontTag = body.match(/<w:rFonts\b[^/>]*\/?>/)?.[0];
    const rStyle = body.match(/<w:rStyle\b[^>]*w:val="([^"]+)"/)?.[1];
    console.log("  >>> MATCH run:");
    console.log("      text:", JSON.stringify(text));
    console.log("      run <w:rStyle>:", rStyle);
    console.log("      run <w:rFonts>:", rPrFontTag);
    if (rStyle) console.log("      run-style resolved:", resolveStyle(rStyle));
  }
}
