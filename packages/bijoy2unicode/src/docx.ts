/**
 * Document-format Bijoy → Unicode converters.
 *
 * Supported (all client-side, no external services):
 *   .docx  – ZIP of XML parts. Walks every <w:t>/<w:instrText> with full
 *            font inheritance (run → run-style → paragraph → paragraph-style
 *            → docDefaults). Strict font-aware detection by default.
 *   .odt   – ZIP. Walks text:p / text:span / text:h content with
 *            style:font-name resolution.
 *   .rtf   – Decodes \\'xx CP1252 escapes, converts, re-emits as \uN?
 *            Unicode escapes. ASCII text passes through.
 *   .html  – DOMParser-based text-node walk (browser only) with
 *            inherited font detection from <font face> and style.
 *   .txt   – Plain text, line by line.
 *
 * Legacy `.doc` (binary) is intentionally NOT supported in this package
 * because it requires a binary OLE parser. For high-fidelity .doc support,
 * convert via LibreOffice / CloudConvert first.
 *
 * @example Convert a .docx in the browser
 * ```ts
 * import { convertDocx } from "bijoy2unicode/docx";
 *
 * const file = document.querySelector("input").files[0];
 * const blob = await convertDocx(file);
 * // ...trigger a download
 * ```
 */

import JSZip from "jszip";
import {
  convertBijoyToUnicode,
  looksLikeBijoy,
  hasBengaliUnicode as containsBengaliUnicode,
} from "./core.js";

// ---------- progress / options ----------

/** Progress info passed to the optional `onProgress` callback. */
export interface ProgressInfo {
  stage: string;
  percent: number;
}

export type ProgressFn = (info: ProgressInfo) => void;

/** Options shared by every convert helper. */
export interface ConvertOptions {
  /** Optional progress callback. */
  onProgress?: ProgressFn;
  /**
   * When `true`, every text run is treated as Bijoy regardless of the font
   * tag or content heuristics. Useful for `.txt` / `.rtf` files where there
   * is no font information, or for `.docx` files where Bijoy text was typed
   * in a generic font like Times New Roman. Default: `false`.
   */
  force?: boolean;
}

// ---------- helpers ----------

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const BIJOY_FONT_PATTERNS: RegExp[] = [
  /Sutonny\s*MJ/i,
  /SutonnyMJ/i,
  /SutonnyOMJ/i,
  /Sutonny\s*OMJ/i,
  /Sutonny\s*XMJ/i,
  /SutonnyXMJ/i,
  /Sulekha[a-z\s]*/i,
  /Boishakhi/i,
  /Lekhoni/i,
  /BijoyEkattor/i,
  /Bijoy[a-z0-9 ]*MJ/i,
  /[A-Za-z]+MJ\b/i,
  /\bMJ\s+[A-Za-z]+/i,
];

const UNICODE_FONT_PATTERNS: RegExp[] = [
  /Nikosh/i,
  /SolaimanLipi/i,
  /Solaiman\s*Lipi/i,
  /Kalpurush/i,
  /Siyam\s*Rupali/i,
  /Mukti/i,
  /Vrinda/i,
  /Shonar\s*Bangla/i,
  /Hind\s*Siliguri/i,
  /Noto\s*Sans\s*Bengali/i,
  /Noto\s*Serif\s*Bengali/i,
  /AdorshoLipi/i,
];

const LATIN_FONT_PATTERNS: RegExp[] = [
  /^Calibri$/i,
  /^Cambria$/i,
  /Times\s*New\s*Roman/i,
  /^Arial$/i,
  /Arial\s*Unicode\s*MS/i,
  /^Tahoma$/i,
  /^Verdana$/i,
  /^Georgia$/i,
  /^Helvetica$/i,
  /^Segoe\s*UI/i,
  /^Trebuchet\s*MS$/i,
  /^Courier\s*New$/i,
  /^Consolas$/i,
  /^Liberation/i,
];

function fontIsLatin(name: string | null | undefined): boolean {
  if (!name) return false;
  return LATIN_FONT_PATTERNS.some((p) => p.test(name));
}

