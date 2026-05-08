# bijoy2unicode

<p align="center">
  <img src="https://bijoy2unicode.jehadurre.me/logo.svg" alt="bijoy2unicode" width="320" />
</p>

Convert legacy Bijoy / Sutonny MJ Bangla text and Word documents to Unicode Bengali.

[![npm version](https://img.shields.io/npm/v/bijoy2unicode.svg?logo=npm&label=bijoy2unicode)](https://www.npmjs.com/package/bijoy2unicode)
[![Live](https://img.shields.io/badge/Live-bijoy2unicode.jehadurre.me-22c55e?logo=vercel&logoColor=white)](https://bijoy2unicode.jehadurre.me)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](packages/bijoy2unicode/LICENSE)

> 🌐 **Try it now:** <https://bijoy2unicode.jehadurre.me> · mirror: <https://bijoy2unicodex.vercel.app>

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

<div align="center">

### **Md. Jehad** (Jehadur Rahman Emran)

**Full Stack Developer & System Architect** · Cloud Connect AI

[![GitHub](https://img.shields.io/badge/GitHub-JehadurRE-181717?logo=github)](https://github.com/JehadurRE)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin)](https://linkedin.com/in/jehadurre)
[![Email](https://img.shields.io/badge/Email-Contact-EA4335?logo=gmail)](mailto:emran.jehadur@gmail.com)

</div>

Md. Jehad is a passionate Full Stack Developer and System Architect specializing in building scalable, cross-platform applications across mobile (Flutter, React Native), web, and backend (FastAPI, PostgreSQL, Redis, Docker) — with a strong focus on Domain-Driven Design, clean architecture, and production-ready systems.

## License

[MIT](packages/bijoy2unicode/LICENSE)
