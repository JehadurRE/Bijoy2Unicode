/**
 * bijoy2unicode — Bijoy ASCII (Sutonny MJ etc.) → Bengali Unicode converter.
 *
 * Original work by Md. Jehad (Jehadur Rahman Emran). The mapping tables and
 * reorder algorithm have been extensively modified, expanded, and rewritten
 * for correctness against real-world Bijoy/Sutonny MJ documents.
 *
 * Inspired by:
 *   - Mad-FOX/bijoy2unicode (Python) — initial mapping inspiration
 *   - bnwebtools / nishiafia/bijoytounicodeconverter — additional coverage
 *
 * Notable additions / fixes original to this implementation:
 *   - Trailing-© reph reorder (`Kg©KZ©vi` → কর্মকর্তার)
 *   - `Í` (U+00CD) prefix-pair handling (`we¯ÍvwiZ` → বিস্তারিত)
 *   - `iæ → রু` ordered before single-byte `æ → ু`
 *   - `ÿ → ক্ষ` mapping for the alternate Sutonny MJ encoding
 *   - Precomposed nukta forms (ড়/ঢ়/য়) preserved per real-world usage
 *   - Font-aware detection helpers in src/lib/format-converters.ts
 */

type CharMap = Array<[RegExp, string]>;

const buildMap = (raw: Record<string, string>): CharMap =>
  Object.entries(raw).map(([k, v]) => [
    new RegExp(escapeForRegex(k), "g"),
    v,
  ]);