function fontIsBijoyName(name: string | null | undefined): boolean {
  if (!name) return false;
  return BIJOY_FONT_PATTERNS.some((p) => p.test(name));
}

function fontIsUnicodeBangla(name: string | null | undefined): boolean {
  if (!name) return false;
  return UNICODE_FONT_PATTERNS.some((p) => p.test(name));
}

const UNICODE_FONT = "Nikosh";

const ALL_FONT_REGEX = (() => {
  const sources = BIJOY_FONT_PATTERNS.map((r) => r.source);
  return new RegExp(`(${sources.join("|")})`, "gi");
})();

function swapBijoyFontInBlock(s: string): string {
  return s.replace(ALL_FONT_REGEX, UNICODE_FONT);
}

const BIJOY_BIGRAMS = new Set([
  "wA","wB","wC","wD","wE","wF","wG","wH","wI","wJ","wK","wL","wM","wN",
  "wO","wP","wQ","wR","wS","wT","wU","wV","wW","wX","wY","wZ",
  "wa","wb","wc","wd","wf","wg","wh","wj","wk","wl","wm","wn","wo",
  "wp","wq","wr","wt","wv",
  "Av","Bv","Cv","Dv","Ev","Fv","Gv","Hv","Iv","Jv","Kv","Lv","Mv","Nv",
  "Ov","Pv","Qv","Sv","Tv","Uv","Vv","Wv","Xv","Yv","Zv","_v",
  "av","bv","cv","dv","ev","fv","gv","hv","iv","jv","kv","lv","mv","nv",
  "ov","pv","qv","rv","tv",
  "Mz","Mª","Mš","Kª","Pª","Zª",
  "©K","©M","©Z","©c","©e","©g","©h","©i","©k","©l","©m",
  "Ñ","Œ","‹","‡","ª","Ö","Š",
  "eK","eL","eM","eN","eP","eQ","eR","eS","eT","eU","eV","eW","eX",
  "eY","eZ",
]);

function countBijoyBigrams(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (BIJOY_BIGRAMS.has(s.slice(i, i + 2))) n++;
  }
  return n;
}

function hasBijoyBigram(s: string): boolean {
  return countBijoyBigrams(s) > 0;
}

const ENGLISH_HINT_WORDS = new Set([
  "the","of","and","to","in","is","was","are","be","by","for","on","at","with","from","this","that",
  "as","or","if","an","a","it","its","but","not","you","your","my","our","their","they","i","we",
  "name","date","age","year","month","day","sir","madam","mr","mrs","ms","dr","prof","mister",
  "born","father","mother","spouse","son","daughter","family","address","village","district",
  "thana","upazila","division","country","email","phone","mobile","cell","office","home","present",
  "permanent","yes","no","male","female","married","unmarried","single","total","page",
  "education","school","college","university","degree","class","subject","department","branch",
  "designation","post","position","rank","grade","officer","officers","service","duty","duties",
  "joining","retirement","passport","number","reg","regd","cert","certificate","training",
  "experience","english","bangla","bengali","national","government","ministry","secretariat",
  "honorable","honourable","please","kindly","thank","thanks","regards","yours","faithfully",
  "sincerely","whatsapp","telephone",
  "bio","data","cv","resume","photo","total","sl","sn","ref","subject",
  "ddg","adg","ig","sp","asp","gen","brig","col","lt","capt","major","maj","cmdr","cmdt",
]);

