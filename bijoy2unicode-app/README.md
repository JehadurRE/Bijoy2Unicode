# Bijoy to Unicode Converter

Free, private, browser-based Bijoy → Unicode converter for Bangla `.docx`, `.doc`, `.odt`, `.rtf`, `.html`, and `.txt` files. The whole conversion runs in the user's browser — no upload, no server, no signup.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **JSZip**.

> The conversion engine is shipped as a standalone npm package, [`bijoy2unicode`](../packages/bijoy2unicode). This app is the live demo / production deployment.

## Features

- One-click conversion of Bijoy (Sutonny MJ) Word documents to Unicode Bengali
- **Strict font-aware detection** — English text in Latin fonts (Calibri, Times New Roman, Arial) is preserved untouched
- Resolves inherited fonts via paragraph styles, character styles, and `docDefaults` (the same way Word does)
- Optional **CloudConvert BYOK** path for legacy `.doc` with multi-key auto-rotation and live credit display
- Leftover-character detector with one-click email report
- Live text preview for quick paste-and-check use
- Fully client-side processing (privacy + offline-friendly after first load)
- Drag & drop upload, progress feedback, and instant download
- SEO-ready: SSR landing page, structured data (`SoftwareApplication`, `FAQPage`), `sitemap.xml`, `robots.txt`, OG/Twitter metadata

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Build & static export

```bash
npm run build
npm run start
```

The app generates fully static routes and can be hosted on Vercel, Netlify, Cloudflare Pages, or any static host.

## Project layout

```
src/
  app/
    layout.tsx           # global metadata, JSON-LD, fonts
    page.tsx             # landing page + FAQ + author info
    sitemap.ts / robots.ts
  components/
    Converter.tsx        # client-side UI (drag-drop, progress, preview)
    SettingsDialog.tsx   # CloudConvert API-key manager (multi-key + auto-rotation)
    ReportDialog.tsx     # mailto report with leftover-char telemetry
  lib/
    bijoy-to-unicode.ts  # core Bijoy → Unicode mapping + reorder rules
    format-converters.ts # font-aware .docx / .odt / .rtf / .html / .txt walkers
    cloudconvert.ts      # browser-direct CloudConvert client (BYOK)
```

## How the conversion works

1. A `.docx` is just a zip containing XML parts.
2. JSZip opens the archive in memory.
3. The font-aware walker resolves each `<w:r>` run's effective font from
   run → run-style → paragraph → paragraph-style → docDefaults.
4. Only runs in known Bijoy fonts (or runs whose text contains hard Bijoy
   markers like high-byte glyphs) are converted. English runs in Latin fonts
   pass through unchanged.
5. Converted runs have their `<w:rFonts>` rewritten to **Nikosh** so the new
   text renders correctly.
6. The archive is repackaged and offered as a download blob.

## Inspiration

Original implementation by **Md. Jehad (Jehadur Rahman Emran)**. Inspired by
earlier open-source Bijoy converters that paved the way:

- [Mad-FOX/bijoy2unicode](https://github.com/Mad-FOX/bijoy2unicode) — early Python conversion algorithm
- [almehady/Bijoy-to-Unicode-File-Converter](https://github.com/almehady/Bijoy-to-Unicode-File-Converter) — Python file wrapper that demonstrated the use case
- [nishiafia/bijoytounicodeconverter](https://github.com/nishiafia/bijoytounicodeconverter) — PHP/JS plugin with helpful alternate mappings

This app and its `bijoy2unicode` package are an original TypeScript
implementation with significant corrections and additions (trailing-© reph
reorder, `Í` prefix handling, `iæ → রু` ordering, `ÿ → ক্ষ`, font-inheritance
chain, bigram-based detection, ...).

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
