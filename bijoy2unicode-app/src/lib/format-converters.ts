/**
 * Format-specific Bijoy → Unicode converters.
 *
 * Supported (client-side, no upload):
 *   .docx  – ZIP of XML parts. Walk every <w:t>/<w:instrText>.
 *   .odt   – ZIP. Walk text:p/text:span content in content.xml.
 *   .doc   – Legacy OLE binary. Extract WordDocument text stream, output a
 *            fresh minimal .docx (formatting is *not* preserved – legacy .doc
 *            cannot be reliably reformatted in the browser).
 *   .rtf   – Replace high-bit characters with \uXXXX? Unicode escapes.
 *   .html  – DOM text-node walk.
 *   .htm   – alias for .html
 *   .txt   – plain text.
 */

import JSZip from "jszip";
import * as CFB from "cfb";
import {
  convertBijoyToUnicode,
  shouldConvertAsBijoy,
  looksLikeBijoy,
} from "./bijoy-to-unicode";
import { convertWithCloudConvert, hasAnyKey } from "./cloudconvert";

export type ProgressInfo = { stage: string; percent: number };
export type ProgressFn = (info: ProgressInfo) => void;

export interface ConvertOptions {
  /**
   * When true, legacy .doc files are first sent to CloudConvert (using the
   * user's stored API keys, with automatic rotation) for a high-fidelity
   * .doc → .docx, then the Bijoy → Unicode pass runs on the result.
   */
  useCloudConvert?: boolean;
  /**
   * If true and a .doc is uploaded but no key is available, throw instead of
   * falling back to the in-browser heuristic.
   */
  requireHighFidelity?: boolean;
  /**
   * Force-convert every text run / line as Bijoy regardless of the font name
   * or content heuristics. Useful when:
   *   - Bijoy text was typed in a generic font (Times New Roman, Arial), or
   *   - Working with .txt / .rtf / .doc where no font metadata is available.
   * The default is *strict* font-based detection — only runs whose font is
   * a known Bijoy font are converted.
   */
  forceConvert?: boolean;
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
  /[A-Za-z]+MJ\b/i, // catch-all: any "...MJ" Bijoy-family font
  /\bMJ\s+[A-Za-z]+/i, // "MJ Sutonny" reversed naming
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

/**
 * Pure-Latin fonts that have nothing to do with Bangla. If a run uses one of
 * these for its ASCII slot, the author almost certainly intended Latin text.
 */
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

/**
 * Resolved font references for a run. We capture each slot Word distinguishes
 * (ASCII, hAnsi, complex-script) because Bijoy text uses ASCII slots, while
 * Bangla Unicode text typically lives in the complex-script slot.
 */
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

/**
 * Pick the font slot Word would actually use for the given run text.
 *   - If the text contains Bijoy high-byte characters (or any non-ASCII byte),
 *     Word uses the complex-script slot (w:cs).
 *   - For pure ASCII text, Word uses w:ascii (and falls back to w:hAnsi).
 *
 * This avoids false positives where a run sets w:cs="SutonnyMJ" for any
 * potential Bangla characters, but actually contains only Latin text in
 * a Latin font (Calibri / Times New Roman).
 */
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

/** Parse a styles.xml-shaped string into a styleId -> FontRef map. */
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
  // <w:style ...><w:name .../><w:basedOn w:val="..."/><w:rPr><w:rFonts .../></w:rPr></w:style>
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

  // Document defaults under <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts .../></w:rPr></w:rPrDefault>
  let defaults: FontRef = {};
  const ddM = stylesXml.match(
    /<w:rPrDefault\b[^>]*>([\s\S]*?)<\/w:rPrDefault>/
  );
  if (ddM) {
    const fontTag = ddM[1].match(/<w:rFonts\b[^/>]*\/?>/);
    if (fontTag) defaults = parseRFonts(fontTag[0]);
  }

  return { byId, defaults };
}

/** Resolve a style chain to its full FontRef (handles basedOn). */
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

/**
 * Per-document context: parsed styles + helpers.
 */
interface DocContext {
  styles: Map<string, StyleEntry>;
  defaults: FontRef;
}

/**
 * Walk every <w:p> paragraph. For each paragraph compute the effective font
 * by inheriting from the paragraph style, then walk every <w:r> run inside
 * and inherit further from the run style and the run's own <w:rFonts>.
 *
 * Convert text only when the resolved font is a known Bijoy font (or `force`).
 */