function looksLikeEnglish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/`/.test(t)) return false;
  if (/[~^][A-Za-z]/.test(t)) return false;
  if (/[A-Za-z]&/.test(t)) return false;
  if (/\d[A-Za-z]/.test(t)) return false;
  if (hasBijoyBigram(t)) return false;
  if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{3,}/.test(t)) return false;
  const lower = t.toLowerCase();
  const tokens = lower.match(/[a-z][a-z']*/g) || [];
  for (const tok of tokens) if (ENGLISH_HINT_WORDS.has(tok)) return true;
  const letters = lower.replace(/[^a-z]/g, "");
  if (letters.length === 0) return true;
  if (letters.length < 4) {
    return tokens.every((tok) => ENGLISH_HINT_WORDS.has(tok));
  }
  let vowels = 0;
  for (const c of letters) if ("aeiouy".includes(c)) vowels++;
  const ratio = vowels / letters.length;
  if (ratio < 0.35) return false;
  let earlyVowel = false;
  for (let i = 0; i < Math.min(4, letters.length); i++) {
    if ("aeiouy".includes(letters[i])) {
      earlyVowel = true;
      break;
    }
  }
  return earlyVowel;
}

// ---------- .docx ----------

const DOCX_PARTS = [
  /^word\/document\.xml$/,
  /^word\/header\d*\.xml$/,
  /^word\/footer\d*\.xml$/,
  /^word\/footnotes\.xml$/,
  /^word\/endnotes\.xml$/,
  /^word\/comments\.xml$/,
  /^word\/glossary\/document\.xml$/,
];

interface FontRef {
  ascii?: string;
  hAnsi?: string;
  cs?: string;
  eastAsia?: string;
}

function mergeFontRef(base: FontRef, override: FontRef): FontRef {
  return {
    ascii: override.ascii ?? base.ascii,
    hAnsi: override.hAnsi ?? base.hAnsi,
    cs: override.cs ?? base.cs,
    eastAsia: override.eastAsia ?? base.eastAsia,
  };
}

function chooseRelevantFont(font: FontRef, runText: string): string | undefined {
  let hasNonAscii = false;
  for (let i = 0; i < runText.length; i++) {
    if (runText.charCodeAt(i) > 0x7e) {
      hasNonAscii = true;
      break;
    }
  }
  if (hasNonAscii) {
    return font.cs ?? font.ascii ?? font.hAnsi ?? font.eastAsia;
  }
  return font.ascii ?? font.hAnsi ?? font.cs ?? font.eastAsia;
}

function fontRefIsBijoyForText(f: FontRef, runText: string): boolean {
  return fontIsBijoyName(chooseRelevantFont(f, runText));
}

function fontRefIsUnicodeForText(f: FontRef, runText: string): boolean {
  return fontIsUnicodeBangla(chooseRelevantFont(f, runText));
}

function parseRFonts(tag: string): FontRef {
  const out: FontRef = {};
  const m = tag.match(/<w:rFonts\b([^/>]*)\/?>/);
  if (!m) return out;
  const attrs = m[1];
  const grab = (name: string) => {
    const am = attrs.match(new RegExp(`${name}="([^"]+)"`));
    return am ? am[1] : undefined;
  };
  out.ascii = grab("w:ascii");
  out.hAnsi = grab("w:hAnsi");
  out.cs = grab("w:cs");
  out.eastAsia = grab("w:eastAsia");
  return out;
}

interface StyleEntry {
  id: string;
  basedOn?: string;
  font: FontRef;
}

function parseStylesXml(stylesXml: string): {
  byId: Map<string, StyleEntry>;
  defaults: FontRef;
} {
  const byId = new Map<string, StyleEntry>();
  const styleRe = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(stylesXml))) {
    const attrs = sm[1];
    const body = sm[2];
    const idM = attrs.match(/w:styleId="([^"]+)"/);
    if (!idM) continue;
    const id = idM[1];
    const basedM = body.match(/<w:basedOn\b[^>]*w:val="([^"]+)"/);
    const fontTag = body.match(/<w:rFonts\b[^/>]*\/?>/);
    const font = fontTag ? parseRFonts(fontTag[0]) : {};
    byId.set(id, { id, basedOn: basedM?.[1], font });
  }

  let defaults: FontRef = {};
  const ddM = stylesXml.match(/<w:rPrDefault\b[^>]*>([\s\S]*?)<\/w:rPrDefault>/);
  if (ddM) {
    const fontTag = ddM[1].match(/<w:rFonts\b[^/>]*\/?>/);
    if (fontTag) defaults = parseRFonts(fontTag[0]);
  }
  return { byId, defaults };
}

