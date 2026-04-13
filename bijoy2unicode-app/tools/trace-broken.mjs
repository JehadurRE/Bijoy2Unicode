// Trace a broken case: cwiwPwZ now in Times New Roman → should convert.
import fs from "node:fs";
import JSZip from "jszip";

const SRC = "E:/JehadurRE/Bijoy2Unicode/testfiles/BIO Data-DDG_updated.docx";
const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml").async("string");

const idx = xml.indexOf("cwiwPwZ");
const ctxStart = Math.max(0, idx - 600);
const ctxEnd = Math.min(xml.length, idx + 300);
console.log(xml.slice(ctxStart, ctxEnd));
