// Walk every Bijoy run in the input docx and print its resolved font slot
// info. Used to figure out why a run isn't being detected as Bijoy.
//
// Run: npx --yes tsx tools/inspect-runs.mjs

import fs from "node:fs";
import JSZip from "jszip";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);

const docXml = await zip.file("word/document.xml").async("string");
const stylesXml = (await zip.file("word/styles.xml")?.async("string")) || "";

const stylesById = new Map();
const styleRe = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g;
let sm;
while ((sm = styleRe.exec(stylesXml))) {
  const id = sm[1].match(/w:styleId="([^"]+)"/)?.[1];
  if (!id) continue;
  const fontTag = sm[2].match(/<w:rFonts\b[^/>]*\/?>/);
  if (!fontTag) continue;
  const attrs = fontTag[0];
  stylesById.set(id, {
    ascii: attrs.match(/w:ascii="([^"]+)"/)?.[1],
    hAnsi: attrs.match(/w:hAnsi="([^"]+)"/)?.[1],
    cs: attrs.match(/w:cs="([^"]+)"/)?.[1],
  });
}

const paraRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const fontHits = new Map();
const exampleByFont = new Map();
const allParas = docXml.match(paraRe) || [];

for (const p of allParas) {
  const pPr = p.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
  const paraStyle = pPr?.[1].match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1];
  const paraRPrFontTag = pPr?.[1].match(
    /<w:rPr\b[^>]*>[\s\S]*?<w:rFonts\b[^/>]*\/?>/
  );
  const paraRPrFont = paraRPrFontTag?.[0].match(/<w:rFonts\b[^/>]*\/?>/)?.[0];

  const runRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let m;
  while ((m = runRe.exec(p))) {
    const body = m[1];
    const text = (body.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
      .map((t) => t.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, ""))
      .join("");
    if (!text) continue;
    let hasBijoy = false;
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if ((c >= 0x80 && c <= 0x24f) || (c >= 0x2010 && c <= 0x203a)) {
        hasBijoy = true;
        break;
      }
    }
    if (!hasBijoy) continue;

    const rFontTag = body.match(/<w:rFonts\b[^/>]*\/?>/)?.[0];
    const runFont = rFontTag ? rFontTag : paraRPrFont;
    let ascii = runFont?.match(/w:ascii="([^"]+)"/)?.[1];
    let hAnsi = runFont?.match(/w:hAnsi="([^"]+)"/)?.[1];
    let cs = runFont?.match(/w:cs="([^"]+)"/)?.[1];

    if (!ascii && !hAnsi && !cs && paraStyle) {
      const sf = stylesById.get(paraStyle);
      if (sf) {
        ascii = sf.ascii;
        hAnsi = sf.hAnsi;
        cs = sf.cs;
      }
    }

    const tag = `ascii=${ascii ?? "-"}  hAnsi=${hAnsi ?? "-"}  cs=${cs ?? "-"}`;
    fontHits.set(tag, (fontHits.get(tag) ?? 0) + 1);
    if (!exampleByFont.has(tag)) {
      exampleByFont.set(tag, text.slice(0, 60));
    }
  }
}

console.log("Font combinations on Bijoy runs:\n");
for (const [tag, count] of [...fontHits.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  × ${String(count).padStart(4)}  ${tag}`);
  console.log(`        e.g. ${JSON.stringify(exampleByFont.get(tag))}`);
}
