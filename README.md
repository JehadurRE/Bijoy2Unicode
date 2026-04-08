# bijoy2unicode

Convert legacy Bijoy / Sutonny MJ Bangla text and Word documents to Unicode Bengali.

This monorepo contains:

| Folder | Description |
|---|---|
| [`packages/bijoy2unicode`](packages/bijoy2unicode) | The npm package — string + file conversion. ESM + CJS + types. |
| [`bijoy2unicode-app`](bijoy2unicode-app) | The live web app — Next.js 16, drag-and-drop UI, CloudConvert BYOK for legacy `.doc`. |
| [`testfiles`](testfiles) | Real-world `.docx` regression samples. |

## The npm package

```bash
npm install bijoy2unicode
```

```ts
import { convertBijoyToUnicode } from "bijoy2unicode";
import { convertDocx } from "bijoy2unicode/docx";

convertBijoyToUnicode("Avgvi †mvbvi evsjv");
// → "আমার সোনার বাংলা"

const blob = await convertDocx(file);
```

See [`packages/bijoy2unicode/README.md`](packages/bijoy2unicode/README.md) for the full API.

## The web app

```bash
cd bijoy2unicode-app
npm run dev
```

Open <http://localhost:3000>.

## Author

**Md. Jehad (Jehadur Rahman Emran)** — Full Stack Developer & System Architect, Cloud Connect AI.

## License

[MIT](packages/bijoy2unicode/LICENSE)
