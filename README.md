# bijoy2unicode

<p align="center">
  <img src="https://bijoy2unicode.jehadurre.me/logo.svg" alt="bijoy2unicode" width="320" />
</p>

Convert legacy **Bijoy / Sutonny MJ** Bangla text and Word documents to **Unicode Bengali**.

<p align="center">
  <a href="https://www.npmjs.com/package/bijoy2unicode"><img src="https://img.shields.io/npm/v/bijoy2unicode.svg?logo=npm&label=bijoy2unicode" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/bijoy2unicode"><img src="https://img.shields.io/npm/dm/bijoy2unicode.svg?logo=npm" alt="npm downloads per month" /></a>
  <a href="https://www.npmjs.com/package/bijoy2unicode"><img src="https://img.shields.io/npm/dw/bijoy2unicode.svg" alt="npm downloads per week" /></a>
  <a href="https://github.com/JehadurRE/Bijoy2Unicode/stargazers"><img src="https://img.shields.io/github/stars/JehadurRE/Bijoy2Unicode?style=social" alt="GitHub stars" /></a>
  <a href="packages/bijoy2unicode/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://bijoy2unicode.jehadurre.me"><img src="https://img.shields.io/badge/Live-bijoy2unicode.jehadurre.me-22c55e?logo=vercel&logoColor=white" alt="Live demo" /></a>
</p>

> If this converted a document you actually needed, please
> **[star this repo](https://github.com/JehadurRE/Bijoy2Unicode)** — it is the main way other people find the tool.
> Issues and awkward Bijoy `.docx` samples are also welcome.

## Try it

- Live app: <https://bijoy2unicode.jehadurre.me>
- Mirror: <https://bijoy2unicodex.vercel.app>

Drag-and-drop a `.docx`, `.odt`, `.rtf`, `.html`, or `.txt` file. Those formats are converted **in the browser**; they are not uploaded to a bijoy2unicode server.

Legacy binary `.doc` is different: the **npm package does not read `.doc`**. In the web app, if you add your own [CloudConvert](https://cloudconvert.com/dashboard/api/v2/keys) API token in Settings, the file is sent from the browser to CloudConvert to be upgraded to `.docx`, then the Bijoy → Unicode pass still runs locally. Without a token, the app falls back to an in-browser text-only `.doc` path that does not keep complex formatting. The app’s FAQ notes that CloudConvert’s free plan (as documented there) covers 25 conversions per day.

## What’s in this monorepo

| Folder | Description |
|---|---|
| [`packages/bijoy2unicode`](packages/bijoy2unicode) | The npm package — string + file conversion. ESM + CJS + TypeScript types. Node 18+. |
| [`bijoy2unicode-app`](bijoy2unicode-app) | The live web app — Next.js, drag-and-drop UI, optional CloudConvert BYOK for `.doc`. |
| [`testfiles`](testfiles) | Real-world `.docx` regression samples. |

The published package is [`bijoy2unicode`](https://www.npmjs.com/package/bijoy2unicode) (currently 1.0.2). Full API notes live in [`packages/bijoy2unicode/README.md`](packages/bijoy2unicode/README.md).

## Install

```bash
npm install bijoy2unicode
```

Requires Node.js 18 or later. The default entry has no file I/O. Import `bijoy2unicode/docx` when you need documents (that path uses [JSZip](https://www.npmjs.com/package/jszip)).

## Usage

```ts
import { convertBijoyToUnicode } from "bijoy2unicode";
import { convertDocx, convertFile } from "bijoy2unicode/docx";

convertBijoyToUnicode("Avgvi †mvbvi evsjv");
// → "আমার সোনার বাংলা"

const blob = await convertDocx(file);
const result = await convertFile(file);
// result.blob, result.filename
```

Helpers on the default entry: `looksLikeBijoy`, `hasBengaliUnicode`, `shouldConvertAsBijoy`, `scanUnmapped`, `isSuspiciousLeftover`, `describeCodepoint`.

File helpers: `convertDocx`, `convertOdt`, `convertRtf`, `convertHtml` (browser `DOMParser` only), `convertTxt`, `convertFile`. Pass `{ force: true }` to convert even when heuristics are unsure. `{ onProgress }` reports stage and percent.

## How font-aware detection works

`.docx` conversion does **not** run the converter on every run blindly. It resolves the effective font of each `<w:r>` in this order:

1. The run’s own `<w:rFonts>`
2. The run’s character style
3. The paragraph run fonts
4. The paragraph style (`basedOn` chain)
5. Document default `<w:rPrDefault>`

Known Bijoy fonts (for example names ending in `MJ`, BijoyEkattor, Sulekha, Boishakhi) are converted. Known Unicode Bangla fonts (Nikosh, SolaimanLipi, Vrinda, Noto Bengali, and similar) are left alone. Ambiguous runs use character heuristics (high-byte characters, Bijoy bigram density, English-word lookup, vowel ratio).

English in Calibri / Times New Roman / Arial stays untouched, even inside a Bijoy-heavy document.

## Supported Bijoy details (from the package)

These are cases the library is written to handle, including some encodings other converters miss:

- Trailing-© reph reorder (`Kg©KZ©vi` → কর্মকর্তার)
- `Í` (U+00CD) prefix-pair conjuncts (`we¯ÍvwiZ` → বিস্তারিত)
- `iæ → রু` ordered before bare `æ → ু`
- `ÿ → ক্ষ` alternate encoding
- Precomposed nukta letters (ড় / ঢ় / য়) kept as Word/Office usually stores them
- Multi-character sequences such as `Mø → গ্ল`, `cø → প্ল`, `eø → ব্ল`, `kø → শ্ল`

## Limitations

- **Legacy `.doc` (binary OLE)** is not supported in the npm package. Convert to `.docx` first (LibreOffice, or CloudConvert as in the web app).
- **`.html` conversion** needs `DOMParser` (browser). On a server, extract text and use `convertBijoyToUnicode`.
- Pure-ASCII Bijoy (`bvg wcZvi bvg` with no high-byte characters) is ambiguous in `.txt` / `.rtf`. Use `force: true` if you know it is Bijoy.

## Development

```bash
cd bijoy2unicode-app
npm run dev
```

Open <http://localhost:3000>. Package tests and the publish workflow live under `packages/bijoy2unicode`.

## Contributing

Bug reports and PR with messy real-world Bijoy `.docx` samples help the most. The live app can report leftover unmapped characters.

## Author

**Md. Jehad (Jehadur Rahman Emran)** · Cloud Connect AI

- GitHub: [JehadurRE](https://github.com/JehadurRE)
- Website: [jehadurre.me](https://jehadurre.me)
- Email: emran.jehadur@gmail.com

The TypeScript implementation builds on, and corrects, earlier open-source Bijoy converters that served as inspiration. See the package README for that note.

## Snippets & recipes

- [Bijoy → Unicode in 5 lines (TypeScript)](https://gist.github.com/JehadurRE/60c4fc89abe9e50e9746d12be9417832)
- [Detect Bijoy vs Unicode Bengali before you convert](https://gist.github.com/JehadurRE/1492d905a0692671d2278e515987a05c)
- [Font-aware Bijoy .docx conversion in the browser](https://gist.github.com/JehadurRE/c2bd2750c5115e2d2aef106f2bc20e16)
- [Find leftover Bijoy bytes after a conversion](https://gist.github.com/JehadurRE/b41d4c4cf9d67de226df08c26c916b4a)

## License

[MIT](packages/bijoy2unicode/LICENSE)
