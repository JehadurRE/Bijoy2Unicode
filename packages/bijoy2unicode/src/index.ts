/**
 * bijoy2unicode — Convert legacy Bijoy / Sutonny MJ Bangla text to Unicode.
 *
 * Default entry: string conversion + helpers (no file/document I/O).
 * For .docx / .odt / .rtf / .html / .txt file conversion, import from
 * `bijoy2unicode/docx` (it pulls in JSZip).
 *
 * @example Basic string conversion
 * ```ts
 * import { convertBijoyToUnicode } from "bijoy2unicode";
 *
 * convertBijoyToUnicode("Avgvi †mvbvi evsjv");
 * // → "আমার সোনার বাংলা"
 * ```
 */

export {
  convertBijoyToUnicode,
  scanUnmapped,
  isSuspiciousLeftover,
  describeCodepoint,
  looksLikeBijoy,
  hasBengaliUnicode,
  shouldConvertAsBijoy,
} from "./core.js";