function transformDocxXml(
  xml: string,
  ctx: DocContext,
  force = false,
  bijoyHeavy = false
): string {
  const paraRe = /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g;
  let out = xml.replace(paraRe, (_m, pOpen: string, pBody: string, pClose: string) => {
    // Paragraph-level font: <w:pPr><w:pStyle w:val="..."/><w:rPr><w:rFonts .../></w:rPr></w:pPr>
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

    // Now process every run inside this paragraph.
    const newBody = pBody.replace(
      /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g,
      (__, rOpen: string, rBody: string, rClose: string) => {
        // Run-level: <w:rPr><w:rStyle w:val="..."/><w:rFonts .../></w:rPr>
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
        // Single Latin glyphs (`t`, `bs`) are usually Bijoy punctuation —
        // don't trust the Latin-font tag for them.
        const isShortLatinFragment = letterCount > 0 && letterCount <= 2;

        // Strong Bijoy markers: high-byte chars or backticks. These are
        // unambiguous (English doesn't produce these bytes).
        const hasHighByte = textHasBijoyMarkers(rBody);
        const hasHardBijoyMarker = hasHighByte || /`/.test(plainText);

        // Bijoy bigram density. Even one bigram is rare in real English
        // (the curated set excludes any patterns that occur in natural
        // English words). 2+ is overwhelming.
        const bigramCount = countBijoyBigrams(plainText);
        const hasMultipleBigrams = bigramCount >= 2;
        // Single-bigram or digit-letter alone is "soft" — used only to
        // override ambiguous (no-font) runs, not to override an explicit
        // Latin font tag.
        const hasSoftBijoyMarker =
          /\d[A-Za-z]/.test(plainText) || bigramCount >= 1;
        // A run is "strongly Bijoy" if it has either multiple bigrams OR
        // a single bigram in text whose vowel ratio is too low to be English.
        let strongBijoy = hasMultipleBigrams;
        if (!strongBijoy && bigramCount === 1 && letterCount >= 3) {
          const lower = plainText.toLowerCase().replace(/[^a-z]/g, "");
          let v = 0;
          for (const c of lower) if ("aeiouy".includes(c)) v++;
          const ratio = lower.length ? v / lower.length : 0;
          if (ratio < 0.25) strongBijoy = true;
          else {
            // Higher-ratio short text (like "eQi") might still be Bijoy if no
            // token is a recognized English word.
            const tokens = lower.match(/[a-z]+/g) || [];
            const allAlien =
              tokens.length > 0 &&
              tokens.every(
                (t) => !ENGLISH_HINT_WORDS.has(t) && t.length <= 6
              );
            if (allAlien) strongBijoy = true;
          }
        }
        //   1. Already Bangla Unicode      → skip
        //   2. Hard Bijoy markers          → convert (high bytes, backticks)
        //   3. Strong Bijoy evidence       → convert (overrides Latin font)
        //   4. Explicit Bijoy font         → convert
        //   5. Explicit Latin font + ≥3 letters → skip (real English)
        //   6. Explicit Unicode Bangla font → skip
        //   7. Soft Bijoy markers in non-Latin font → convert
        //   8. Force flag                  → convert
        //   9. Bijoy-heavy + not English   → convert
        //  10. else                        → skip
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

        // Swap any Bijoy font name on this run's <w:rFonts> to Nikosh so the
        // new Unicode text renders correctly.
        const finalBody = swapBijoyFontInBlock(converted);
        return rOpen + finalBody + rClose;
      }
    );

    return pOpen + newBody + pClose;
  });

  // Catch any orphan <w:rFonts> outside paragraphs (default styles, theme,
  // numbering, etc.) and rename Bijoy → Nikosh so styles don't keep pointing
  // at a Bijoy font even after the text was converted.
  out = out.replace(/<w:rFonts\b[^/>]*\/?>/g, (tag) => swapBijoyFontInBlock(tag));

  return out;
}

function containsBengaliUnicode(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0x0980 && code <= 0x09ff) return true;
  }
  return false;
}

/**
 * Decide whether a run of ASCII-only text "looks like real English". Used as
 * the negative gate for ambiguous low-ASCII Bijoy runs in a Bijoy-heavy
 * document: if the doc is mostly Bijoy and a run doesn't look like English,
 * treat it as Bijoy.
 *
 * Real English fingerprints:
 *   - Contains at least one common English short word, OR
 *   - Contains only English-letter tokens that all look like real English
 *     words (vowel-rich, no Bijoy bigrams).
 *
 * Bijoy "tells" that immediately disqualify English:
 *   - Backtick (`) → Bijoy দ
 *   - Tilde or caret in mid-word
 *   - `&` immediately following a letter (Bijoy hoshonto)
 *   - Digit immediately followed by a letter (5gvm, 17w`b)
 *   - 3+ consonants in a row anywhere
 *   - Common Bijoy bigrams (Kg, wP, wW, wb, Mv, Kv, Pv, ev, †g, †K, †P, etc.)
 */
const BIJOY_BIGRAMS = new Set([
  // High-frequency Bijoy two-letter sequences. Curated to be rare-or-absent
  // in real English. Add new entries only when verified against real text.
  //
  // 'w' prefix (Bijoy ি-kar) before a consonant — extremely common.
  "wA","wB","wC","wD","wE","wF","wG","wH","wI","wJ","wK","wL","wM","wN",
  "wO","wP","wQ","wR","wS","wT","wU","wV","wW","wX","wY","wZ",
  "wa","wb","wc","wd","wf","wg","wh","wj","wk","wl","wm","wn","wo",
  "wp","wq","wr","wt","wv",
  // 'v' suffix (Bijoy া-kar) after most consonants — also extremely common.
  "Av","Bv","Cv","Dv","Ev","Fv","Gv","Hv","Iv","Jv","Kv","Lv","Mv","Nv",
  "Ov","Pv","Qv","Sv","Tv","Uv","Vv","Wv","Xv","Yv","Zv","_v",
  "av","bv","cv","dv","ev","fv","gv","hv","iv","jv","kv","lv","mv","nv",
  "ov","pv","qv","rv","tv",
  // Common Bijoy clusters and reorder markers.
  "Mz","Mª","Mš","Kª","Pª","Zª",
  "©K","©M","©Z","©c","©e","©g","©h","©i","©k","©l","©m",
  "Ñ","Œ","‹","‡","ª","Ö","Š",
  // 'e' (ব) followed by capital consonants — common Bijoy mid-word pattern,
  // very rare in English (would require lowercase-then-uppercase like
  // "eBay", which is a brand and doesn't form whole tokens).
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
  "bio","data","cv","resume","photo","page","of","total","sl","sn","ref","subject","date",
  "ddg","adg","ig","sp","asp","gen","brig","col","lt","capt","major","maj","cmdr","cmdt",
]);

function looksLikeEnglish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  // 1. Definite Bijoy tells → not English.
  if (/`/.test(t)) return false;
  if (/[~^][A-Za-z]/.test(t)) return false;
  if (/[A-Za-z]&/.test(t)) return false;
  if (/\d[A-Za-z]/.test(t)) return false;
  if (hasBijoyBigram(t)) return false;
  // 3+ consonants in a row (case-insensitive).
  if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{3,}/.test(t)) return false;

  const lower = t.toLowerCase();
  // 2. Strong English words (matched as whole tokens).
  const tokens = lower.match(/[a-z][a-z']*/g) || [];
  for (const tok of tokens) {
    if (ENGLISH_HINT_WORDS.has(tok)) return true;
  }

  // 3. Vowel ratio + length sanity for ASCII letters only.
  const letters = lower.replace(/[^a-z]/g, "");
  if (letters.length === 0) {
    // Pure punctuation/digits/whitespace. Not Bijoy, not English; pass through
    // (we mark it "English" so we don't try to convert).
    return true;
  }
  // Bijoy short tokens: bvg, eQi, GwWG, etc. Don't blindly call them English.
  if (letters.length < 4) {
    // Without further signal, lean toward "ambiguous → not English" so the
    // Bijoy-heavy flag can flip them. Only treat as English if all letters
    // form a recognizable token.
    return tokens.every((tok) => ENGLISH_HINT_WORDS.has(tok));
  }

  let vowels = 0;
  for (const c of letters) if ("aeiouy".includes(c)) vowels++;
  const ratio = vowels / letters.length;
  // English usually has ~38–42% vowels. Require ≥35% AND a vowel within the
  // first 4 letters (Bijoy words often start with consonant clusters).
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

/**
 * Compute a document-level "Bijoy heaviness" score from the entire
 * document.xml. Returns true if more than ~10% of text-bearing characters
 * sit in runs containing Bijoy high-byte markers, OR if any explicit Bijoy
 * font is referenced anywhere in the file. We use this to flip ambiguous
 * low-ASCII runs into "convert" mode.
 */
function computeIsBijoyHeavy(xml: string): boolean {
  // Cheap font-name check first. Use a non-global clone so we don't share
  // state with the global swap regex.
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

/** Plain text content of a single run body (decoded, joined). */
function runBodyText(runBody: string): string {
  const ts = runBody.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  return ts
    .map((t) =>
      decodeXmlText(t.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, ""))
    )
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

function swapBijoyFontInBlock(s: string): string {
  return s.replace(ALL_FONT_REGEX, UNICODE_FONT);
}

export async function convertDocx(
  file: Blob,
  onProgress?: ProgressFn,
  force = false
): Promise<Blob> {
  onProgress?.({ stage: "Reading file", percent: 5 });
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  onProgress?.({ stage: "Parsing styles", percent: 15 });

  // Parse styles.xml + theme defaults so we can resolve inherited fonts.
  let ctx: DocContext = { styles: new Map(), defaults: {} };
  const stylesEntry = zip.file("word/styles.xml");
  if (stylesEntry) {
    const stylesXml = await stylesEntry.async("string");
    const parsed = parseStylesXml(stylesXml);
    ctx = { styles: parsed.byId, defaults: parsed.defaults };
  }

  onProgress?.({ stage: "Scanning document parts", percent: 25 });

  // Compute "Bijoy-heavy" once from the main document.xml so we can route
  // ambiguous low-ASCII runs to conversion in documents that are clearly
  // Bijoy-dominant.
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

  // Also rewrite styles.xml itself so any default font reference is renamed
  // (the per-run renaming above already handled inline references).
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

export async function convertOdt(
  file: Blob,
  onProgress?: ProgressFn,
  force = false
): Promise<Blob> {
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
    // <style:style style:name="X" ...> ... <style:text-properties style:font-name="..."/> ...</style:style>
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
      // If the element had no nested tags at all:
      const finalInner = (inner as string).includes("<")
        ? converted
        : (() => {
            const decoded = decodeXmlText(inner as string);
            if (containsBengaliUnicode(decoded)) return inner as string;
            return encodeXmlText(convertBijoyToUnicode(decoded));
          })();
      return `${openTag}${attrs}>${finalInner}${close}`;
    });

    // Swap Bijoy font references in styles to Unicode font.
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

/**
 * In RTF, non-ASCII characters are usually written as control words
 * (e.g. `\'e0` for byte 0xe0 in the current ANSI codepage). Bijoy text
 * uses CP1252-style bytes, so a typical Bijoy RTF is full of `\'xx`
 * escapes. We:
 *   1. Reconstruct the original byte sequence from `\'xx` escapes.
 *   2. Decode as Windows-1252 to recover the Bijoy ASCII string.
 *   3. Convert to Unicode.
 *   4. Emit `\u<n>?` escapes (RTF Unicode form).
 *
 * Plain ASCII characters (English text, RTF control words) are left
 * untouched.
 */

const CP1252_TABLE = [
  // 0x80-0x9F mapping (Windows-1252 has glyphs here unlike ISO-8859-1)
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
      // RTF reserved chars need escaping.
      if (ch === "\\" || ch === "{" || ch === "}") {
        out += "\\" + ch;
      } else {
        out += ch;
      }
    } else {
      // \uN? where N is signed 16-bit; supplementary plane needs surrogate pairs.
      if (code <= 0xffff) {
        const signed = code > 0x7fff ? code - 0x10000 : code;
        out += `\\u${signed}?`;
      } else {
        // Emit surrogate pair
        const cp = code - 0x10000;
        const high = 0xd800 + (cp >> 10);
        const low = 0xdc00 + (cp & 0x3ff);
        const hs = high > 0x7fff ? high - 0x10000 : high;
        const ls = low > 0x7fff ? low - 0x10000 : low;
        out += `\\u${hs}?\\u${ls}?`;
      }
    }
  }
  return out;
}

export async function convertRtf(
  file: Blob,
  onProgress?: ProgressFn,
  force = false
): Promise<Blob> {
  onProgress?.({ stage: "Reading file", percent: 10 });
  const text = await file.text();
  onProgress?.({ stage: "Converting RTF", percent: 40 });

  // Without font metadata we cannot reliably tell English from Bijoy. The
  // user's force toggle decides. When force is off we still convert any chunk
  // that has clear Bijoy high-byte characters; pure-ASCII text passes through.

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
      // Could be \\uN? (already unicode), \\'xx (hex byte), \\word (control), \\* etc.
      if (text[i + 1] === "'" && /[0-9a-fA-F]{2}/.test(text.slice(i + 2, i + 4))) {
        const byte = parseInt(text.slice(i + 2, i + 4), 16);
        bijoyBuf += cp1252Byte(byte);
        i += 4;
        continue;
      }
      if (text[i + 1] === "u" && /\d/.test(text[i + 2] ?? "")) {
        // Existing \uN? – flush buffer and pass through. The text after \uN?
        // is *already* unicode, so we leave it as-is.
        flush();
        // Copy \uN?[fallback]
        const m = /^\\u(-?\d+)\??([^\\]?)/.exec(text.slice(i));
        if (m) {
          out += m[0];
          i += m[0].length;
          continue;
        }
      }
      // Generic control word \something or escaped char like \\, \{, \}.
      flush();
      // Copy escaped reserved char.
      if (text[i + 1] === "\\" || text[i + 1] === "{" || text[i + 1] === "}") {
        out += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      // Control word (letters then optional number then optional space).
      const cw = /^\\[a-zA-Z]+-?\d* ?/.exec(text.slice(i));
      if (cw) {
        out += cw[0];
        i += cw[0].length;
        continue;
      }
      // Lone backslash fallback.
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

    // Plain char – treat as Bijoy ASCII.
    bijoyBuf += ch;
    i++;
  }
  flush();

  onProgress?.({ stage: "Done", percent: 100 });
  return new Blob([out], { type: "application/rtf" });
}

// ---------- .html / .htm ----------

export async function convertHtml(
  file: Blob,
  onProgress?: ProgressFn,
  force = false
): Promise<Blob> {
  onProgress?.({ stage: "Reading file", percent: 10 });
  const html = await file.text();
  onProgress?.({ stage: "Converting", percent: 40 });

  // Use the browser's DOMParser when available (we are in a client component).
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

    // Swap Bijoy fonts in inline style attributes after text is converted.
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
    // Ensure UTF-8 charset.
    let head = doc.head;
    if (!head) {
      head = doc.createElement("head");
      doc.documentElement.insertBefore(head, doc.body);
    }
    if (!head.querySelector('meta[charset]')) {
      const meta = doc.createElement("meta");
      meta.setAttribute("charset", "utf-8");
      head.insertBefore(meta, head.firstChild);
    }

    const serialized =
      "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    onProgress?.({ stage: "Done", percent: 100 });
    return new Blob([serialized], { type: "text/html;charset=utf-8" });
  }

  // Fallback: regex-based text-node replacement (server side path, unused).
  const out = html.replace(/(>)([^<]+)(<)/g, (_m, gt: string, txt: string, lt: string) => {
    if (!force) return gt + txt + lt;
    if (containsBengaliUnicode(txt)) return gt + txt + lt;
    return gt + convertBijoyToUnicode(txt) + lt;
  });
  return new Blob([out], { type: "text/html;charset=utf-8" });
}

function inheritedFontIsBijoy(el: Element | null): boolean | undefined {
  let cur: Element | null = el;
  while (cur) {
    // <font face="...">
    const face = (cur as HTMLElement).getAttribute?.("face");
    if (face) {
      if (fontIsBijoyName(face)) return true;
      if (fontIsUnicodeBangla(face)) return false;
    }
    // style="font-family: ..."
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

// ---------- .txt ----------

export async function convertTxt(
  file: Blob,
  force = false
): Promise<Blob> {
  const text = await file.text();
  // No font info in plain text. If `force` is set we convert every line that
  // doesn't already contain Bangla Unicode. Otherwise we only convert lines
  // with clear Bijoy high-byte markers.
  const out = text.replace(/[^\r\n]+/g, (line) => {
    if (containsBengaliUnicode(line)) return line;
    if (force) return convertBijoyToUnicode(line);
    if (looksLikeBijoy(line)) return convertBijoyToUnicode(line);
    return line;
  });
  return new Blob([out], { type: "text/plain;charset=utf-8" });
}

// ---------- .doc (legacy binary) ----------

/**
 * Pull the WordDocument text stream from an OLE compound file. The full Word
 * binary spec is enormous; for plain Bijoy text the text stream usually lives
 * at the offset given by the FIB (File Information Block). We use a permissive
 * approach: pull the WordDocument stream, take the contiguous CP1252-printable
 * region after the FIB, and treat that as the text body.
 *
 * This is best-effort – we explicitly tell the user formatting is dropped.
 */
function extractDocText(buf: ArrayBuffer): string {
  const cfbDoc = CFB.read(new Uint8Array(buf), { type: "array" });
  const stream = CFB.find(cfbDoc, "WordDocument");
  if (!stream || !stream.content) {
    throw new Error(
      "Could not read the WordDocument stream from this .doc file. Try saving it as .docx in Word and re-uploading."
    );
  }
  const data = stream.content as Uint8Array;
  // Heuristic: text body starts at fcMin (offset 0x18 -> uint32 LE) and ends at fcMac (offset 0x1c).
  const fcMin = data[0x18] | (data[0x19] << 8) | (data[0x1a] << 16) | (data[0x1b] << 24);
  const fcMac = data[0x1c] | (data[0x1d] << 8) | (data[0x1e] << 16) | (data[0x1f] << 24);
  let start = fcMin;
  let end = fcMac;
  if (start <= 0 || end <= start || end > data.length) {
    start = 0;
    end = data.length;
  }
  // Decode as CP1252 since Bijoy text uses 8-bit codepoints in the same range.
  let s = "";
  for (let i = start; i < end; i++) {
    const b = data[i];
    if (b === 0x07) {
      // Cell/row marker → newline.
      s += "\n";
      continue;
    }
    if (b === 0x0d) {
      s += "\n";
      continue;
    }
    if (b === 0x09) {
      s += "\t";
      continue;
    }
    if (b < 0x20 && b !== 0x0a) continue; // skip control bytes
    s += cp1252Byte(b);
  }
  return s;
}

function buildMinimalDocx(paragraphs: string[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  const body = paragraphs
    .map((p) => {
      const safe = encodeXmlText(p);
      const runs = safe
        .split("\n")
        .map(
          (line, idx) =>
            `<w:r>${idx > 0 ? "<w:br/>" : ""}<w:rPr><w:rFonts w:ascii="${UNICODE_FONT}" w:hAnsi="${UNICODE_FONT}" w:cs="${UNICODE_FONT}"/></w:rPr><w:t xml:space="preserve">${line}</w:t></w:r>`
        )
        .join("");
      return `<w:p>${runs}</w:p>`;
    })
    .join("");
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body>
</w:document>`
  );
  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function convertDoc(
  file: Blob,
  onProgress?: ProgressFn,
  force = false
): Promise<Blob> {
  onProgress?.({ stage: "Reading legacy .doc", percent: 10 });
  const buf = await file.arrayBuffer();
  onProgress?.({ stage: "Extracting text stream", percent: 30 });
  const raw = extractDocText(buf);
  onProgress?.({ stage: "Converting Bijoy → Unicode", percent: 60 });
  // For .doc the extracted text is ambiguous (we can't see per-run fonts),
  // so we apply the Bijoy → Unicode pass paragraph-by-paragraph. With `force`
  // every paragraph is converted; otherwise we only convert paragraphs that
  // contain Bijoy high-byte characters.
  const paragraphs = raw
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (containsBengaliUnicode(p)) return p;
      if (force) return convertBijoyToUnicode(p);
      if (looksLikeBijoy(p)) return convertBijoyToUnicode(p);
      return p;
    });
  onProgress?.({ stage: "Building .docx", percent: 80 });
  const out = await buildMinimalDocx(paragraphs.length ? paragraphs : [raw]);
  onProgress?.({ stage: "Done", percent: 100 });
  return out;
}

// ---------- router ----------

export type SupportedExt = "docx" | "doc" | "odt" | "rtf" | "html" | "htm" | "txt";

export interface ConversionResult {
  blob: Blob;
  filename: string;
  notes?: string[];
}

/**
 * Pull plain text out of an already-converted output blob so we can scan it
 * for unmapped Bijoy bytes. Best-effort and lossy: tags / formatting are
 * dropped. Used for the "Report unmapped character" feature.
 */
export async function extractPlainText(
  blob: Blob,
  ext: SupportedExt
): Promise<string> {
  // .doc never reaches this point — it has already been re-saved as .docx.
  switch (ext) {
    case "docx":
    case "doc": {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const parts = Object.keys(zip.files).filter((n) =>
        /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(
          n
        )
      );
      let text = "";
      for (const name of parts) {
        const xml = await zip.file(name)!.async("string");
        const matches = xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
        for (const m of matches) {
          const inner = m.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "");
          text += decodeXmlText(inner) + " ";
        }
        text += "\n";
      }
      return text;
    }
    case "odt": {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = (await zip.file("content.xml")?.async("string")) || "";
      // Strip every tag, keep text content.
      return decodeXmlText(xml.replace(/<[^>]+>/g, " "));
    }
    case "rtf": {
      const raw = await blob.text();
      // Convert \uN? escapes back to characters and strip control words.
      const decoded = raw.replace(/\\u(-?\d+)\??/g, (_m, n) => {
        let v = parseInt(n, 10);
        if (v < 0) v += 0x10000;
        try {
          return String.fromCodePoint(v);
        } catch {
          return "";
        }
      });
      return decoded
        .replace(/\{\\\*?[^{}]*\}/g, " ") // groups starting with \*
        .replace(/\\[a-zA-Z]+-?\d* ?/g, " ") // control words
        .replace(/[{}]/g, " ");
    }
    case "html":
    case "htm": {
      const html = await blob.text();
      if (typeof DOMParser !== "undefined") {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.body?.textContent || "";
      }
      return html.replace(/<[^>]+>/g, " ");
    }
    case "txt":
      return await blob.text();
  }
}

export function detectExt(name: string): SupportedExt | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1] as SupportedExt;
  if (["docx", "doc", "odt", "rtf", "html", "htm", "txt"].includes(ext)) {
    return ext;
  }
  return null;
}

export function suggestOutputName(originalName: string, ext: SupportedExt): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const outExt = ext === "doc" ? "docx" : ext; // .doc gets upgraded to .docx
  return `${base}-unicode.${outExt}`;
}

export async function convertFile(
  file: File,
  onProgress?: ProgressFn,
  options: ConvertOptions = {}
): Promise<ConversionResult> {
  const ext = detectExt(file.name);
  if (!ext) {
    throw new Error(
      "Unsupported file type. Supported: .docx, .doc, .odt, .rtf, .html, .htm, .txt"
    );
  }

  const force = !!options.forceConvert;
  const notes: string[] = [];
  let blob: Blob;

  switch (ext) {
    case "docx":
      blob = await convertDocx(file, onProgress, force);
      break;
    case "doc":
      if (options.useCloudConvert && hasAnyKey()) {
        // High-fidelity path: CloudConvert .doc → .docx, then Bijoy convert.
        onProgress?.({ stage: "Sending to CloudConvert (.doc → .docx)", percent: 5 });
        const { blob: docxBlob } = await convertWithCloudConvert(file, {
          inputFormat: "doc",
          outputFormat: "docx",
          onProgress: (p) =>
            onProgress?.({
              stage: p.stage,
              percent: Math.round(5 + p.percent * 0.55),
            }),
        });
        const upgraded = new File(
          [docxBlob],
          file.name.replace(/\.doc$/i, ".docx"),
          {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }
        );
        blob = await convertDocx(
          upgraded,
          (p) =>
            onProgress?.({
              stage: p.stage,
              percent: Math.min(100, 60 + Math.round(p.percent * 0.4)),
            }),
          force
        );
        notes.push(
          "Used CloudConvert for high-fidelity .doc → .docx, then converted Bijoy text to Unicode."
        );
      } else if (options.requireHighFidelity) {
        throw new Error(
          "High-fidelity .doc conversion is enabled but no CloudConvert API key is available. Add one in Settings or disable high-fidelity mode."
        );
      } else {
        blob = await convertDoc(file, onProgress, force);
        notes.push(
          "Legacy .doc: text-only conversion. For full formatting fidelity, enable high-fidelity mode in Settings (uses your own CloudConvert API key)."
        );
      }
      break;
    case "odt":
      blob = await convertOdt(file, onProgress, force);
      break;
    case "rtf":
      blob = await convertRtf(file, onProgress, force);
      break;
    case "html":
    case "htm":
      blob = await convertHtml(file, onProgress, force);
      break;
    case "txt":
      onProgress?.({ stage: "Converting text", percent: 50 });
      blob = await convertTxt(file, force);
      onProgress?.({ stage: "Done", percent: 100 });
      break;
  }

  return {
    blob,
    filename: suggestOutputName(file.name, ext),
    notes: notes.length ? notes : undefined,
  };
}