function resolveStyleFont(
  styleId: string | undefined | null,
  styles: Map<string, StyleEntry>,
  defaults: FontRef,
  visited: Set<string> = new Set()
): FontRef {
  if (!styleId) return { ...defaults };
  if (visited.has(styleId)) return { ...defaults };
  visited.add(styleId);
  const s = styles.get(styleId);
  if (!s) return { ...defaults };
  const base = resolveStyleFont(s.basedOn, styles, defaults, visited);
  return mergeFontRef(base, s.font);
}

interface DocContext {
  styles: Map<string, StyleEntry>;
  defaults: FontRef;
}

function runBodyText(runBody: string): string {
  const ts = runBody.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  return ts
    .map((t) => decodeXmlText(t.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "")))
    .join("");
}

function textHasBijoyMarkers(runBody: string): boolean {
  const text = runBodyText(runBody);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0080 && c <= 0x024f) return true;
    if (c >= 0x2010 && c <= 0x203a) return true;
  }
  return false;
}

function computeIsBijoyHeavy(xml: string): boolean {
  for (const p of BIJOY_FONT_PATTERNS) {
    if (p.test(xml)) return true;
  }
  let bijoyChars = 0;
  let totalChars = 0;
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tRe.exec(xml))) {
    const inner = decodeXmlText(tm[1]);
    totalChars += inner.length;
    for (let i = 0; i < inner.length; i++) {
      const c = inner.charCodeAt(i);
      if ((c >= 0x0080 && c <= 0x024f) || (c >= 0x2010 && c <= 0x203a)) {
        bijoyChars++;
      }
    }
  }
  if (totalChars === 0) return false;
  return bijoyChars / totalChars > 0.05;
}