function escapeForRegex(literal: string): string {
  // The Python implementation uses re.sub directly. A handful of the source
  // keys are already valid escape sequences ("\\|", "\\&", "\\^", "\\["),
  // which collapse to single-character literals here. Treat every key as a
  // plain literal to keep behaviour identical.
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const preConversionMap: CharMap = buildMap({
  "  ": " ",
  yy: "y",
  vv: "v",
  "\u00AD\u00AD": "\u00AD",
  "y&": "y",
  "\u201E&": "\u201E",
  "\u2021u": "u\u2021",
  wu: "uw",
  " ,": ",",
  " |": "|",
  "\\ ": "",
  " \\": "",
  "\\": "",
  "\n ": "\n",
  " \n": "\n",
  "\n\n\n\n\n": "\n\n",
  "\n\n\n\n": "\n\n",
  "\n\n\n": "\n\n",
});

const conversionMap: CharMap = buildMap({
  // ---- Multi-character sequences first ----
  // These must run before the single-byte mappings below, otherwise the
  // single-byte mapping on the second char of a sequence would consume
  // it (e.g. `iæ` → `রু` must match before `æ` → `ু`).
  // Some entries are inherited from earlier converters; many are original
  // additions for real-world Sutonny MJ documents.
  "i\u00E6": "রু",
  "i\u201C": "রু", // ru with smart-quote variant
  "i\u0192": "রূ", // rū
  "M\u00F8": "গ্ল",
  "\u201DQ\u00A6": "চ্ছ্ব",
  "c\u00F8": "প্ল",
  "e\u00F8": "ব্ল",
  "k\u00F8": "শ্ল",
  "\u00A4\u00F8": "ম্ল",
  "\u00AF\u00F8": "স্ল",
  "\u00E5\u201C": "ভ্রু",
  // 'Í' (U+00CD) is a Sutonny MJ alternate for '—' (em-dash) used in
  // ন্ত / স্ত / ক্ত style conjuncts. Map every prefix-pair first, then the
  // remaining bare 'Í' falls through to the single-byte map below.
  "\u00AF\u00CD": "স্ত",  // ¯Í -> স্ত
  "\u0161\u00CD": "ন্ত",  // šÍ -> ন্ত
  "\u00AF\u00CD\u00A1": "স্ত্ব", // ¯Í¡ -> স্ত্ব
  "\u0161\u00CD\u00A1": "ন্ত্ব", // šÍ¡ -> ন্ত্ব
  "\u00CB\u00A1": "ত্ত্ব", // Ë¡ overrides the single-byte Ë mapping
  "\\\\": "॥",

  // ---- Vowels (Av must come before A) ----
  Av: "আ",
  A: "অ",
  B: "ই",
  C: "ঈ",
  D: "উ",
  E: "ঊ",
  F: "ঋ",
  G: "এ",
  H: "ঐ",
  I: "ও",
  J: "ঔ",
  // Consonants
  K: "ক",
  L: "খ",
  M: "গ",
  N: "ঘ",
  O: "ঙ",
  P: "চ",
  Q: "ছ",
  R: "জ",
  S: "ঝ",
  T: "ঞ",
  U: "ট",
  V: "ঠ",
  W: "ড",
  X: "ঢ",
  Y: "ণ",
  Z: "ত",
  _: "থ",
  "`": "দ",
  a: "ধ",
  b: "ন",
  c: "প",
  d: "ফ",
  e: "ব",
  f: "ভ",
  g: "ম",
  h: "য",
  i: "র",
  j: "ল",
  k: "শ",
  l: "ষ",
  m: "স",
  n: "হ",
  o: "\u09DC", // ড় (precomposed)
  p: "\u09DD", // ঢ় (precomposed)
  q: "\u09DF", // য় (precomposed)
  r: "ৎ",
  s: "ং",
  t: "ঃ",
  u: "ঁ",
  // Numbers
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
  // Kars
  "\u2022": "ঙ্",
  v: "া",
  w: "ি",
  x: "ী",
  y: "ু",
  z: "ু",
  "\u201C": "ু",
  "\u2013": "ু",
  "~": "ূ",
  "\u0192": "ূ",
  "\u201A": "ূ",
  "\u201E\u201E": "ৃ",
  "\u201E": "ৃ",
  "\u2026": "ৃ",
  "\u2020": "ে",
  "\u2021": "ে",
  "\u02C6": "ৈ",
  "\u2030": "ৈ",
  "\u0160": "ৗ",
  "|": "।",
  "&": "্\u200C",
  // Conjuncts
  "^": "্ব",
  "\u2018": "্তু",
  "\u2019": "্থ",
  "\u2039": "্ক",
  "\u0152": "্ক্র",
  "\u201D": "চ্",
  "\u2014": "্ত",
  "\u02DC": "দ্",
  "\u2122": "দ্",
  "\u0161": "ন্",
  "\u203A": "ন্",
  "\u0153": "্ন",
  "\u0178": "্ব",
  "\u00A1": "্ব",
  "\u00A2": "্ভ",
  "\u00A3": "্ভ্র",
  "\u00A4": "ম্",
  "\u00A5": "্ম",
  "\u00A6": "্ব",
  "\u00A7": "্ম",
  "\u00A8": "্য",
  "\u00A9": "র্",
  "\u00AA": "্র",
  "\u00AB": "্র",
  "\u00AC": "্ল",
  "\u00AD": "্ল",
  "\u00AE": "ষ্",
  "\u00AF": "স্",
  "\u00B0": "ক্ক",
  "\u00B1": "ক্ট",
  "\u00B2": "ক্ষ্ণ",
  "\u00B3": "ক্ত",
  "\u00B4": "ক্ম",
  "\u00B5": "ক্র",
  "\u00B6": "ক্ষ",
  "\u00B7": "ক্স",
  "\u00B8": "গু",
  "\u00B9": "জ্ঞ",
  "\u00BA": "গ্দ",
  "\u00BB": "গ্ধ",
  "\u00BC": "ঙ্ক",
  "\u00BD": "ঙ্গ",
  "\u00BE": "জ্জ",
  "\u00BF": "্ত্র",
  "\u00C0": "জ্ঝ",
  "\u00C1": "জ্ঞ",
  "\u00C2": "ঞ্চ",
  "\u00C3": "ঞ্ছ",
  "\u00C4": "ঞ্জ",
  "\u00C5": "ঞ্ঝ",
  "\u00C6": "ট্ট",
  "\u00C7": "ড্ড",
  "\u00C8": "ণ্ট",
  "\u00C9": "ণ্ঠ",
  "\u00CA": "ণ্ড",
  "\u00CB": "ত্ত",
  "\u00CC": "ত্থ",
  "\u00CD": "ত্ম",
  "\u00CE": "ত্র",
  "\u00CF": "দ্দ",
  "\u00D0": "-",
  "\u00D1": "-",
  "\u00D2": '"',
  "\u00D3": '"',
  "\u00D4": "'",
  "\u00D5": "'",
  "\u00D6": "্র",
  "\u00D7": "দ্ধ",
  "\u00D8": "দ্ব",
  "\u00D9": "দ্ম",
  "\u00DA": "ন্ঠ",
  "\u00DB": "ন্ড",
  "\u00DC": "ন্ধ",
  "\u00DD": "ন্স",
  "\u00DE": "প্ট",
  "\u00DF": "প্ত",
  "\u00E0": "প্প",
  "\u00E1": "প্স",
  "\u00E2": "ব্জ",
  "\u00E3": "ব্দ",
  "\u00E4": "ব্ধ",
  "\u00E5": "ভ্র",
  "\u00E6": "ু", // æ — u-kar variant (matches Sutonny MJ usage and bnwebtools).
                  // The rare ম্ন conjunct uses other byte sequences (e.g. gœ).
  "\u00E7": "ম্ফ",
  "\u00E8": "্ন",
  "\u00E9": "ল্ক",
  "\u00EA": "ল্গ",
  "\u00EB": "ল্ট",
  "\u00EC": "ল্ড",
  "\u00ED": "ল্প",
  "\u00EE": "ল্ফ",
  "\u00EF": "শু",
  "\u00F0": "শ্চ",
  "\u00F1": "শ্ছ",
  "\u00F2": "ষ্ণ",
  "\u00F3": "ষ্ট",
  "\u00F4": "ষ্ঠ",
  "\u00F5": "ষ্ফ",
  "\u00F6": "স্খ",
  "\u00F7": "স্ট",
  "\u00F8": "স্ন",
  "\u00F9": "স্ফ",
  "\u00FA": "্প",
  "\u00FB": "হু",
  "\u00FC": "হৃ",
  "\u00FD": "হ্ন",
  "\u00FE": "হ্ম",
  // ---- Additional real-world Bijoy / Sutonny MJ encodings (alternate `ÿ`,
  // etc.). Single-byte additions only — multi-char sequences are at the top
  // of this map.
  "\u00FF": "ক্ষ", // ÿ alternate code for ক্ষ (kkho)
});

const proConversionMap: CharMap = buildMap({
  "্্": "্",
});

const postConversionMap: CharMap = buildMap({
  "০ঃ": "০:",
  "১ঃ": "১:",
  "২ঃ": "২:",
  "৩ঃ": "৩:",
  "৪ঃ": "৪:",
  "৫ঃ": "৫:",
  "৬ঃ": "৬:",
  "৭ঃ": "৭:",
  "৮ঃ": "৮:",
  "৯ঃ": "৯:",
  " ঃ": ":",
  "\nঃ": "\n:",
  "]ঃ": "]:",
  "[ঃ": "[:",
  "  ": " ",
  "অা": "আ",
  "্\u200C্\u200C": "্\u200C",
});

function applyMap(text: string, map: CharMap): string {
  let out = text;
  for (const [pattern, replacement] of map) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const HALANT = "\u09CD";

function isBanglaPreKar(c: string): boolean {
  return c === "ি" || c === "ৈ" || c === "ে";
}

function isBanglaPostKar(c: string): boolean {
  return (
    c === "া" ||
    c === "ো" ||
    c === "ৌ" ||
    c === "ৗ" ||
    c === "ু" ||
    c === "ূ" ||
    c === "ী" ||
    c === "ৃ"
  );
}

function isBanglaKar(c: string): boolean {
  return isBanglaPreKar(c) || isBanglaPostKar(c);
}

function isBanglaBanjonborno(c: string): boolean {
  if (!c) return false;
  return (
    "কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ".includes(c) ||
    c === "ড়" || // U+09DC
    c === "ঢ়" || // U+09DD
    c === "য়" || // U+09DF
    c === "ৎ" ||
    c === "ং" ||
    c === "ঃ" ||
    c === "ঁ"
  );
}

function isBanglaNukta(c: string): boolean {
  return c === "ঁ";
}

function isBanglaHalant(c: string): boolean {
  return c === HALANT;
}

function isSpace(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

function charAt(s: string, i: number): string {
  if (i < 0 || i >= s.length) return "";
  return s.charAt(i);
}

function rearrange(input: string): string {
  let str = input;
  let i = 0;

  // First pass: handle reph (র + halant) when surrounded by halant.
  while (i < str.length) {
    if (
      i < str.length - 1 &&
      charAt(str, i) === "র" &&
      isBanglaHalant(charAt(str, i + 1)) &&
      isBanglaHalant(charAt(str, i - 1))
    ) {
      let j = 1;
      while (true) {
        if (i - j < 0) break;
        if (
          isBanglaBanjonborno(charAt(str, i - j)) &&
          isBanglaHalant(charAt(str, i - j - 1))
        ) {
          j += 2;
        } else if (j === 1 && isBanglaKar(charAt(str, i - j))) {
          j += 1;
        } else {
          break;
        }
      }
      str =
        str.slice(0, i - j) +
        charAt(str, i) +
        charAt(str, i + 1) +
        str.slice(i - j, i) +
        str.slice(i + 2);
      i += 1;
      continue;
    }
    i += 1;
  }

  // Reph reorder for the trailing-© case: pattern is [consonant cluster] +
  // র + ্ at the end of a syllable (i.e. NOT followed by another consonant).
  // Bijoy types `©` right after the consonant the reph attaches to, so we
  // need to move `র + ্` *before* the consonant cluster it sits behind.
  // Examples handled:
  //   ক ড র ্      → ক র ্ ড      (Bijoy `KW©`)
  //   ক ম র ্ ক ত র ্ া র → কর্মকর্তার (Bijoy `Kg©KZ©vi`)
  i = 0;
  while (i < str.length - 1) {
    if (
      charAt(str, i) === "র" &&
      isBanglaHalant(charAt(str, i + 1)) &&
      i > 0 &&
      // Previous char must be a banjonborno that does NOT itself form a
      // halanted conjunct head (otherwise it's `র + ্ + halant` and the
      // first pass already handled it).
      isBanglaBanjonborno(charAt(str, i - 1)) &&
      !isBanglaHalant(charAt(str, i - 2)) &&
      // The reph must be at end of cluster — meaning the next char after
      // the halant must NOT be the start of a new halanted conjunct.
      // Specifically, block only if (i+2, i+3) is consonant + halant —
      // that pattern means the reph is genuinely in the middle of a
      // multi-consonant cluster and should be left alone.
      !(
        isBanglaBanjonborno(charAt(str, i + 2)) &&
        isBanglaHalant(charAt(str, i + 3))
      )
    ) {
      // Walk backwards over any consonant + halant pairs to find the start
      // of the cluster the reph should attach to.
      let j = 1;
      while (true) {
        if (i - j - 1 < 0) break;
        if (
          isBanglaBanjonborno(charAt(str, i - j - 1)) &&
          isBanglaHalant(charAt(str, i - j))
        ) {
          j += 2;
        } else {
          break;
        }
      }
      str =
        str.slice(0, i - j) +
        charAt(str, i) + // র
        charAt(str, i + 1) + // halant
        str.slice(i - j, i) + // the cluster
        str.slice(i + 2);
      i += 2; // skip past the now-relocated reph
      continue;
    }
    i += 1;
  }

  str = applyMap(str, proConversionMap);

  // Second pass.
  i = 0;
  while (i < str.length) {
    // Reph reorder when followed by another conjunct.
    if (
      i < str.length - 1 &&
      charAt(str, i) === "র" &&
      isBanglaHalant(charAt(str, i + 1)) &&
      !isBanglaHalant(charAt(str, i - 1)) &&
      isBanglaHalant(charAt(str, i + 2))
    ) {
      let j = 1;
      while (true) {
        if (i - j < 0) break;
        if (
          isBanglaBanjonborno(charAt(str, i - j)) &&
          isBanglaHalant(charAt(str, i - j - 1))
        ) {
          j += 2;
        } else if (j === 1 && isBanglaKar(charAt(str, i - j))) {
          j += 1;
        } else {
          break;
        }
      }
      str =
        str.slice(0, i - j) +
        charAt(str, i) +
        charAt(str, i + 1) +
        str.slice(i - j, i) +
        str.slice(i + 2);
      i += 1;
      continue;
    }

    // Vowel + halant + consonant -> halant + consonant + vowel
    if (
      i > 0 &&
      charAt(str, i) === HALANT &&
      (isBanglaKar(charAt(str, i - 1)) || isBanglaNukta(charAt(str, i - 1))) &&
      i < str.length - 1
    ) {
      str =
        str.slice(0, i - 1) +
        charAt(str, i) +
        charAt(str, i + 1) +
        charAt(str, i - 1) +
        str.slice(i + 2);
    }

    // র + halant + vowel -> vowel + র + halant
    if (
      i > 0 &&
      i < str.length - 1 &&
      charAt(str, i) === HALANT &&
      charAt(str, i - 1) === "\u09B0" &&
      charAt(str, i - 2) !== HALANT &&
      isBanglaKar(charAt(str, i + 1))
    ) {
      str =
        str.slice(0, i - 1) +
        charAt(str, i + 1) +
        charAt(str, i - 1) +
        charAt(str, i) +
        str.slice(i + 2);
    }

    // Pre-kar to post-kar Unicode placement.
    if (
      i < str.length - 1 &&
      isBanglaPreKar(charAt(str, i)) &&
      !isSpace(charAt(str, i + 1))
    ) {
      let temp = str.slice(0, i);
      let j = 1;
      while (
        i + j < str.length - 1 &&
        isBanglaBanjonborno(charAt(str, i + j))
      ) {
        if (
          i + j < str.length &&
          isBanglaHalant(charAt(str, i + j + 1))
        ) {
          j += 2;
        } else {
          break;
        }
      }
      temp += str.slice(i + 1, i + j + 1);

      let l = 0;
      if (
        charAt(str, i) === "ে" &&
        charAt(str, i + j + 1) === "া"
      ) {
        temp += "ো";
        l = 1;
      } else if (
        charAt(str, i) === "ে" &&
        charAt(str, i + j + 1) === "ৗ"
      ) {
        temp += "ৌ";
        l = 1;
      } else {
        temp += charAt(str, i);
      }

      temp += str.slice(i + j + l + 1);
      str = temp;
      i += j;
    }

    // Nukta after kar
    if (
      i < str.length - 1 &&
      isBanglaNukta(charAt(str, i)) &&
      isBanglaPostKar(charAt(str, i + 1))
    ) {
      str =
        str.slice(0, i) +
        charAt(str, i + 1) +
        charAt(str, i) +
        str.slice(i + 2);
    }

    i += 1;
  }

  return str;
}

/**
 * Convert a single string of Bijoy ASCII text to Unicode Bengali.
 *
 * NOTE: We deliberately do *not* run Unicode NFC/NFD normalization on the
 * output. The Bengali letters ড় (U+09DC), ঢ় (U+09DD), and য় (U+09DF) are
 * in the Unicode "Composition Exclusions" list, which means NFC would split
 * them into the base consonant + nukta. Word, Office, and most published
 * Bangla content all use the precomposed forms, so we preserve them as-is.
 */
export function convertBijoyToUnicode(src: string): string {
  if (!src) return src;
  let out = applyMap(src, preConversionMap);
  out = applyMap(out, conversionMap);
  out = rearrange(out);
  out = applyMap(out, postConversionMap);
  return out;
}

/**
 * After conversion, scan the result for characters that are likely unmapped
 * Bijoy bytes. Anything in Latin-1 Supplement / Latin Extended that didn't
 * get converted, plus stray smart quotes / control glyphs, is suspicious.
 */
export function scanUnmapped(unicodeText: string): Map<string, number> {
  const out = new Map<string, number>();
  if (!unicodeText) return out;
  for (const ch of unicodeText) {
    if (isSuspiciousLeftover(ch)) {
      out.set(ch, (out.get(ch) ?? 0) + 1);
    }
  }
  return out;
}

export function isSuspiciousLeftover(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  // Bengali block – fine.
  if (code >= 0x0980 && code <= 0x09ff) return false;
  // ASCII printable + tab/newline/cr – fine (numbers, English, punctuation).
  if (code >= 0x20 && code <= 0x7e) return false;
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  // Zero-width joiner / non-joiner – fine.
  if (code === 0x200c || code === 0x200d) return false;
  // Bengali danda + double danda – fine.
  if (code === 0x0964 || code === 0x0965) return false;
  // Latin-1 Supplement, Latin Extended-A, Latin Extended-B → almost certainly
  // unmapped Bijoy/Sutonny bytes.
  if (code >= 0x0080 && code <= 0x024f) return true;
  // Smart quotes, em-dash, bullet etc. that Bijoy uses for conjuncts.
  if (code >= 0x2010 && code <= 0x203a) return true;
  // Curly quotes range we sometimes see leftover.
  if (code === 0x0152 || code === 0x0153 || code === 0x0160 || code === 0x0161) return true;
  return false;
}

export function describeCodepoint(ch: string): string {
  const cp = ch.codePointAt(0)!;
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Heuristic check: does this string look like Bijoy ASCII text?
 * We look for the high-byte / control chars that the Bijoy keyboard layout
 * uses. Plain English / Latin text will return false.
 */
export function looksLikeBijoy(text: string): boolean {
  if (!text) return false;
  // High-byte codepoints common in Bijoy (0x80–0xFF, smart quotes, etc.)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0080 && code <= 0x024f) return true;
    if (code >= 0x2010 && code <= 0x203a) return true;
  }
  return false;
}

/** Check whether a string already contains Unicode Bengali. */
export function hasBengaliUnicode(text: string): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0980 && code <= 0x09ff) return true;
  }
  return false;
}

/**
 * Decide whether a chunk of text should be run through the Bijoy → Unicode
 * converter. Skip it if it already contains Unicode Bengali, or if it looks
 * like plain English with no Bijoy-specific bytes.
 *
 * `fontIsBijoy === true` forces conversion (the run is explicitly tagged
 * with a Bijoy font), `fontIsBijoy === false` blocks it (explicitly Unicode
 * font), `undefined` lets the heuristic decide.
 */
export function shouldConvertAsBijoy(
  text: string,
  fontIsBijoy?: boolean
): boolean {
  if (!text) return false;
  if (fontIsBijoy === true) return true;
  if (fontIsBijoy === false) return false;
  if (hasBengaliUnicode(text)) return false;
  return looksLikeBijoy(text);
}
