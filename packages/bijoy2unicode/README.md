# bijoy2unicode

[![npm version](https://img.shields.io/npm/v/bijoy2unicode.svg)](https://www.npmjs.com/package/bijoy2unicode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Types: TypeScript](https://img.shields.io/badge/types-TypeScript-blue)](#)

Convert legacy **Bijoy / Sutonny MJ** Bangla text and Word documents to **Unicode Bengali**, in the browser or on Node.

- Pure TypeScript, zero native deps. Runs in **browsers, Node 18+, Deno, Bun, Edge runtimes**.
- **String API** for converting individual strings.
- **File API** for `.docx`, `.odt`, `.rtf`, `.html`, `.txt`. Uses [JSZip](https://stuk.github.io/jszip/) only when you import `bijoy2unicode/docx`.
- **Strict font-aware detection** — English text in Latin fonts is never corrupted, even when sitting in the same paragraph as Bijoy.
- Handles inherited fonts via paragraph styles, character styles, and `docDefaults` — same way Word resolves them.
- Battle-tested on real-world Bangladesh government bio-data forms with thousands of mixed runs.

## Install

```bash
npm install bijoy2unicode
# or
pnpm add bijoy2unicode
# or
yarn add bijoy2unicode
```

## Quick start

### String conversion

```ts
import { convertBijoyToUnicode } from "bijoy2unicode";

convertBijoyToUnicode("Avgvi †mvbvi evsjv");
// → "আমার সোনার বাংলা"

convertBijoyToUnicode("Kg©KZ©vi e¨w³MZ I PvKzix msµvšÍ Z_¨vw`");
// → "কর্মকর্তার ব্যক্তিগত ও চাকুরী সংক্রান্ত তথ্যাদি"
```

### Word document conversion (.docx)

```ts
import { convertDocx } from "bijoy2unicode/docx";

const fileInput = document.querySelector<HTMLInputElement>("input")!;
fileInput.addEventListener("change", async () => {
  const file = fileInput.files![0];
  const blob = await convertDocx(file, {
    onProgress: ({ stage, percent }) => {
      console.log(`${percent}% ${stage}`);
    },
  });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), {
    href: url,
    download: file.name.replace(/\.docx$/, "-unicode.docx"),
  }).click();
});
```

### Auto-route by extension

```ts
import { convertFile } from "bijoy2unicode/docx";

const result = await convertFile(file);
// result.blob is the converted file
// result.filename is suggested output name
```

## API

### `bijoy2unicode` (default entry)

| export | description |
|---|---|
| `convertBijoyToUnicode(src: string): string` | Core converter. Always converts. |
| `looksLikeBijoy(text: string): boolean` | Heuristic — does the text contain Bijoy-specific high-byte chars? |
| `hasBengaliUnicode(text: string): boolean` | Does the text already contain Unicode Bengali? |
| `shouldConvertAsBijoy(text, fontIsBijoy?)` | Combine the heuristics into a single decision. |
| `scanUnmapped(unicodeText): Map<string, number>` | Find leftover suspicious chars (likely unmapped Bijoy bytes). |
| `isSuspiciousLeftover(ch): boolean` | Single-char version of the leftover check. |
| `describeCodepoint(ch): string` | Human-readable codepoint label, e.g. `"U+09C7"`. |

### `bijoy2unicode/docx`

All file-format helpers accept `Blob | File`. They return a `Blob` (or `ConversionResult` for `convertFile`).

| export | description |
|---|---|
| `convertDocx(file, opts?)` | Microsoft Word `.docx` |
| `convertOdt(file, opts?)` | OpenDocument Text `.odt` |
| `convertRtf(file, opts?)` | Rich Text Format `.rtf` |
| `convertHtml(file, opts?)` | HTML / `.htm` (browser only — uses `DOMParser`) |
| `convertTxt(file, opts?)` | Plain text |
| `convertFile(file, opts?)` | Auto-route by extension |
| `detectExt(name)` / `suggestOutputName(name, ext)` | Filename helpers |

#### `ConvertOptions`

```ts
interface ConvertOptions {
  onProgress?: (info: { stage: string; percent: number }) => void;
  /** Treat every run as Bijoy regardless of font / heuristics. Default: false. */
  force?: boolean;
}
```

## How the font detection works (the important part)

When converting `.docx`, the package does **not** blindly run the converter on every text run. It walks the OOXML and resolves the *effective font* of each `<w:r>`:

1. Run's own `<w:rFonts>` (highest priority)
2. Run's `<w:rStyle>` referenced character style
3. Paragraph's `<w:pPr><w:rPr><w:rFonts>`
4. Paragraph's `<w:pStyle>` referenced paragraph style (with `basedOn` chain resolution)
5. `<w:rPrDefault>` document default

If the resolved font is a known **Bijoy** font (any `…MJ`, BijoyEkattor, Sulekha, Boishakhi, …) the run is converted. If it's a known **Unicode Bangla** font (Nikosh, SolaimanLipi, Vrinda, Noto Bengali, …) the run is left alone. For ambiguous runs, it uses character-level heuristics (high-byte detection, Bijoy bigram density, English word lookup, vowel ratio) to decide.

This means **English text in Calibri / Times New Roman / Arial stays untouched**, even in a Bijoy-heavy document.

## Supported Bijoy variants

Wide coverage of real-world Sutonny MJ / Bijoy text, including alternate
encodings other libraries miss:

- Trailing-© reph reorder (`Kg©KZ©vi` → কর্মকর্তার)
- `Í` (U+00CD) prefix-pair → ন্ত / স্ত / ক্ত conjuncts (`we¯ÍvwiZ` → বিস্তারিত)
- `iæ → রু` (ordered before bare `æ → ু` to handle name forms like নূরুল correctly)
- `ÿ → ক্ষ` alternate kkho encoding
- Precomposed nukta forms (ড়/ঢ়/য়) preserved per Word/Office convention
- Multi-character sequences (`Mø → গ্ল`, `cø → প্ল`, `eø → ব্ল`, `kø → শ্ল`, etc.)
- Document-default font inheritance for runs that omit `<w:rFonts>` entirely

## Limitations

- **Legacy `.doc`** (binary OLE format) is not supported by this package. Convert via LibreOffice or CloudConvert first; this package will then handle the resulting `.docx` perfectly.
- **`.html` conversion** requires `DOMParser` (browser environment). For server-side HTML, run the string converter on extracted text.
- Pure-ASCII Bijoy text (`bvg wcZvi bvg` with no high-byte chars) is genuinely ambiguous in `.txt`/`.rtf`. Set `force: true` to convert anyway.

## Live demo

A full-featured demo site is at [github.com/JehadurRE/bijoy2unicode](https://github.com/JehadurRE/bijoy2unicode) — drag-and-drop conversion, multi-key CloudConvert integration for `.doc`, leftover-character reporting via email.

## Author

<div align="center">

### **Md. Jehad** (Jehadur Rahman Emran)

**Full Stack Developer & System Architect** · Cloud Connect AI

[![GitHub](https://img.shields.io/badge/GitHub-JehadurRE-181717?logo=github)](https://github.com/JehadurRE)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin)](https://linkedin.com/in/jehadurre)
[![Email](https://img.shields.io/badge/Email-Contact-EA4335?logo=gmail)](mailto:emran.jehadur@gmail.com)

</div>

### Professional Profile

**Md. Jehad** is a passionate Full Stack Developer and System Architect specializing in building scalable, cross-platform applications. With expertise spanning mobile, web, and backend technologies, he brings a comprehensive approach to software development.

#### Core Competencies

**Mobile Development**
- 🎯 Flutter & Dart — cross-platform mobile applications
- 📱 React Native & Expo — native mobile experiences
- 🎨 Material Design 3 & Adaptive UI/UX

**Backend Engineering**
- ⚡ FastAPI & Python — high-performance REST APIs
- 🗄️ PostgreSQL & Database Design — normalized schemas & optimization
- 🔄 Redis & Caching Strategies — performance optimization
- 🔐 JWT Authentication & Security — OWASP compliance

**System Architecture**
- 🏗️ Domain-Driven Design (DDD) — clean architecture patterns
- 📊 Database Schema Design — ERD modeling & optimization
- 🔗 API Integration — third-party services & payment gateways
- 📈 Scalable Systems — microservices & distributed architecture

**DevOps & Tools**
- 🐳 Docker & Containerization
- 🔄 CI/CD Pipelines — automated deployment
- 📊 Monitoring & Analytics — Firebase, Crashlytics
- 🔧 Git & Version Control

## Inspiration

Standing on the shoulders of earlier open-source Bijoy converters that paved
the way:

- [Mad-FOX/bijoy2unicode](https://github.com/Mad-FOX/bijoy2unicode) — early Python conversion algorithm
- [almehady/Bijoy-to-Unicode-File-Converter](https://github.com/almehady/Bijoy-to-Unicode-File-Converter) — Python file-wrapper that demonstrated the use case
- [nishiafia/bijoytounicodeconverter](https://github.com/nishiafia/bijoytounicodeconverter) — PHP/JS plugin with helpful alternate mappings

This package is an original TypeScript implementation with significant
corrections and additions for real-world Sutonny MJ documents (see the
[Supported Bijoy variants](#supported-bijoy-variants) section for the diff).

## License

[MIT](LICENSE)