function transformDocxXml(
  xml: string,
  ctx: DocContext,
  force = false,
  bijoyHeavy = false
): string {
  const paraRe = /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g;
  let out = xml.replace(paraRe, (_m, pOpen: string, pBody: string, pClose: string) => {
    const pPr = pBody.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
    const paraStyleId =
      pPr?.[1].match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] || null;
    const paraRPrFontTag = pPr?.[1].match(
      /<w:rPr\b[^>]*>[\s\S]*?<w:rFonts\b[^/>]*\/?>/
    );
    const paraRPrFont = paraRPrFontTag
      ? parseRFonts(paraRPrFontTag[0].match(/<w:rFonts\b[^/>]*\/?>/)![0])
      : {};

    const paraFont = mergeFontRef(
      resolveStyleFont(paraStyleId, ctx.styles, ctx.defaults),
      paraRPrFont
    );

    const newBody = pBody.replace(
      /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g,
      (__, rOpen: string, rBody: string, rClose: string) => {
        const rPr = rBody.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/);
        const runStyleId =
          rPr?.[1].match(/<w:rStyle\b[^>]*w:val="([^"]+)"/)?.[1] || null;
        const runFontTag = rPr?.[1].match(/<w:rFonts\b[^/>]*\/?>/);
        const runFont = runFontTag ? parseRFonts(runFontTag[0]) : {};

        const effective = mergeFontRef(
          mergeFontRef(
            resolveStyleFont(runStyleId, ctx.styles, ctx.defaults),
            paraFont
          ),
          runFont
        );

        const plainText = runBodyText(rBody);
        const isBijoy = fontRefIsBijoyForText(effective, plainText);
        const isUnicode = fontRefIsUnicodeForText(effective, plainText);
        const isLatin = fontIsLatin(chooseRelevantFont(effective, plainText));
        const hasBangla = containsBengaliUnicode(plainText);
        const letterCount = (plainText.match(/[A-Za-z]/g) || []).length;
        const isShortLatinFragment = letterCount > 0 && letterCount <= 2;
        const hasHighByte = textHasBijoyMarkers(rBody);
        const hasHardBijoyMarker = hasHighByte || /`/.test(plainText);
        const bigramCount = countBijoyBigrams(plainText);
        const hasMultipleBigrams = bigramCount >= 2;
        const hasSoftBijoyMarker =
          /\d[A-Za-z]/.test(plainText) || bigramCount >= 1;

        let strongBijoy = hasMultipleBigrams;
        if (!strongBijoy && bigramCount === 1 && letterCount >= 3) {
          const lower = plainText.toLowerCase().replace(/[^a-z]/g, "");
          let v = 0;
          for (const c of lower) if ("aeiouy".includes(c)) v++;
          const ratio = lower.length ? v / lower.length : 0;
          if (ratio < 0.25) {
            strongBijoy = true;
          } else {
            const tokens = lower.match(/[a-z]+/g) || [];
            const allAlien =
              tokens.length > 0 &&
              tokens.every((t) => !ENGLISH_HINT_WORDS.has(t) && t.length <= 6);
            if (allAlien) strongBijoy = true;
          }
        }

        let convert: boolean;
        if (hasBangla) convert = false;
        else if (hasHardBijoyMarker) convert = true;
        else if (strongBijoy) convert = true;
        else if (isBijoy) convert = true;
        else if (isLatin && !isShortLatinFragment) convert = false;
        else if (isUnicode) convert = false;
        else if (hasSoftBijoyMarker) convert = true;
        else if (force) convert = true;
        else if (bijoyHeavy && !looksLikeEnglish(plainText)) convert = true;
        else convert = false;

        if (!convert) return rOpen + rBody + rClose;

        const converted = rBody
          .replace(
            /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g,
            (___, o: string, inner: string, c: string) => {
              if (!inner) return o + inner + c;
              const decoded = decodeXmlText(inner);
              if (containsBengaliUnicode(decoded)) return o + inner + c;
              return o + encodeXmlText(convertBijoyToUnicode(decoded)) + c;
            }
          )
          .replace(
            /(<w:instrText(?:\s[^>]*)?>)([\s\S]*?)(<\/w:instrText>)/g,
            (___, o: string, inner: string, c: string) => {
              if (!inner) return o + inner + c;
              const decoded = decodeXmlText(inner);
              if (containsBengaliUnicode(decoded)) return o + inner + c;
              return o + encodeXmlText(convertBijoyToUnicode(decoded)) + c;
            }
          );

        const finalBody = swapBijoyFontInBlock(converted);
        return rOpen + finalBody + rClose;
      }
    );

    return pOpen + newBody + pClose;
  });

  out = out.replace(/<w:rFonts\b[^/>]*\/?>/g, (tag) => swapBijoyFontInBlock(tag));
  return out;
}

/**
 * Convert a Microsoft Word `.docx` file from Bijoy / Sutonny MJ to Unicode.
 * Uses strict font-aware detection by default — English runs in non-Bijoy
 * fonts are preserved unchanged. Set `options.force = true` to convert
 * every run regardless of font.
 *
 * @example
 * ```ts
 * const fileInput = document.querySelector<HTMLInputElement>("input")!;
 * const blob = await convertDocx(fileInput.files![0]);
 * const url = URL.createObjectURL(blob);
 * ```
 */
export async function convertDocx(
  file: Blob,
  options: ConvertOptions = {}
): Promise<Blob> {
  const { onProgress, force = false } = options;
  onProgress?.({ stage: "Reading file", percent: 5 });
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  onProgress?.({ stage: "Parsing styles", percent: 15 });

  let ctx: DocContext = { styles: new Map(), defaults: {} };
  const stylesEntry = zip.file("word/styles.xml");
  if (stylesEntry) {
    const stylesXml = await stylesEntry.async("string");
    const parsed = parseStylesXml(stylesXml);
    ctx = { styles: parsed.byId, defaults: parsed.defaults };
  }

  onProgress?.({ stage: "Scanning document parts", percent: 25 });

  let bijoyHeavy = false;
  const mainDoc = zip.file("word/document.xml");
  if (mainDoc) {
    const mainXml = await mainDoc.async("string");
    bijoyHeavy = computeIsBijoyHeavy(mainXml);
  }

  const names = Object.keys(zip.files).filter((n) =>
    DOCX_PARTS.some((re) => re.test(n))
  );
  let processed = 0;
  for (const name of names) {
    const entry = zip.file(name);
    if (!entry) continue;
    const xml = await entry.async("string");
    zip.file(name, transformDocxXml(xml, ctx, force, bijoyHeavy));
    processed++;
    onProgress?.({
      stage: `Converted ${name}`,
      percent: 25 + Math.round((processed / Math.max(1, names.length)) * 60),
    });
  }

  if (stylesEntry) {
    const stylesXml = await stylesEntry.async("string");
    zip.file("word/styles.xml", swapBijoyFontInBlock(stylesXml));
  }

  onProgress?.({ stage: "Repackaging .docx", percent: 90 });
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  onProgress?.({ stage: "Done", percent: 100 });
  return blob;
}

// ---------- .odt ----------

/**
 * Convert an OpenDocument `.odt` file from Bijoy / Sutonny MJ to Unicode.
 */
export async function convertOdt(
  file: Blob,
  options: ConvertOptions = {}
): Promise<Blob> {
  const { onProgress, force = false } = options;
  onProgress?.({ stage: "Reading file", percent: 10 });
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((n) =>
    /^(content|styles|meta)\.xml$/.test(n)
  );

  onProgress?.({ stage: "Building style → font map", percent: 25 });
  const styleFontMap = new Map<string, string>();
  for (const name of names) {
    const entry = zip.file(name);
    if (!entry) continue;
    const xml = await entry.async("string");
    const blockRe = /<style:style\b([^>]*)>([\s\S]*?)<\/style:style>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(xml))) {
      const nameAttr = m[1].match(/style:name="([^"]+)"/);
      const fontAttr = m[2].match(/style:font-name="([^"]+)"/);
      if (nameAttr && fontAttr) {
        styleFontMap.set(nameAttr[1], fontAttr[1]);
      }
    }
  }

  onProgress?.({ stage: "Converting text", percent: 40 });
  const textElems =
    /(<text:(?:p|span|h)\b)([^>]*)>([\s\S]*?)(<\/text:(?:p|span|h)>)/g;
  let processed = 0;
  for (const name of names) {
    const entry = zip.file(name);
    if (!entry) continue;
    let xml = await entry.async("string");
    xml = xml.replace(textElems, (_m, openTag, attrs, inner, close) => {
      const sm = (attrs as string).match(/text:style-name="([^"]+)"/);
      const styleName = sm?.[1];
      const fontName = styleName ? styleFontMap.get(styleName) : null;
      const fontIsBijoy = fontIsBijoyName(fontName);
      const fontIsUnicode = fontIsUnicodeBangla(fontName);

      let convert: boolean;
      if (fontIsBijoy) convert = true;
      else if (fontIsUnicode) convert = false;
      else convert = force;

      if (!convert) return `${openTag}${attrs}>${inner}${close}`;

      const converted = (inner as string).replace(
        /(>)([^<]+)(<)/g,
        (__, gt: string, txt: string, lt: string) => {
          const decoded = decodeXmlText(txt);
          if (containsBengaliUnicode(decoded)) return gt + txt + lt;
          return gt + encodeXmlText(convertBijoyToUnicode(decoded)) + lt;
        }
      );
      const finalInner = (inner as string).includes("<")
        ? converted
        : (() => {
            const decoded = decodeXmlText(inner as string);
            if (containsBengaliUnicode(decoded)) return inner as string;
            return encodeXmlText(convertBijoyToUnicode(decoded));
          })();
      return `${openTag}${attrs}>${finalInner}${close}`;
    });

    xml = swapBijoyFontInBlock(xml);
    zip.file(name, xml);
    processed++;
    onProgress?.({
      stage: `Converted ${name}`,
      percent: 40 + Math.round((processed / Math.max(1, names.length)) * 45),
    });
  }

  onProgress?.({ stage: "Repackaging .odt", percent: 90 });
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.oasis.opendocument.text",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  onProgress?.({ stage: "Done", percent: 100 });
  return blob;
}

// ---------- .rtf ----------

const CP1252_TABLE = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];
function cp1252Byte(n: number): string {
  if (n < 0x80 || n > 0x9f) return String.fromCharCode(n);
  return String.fromCharCode(CP1252_TABLE[n - 0x80]);
}

function rtfEscapeUnicode(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      if (ch === "\\" || ch === "{" || ch === "}") {
        out += "\\" + ch;
      } else {
        out += ch;
      }
    } else if (code <= 0xffff) {
      const signed = code > 0x7fff ? code - 0x10000 : code;
      out += `\\u${signed}?`;
    } else {
      const cp = code - 0x10000;
      const high = 0xd800 + (cp >> 10);
      const low = 0xdc00 + (cp & 0x3ff);
      const hs = high > 0x7fff ? high - 0x10000 : high;
      const ls = low > 0x7fff ? low - 0x10000 : low;
      out += `\\u${hs}?\\u${ls}?`;
    }
  }
  return out;
}

/**
 * Convert a Rich Text Format `.rtf` file from Bijoy / Sutonny MJ to Unicode.
 */
export async function convertRtf(
  file: Blob,
  options: ConvertOptions = {}
): Promise<Blob> {
  const { onProgress, force = false } = options;
  onProgress?.({ stage: "Reading file", percent: 10 });
  const text = await file.text();
  onProgress?.({ stage: "Converting RTF", percent: 40 });

  let i = 0;
  let out = "";
  let bijoyBuf = "";

  const flush = () => {
    if (!bijoyBuf) return;
    const isHighByte = looksLikeBijoy(bijoyBuf);
    const shouldConvert = force || isHighByte;
    if (!shouldConvert || containsBengaliUnicode(bijoyBuf)) {
      out += bijoyBuf;
    } else {
      const converted = convertBijoyToUnicode(bijoyBuf);
      out += rtfEscapeUnicode(converted);
    }
    bijoyBuf = "";
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      if (text[i + 1] === "'" && /[0-9a-fA-F]{2}/.test(text.slice(i + 2, i + 4))) {
        const byte = parseInt(text.slice(i + 2, i + 4), 16);
        bijoyBuf += cp1252Byte(byte);
        i += 4;
        continue;
      }
      if (text[i + 1] === "u" && /\d/.test(text[i + 2] ?? "")) {
        flush();
        const m = /^\\u(-?\d+)\??([^\\]?)/.exec(text.slice(i));
        if (m) {
          out += m[0];
          i += m[0].length;
          continue;
        }
      }
      flush();
      if (text[i + 1] === "\\" || text[i + 1] === "{" || text[i + 1] === "}") {
        out += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      const cw = /^\\[a-zA-Z]+-?\d* ?/.exec(text.slice(i));
      if (cw) {
        out += cw[0];
        i += cw[0].length;
        continue;
      }
      out += ch;
      i++;
      continue;
    }
    if (ch === "{" || ch === "}" || ch === "\r" || ch === "\n") {
      flush();
      out += ch;
      i++;
      continue;
    }
    bijoyBuf += ch;
    i++;
  }
  flush();
  onProgress?.({ stage: "Done", percent: 100 });
  return new Blob([out], { type: "application/rtf" });
}

// ---------- .html ----------

function inheritedFontIsBijoy(el: Element | null): boolean | undefined {
  let cur: Element | null = el;
  while (cur) {
    const face = (cur as HTMLElement).getAttribute?.("face");
    if (face) {
      if (fontIsBijoyName(face)) return true;
      if (fontIsUnicodeBangla(face)) return false;
    }
    const style = (cur as HTMLElement).getAttribute?.("style") || "";
    const m = style.match(/font-family\s*:\s*([^;]+)/i);
    if (m) {
      const fams = m[1];
      if (fontIsBijoyName(fams)) return true;
      if (fontIsUnicodeBangla(fams)) return false;
    }
    cur = cur.parentElement;
  }
  return undefined;
}

/**
 * Convert an `.html` / `.htm` file from Bijoy / Sutonny MJ to Unicode.
 * Browser only — uses `DOMParser`.
 */
export async function convertHtml(
  file: Blob,
  options: ConvertOptions = {}
): Promise<Blob> {
  const { onProgress, force = false } = options;
  onProgress?.({ stage: "Reading file", percent: 10 });
  const html = await file.text();
  onProgress?.({ stage: "Converting", percent: 40 });

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const t = node.nodeValue || "";
      if (t.trim()) {
        const fontIsBijoy = inheritedFontIsBijoy(node.parentElement);
        let convert: boolean;
        if (fontIsBijoy === true) convert = true;
        else if (fontIsBijoy === false) convert = false;
        else convert = force;
        if (convert && !containsBengaliUnicode(t)) {
          node.nodeValue = convertBijoyToUnicode(t);
        }
      }
      node = walker.nextNode();
    }

    doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
      const s = (el.getAttribute("style") || "").replace(
        ALL_FONT_REGEX,
        UNICODE_FONT
      );
      el.setAttribute("style", s);
    });
    doc.querySelectorAll("font[face]").forEach((el) => {
      const s = (el.getAttribute("face") || "").replace(
        ALL_FONT_REGEX,
        UNICODE_FONT
      );
      el.setAttribute("face", s);
    });

    let head = doc.head;
    if (!head) {
      head = doc.createElement("head");
      doc.documentElement.insertBefore(head, doc.body);
    }
    if (!head.querySelector("meta[charset]")) {
      const meta = doc.createElement("meta");
      meta.setAttribute("charset", "utf-8");
      head.insertBefore(meta, head.firstChild);
    }

    const serialized = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    onProgress?.({ stage: "Done", percent: 100 });
    return new Blob([serialized], { type: "text/html;charset=utf-8" });
  }

  const out = html.replace(
    /(>)([^<]+)(<)/g,
    (_m, gt: string, txt: string, lt: string) => {
      if (!force) return gt + txt + lt;
      if (containsBengaliUnicode(txt)) return gt + txt + lt;
      return gt + convertBijoyToUnicode(txt) + lt;
    }
  );
  return new Blob([out], { type: "text/html;charset=utf-8" });
}

// ---------- .txt ----------

/**
 * Convert a plain text `.txt` Blob from Bijoy / Sutonny MJ to Unicode.
 * Line-by-line: each line is converted independently, lines that already
 * contain Bangla Unicode are kept as-is.
 */
export async function convertTxt(
  file: Blob,
  options: ConvertOptions = {}
): Promise<Blob> {
  const { force = false } = options;
  const text = await file.text();
  const out = text.replace(/[^\r\n]+/g, (line) => {
    if (containsBengaliUnicode(line)) return line;
    if (force) return convertBijoyToUnicode(line);
    if (looksLikeBijoy(line)) return convertBijoyToUnicode(line);
    return line;
  });
  return new Blob([out], { type: "text/plain;charset=utf-8" });
}

// ---------- router ----------

/** File extensions this package can convert. */
export type SupportedExt = "docx" | "odt" | "rtf" | "html" | "htm" | "txt";

export interface ConversionResult {
  blob: Blob;
  filename: string;
}

/** Detect the supported extension of a filename, or null. */
export function detectExt(name: string): SupportedExt | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1] as SupportedExt;
  if (["docx", "odt", "rtf", "html", "htm", "txt"].includes(ext)) {
    return ext;
  }
  return null;
}

/** Suggest an output filename like `original-unicode.docx`. */
export function suggestOutputName(originalName: string, ext: SupportedExt): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  return `${base}-unicode.${ext}`;
}

/**
 * Convert any supported file to Unicode. Routes to the right converter based
 * on the file extension.
 */
export async function convertFile(
  file: File,
  options: ConvertOptions = {}
): Promise<ConversionResult> {
  const ext = detectExt(file.name);
  if (!ext) {
    throw new Error(
      "Unsupported file type. Supported: .docx, .odt, .rtf, .html, .htm, .txt"
    );
  }

  let blob: Blob;
  switch (ext) {
    case "docx":
      blob = await convertDocx(file, options);
      break;
    case "odt":
      blob = await convertOdt(file, options);
      break;
    case "rtf":
      blob = await convertRtf(file, options);
      break;
    case "html":
    case "htm":
      blob = await convertHtml(file, options);
      break;
    case "txt":
      blob = await convertTxt(file, options);
      break;
  }

  return {
    blob,
    filename: suggestOutputName(file.name, ext),
  };
}
