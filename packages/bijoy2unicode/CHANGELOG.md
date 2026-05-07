# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-24

First public release. Original TypeScript implementation by
**Md. Jehad (Jehadur Rahman Emran)**, with significant corrections and
additions over earlier open-source Bijoy converters that served as
inspiration.

### Added
- `convertBijoyToUnicode(src)` — string-level Bijoy → Unicode conversion.
- `bijoy2unicode/docx` subpath: `convertDocx`, `convertOdt`, `convertRtf`,
  `convertHtml`, `convertTxt`, `convertFile`.
- Strict font-aware detection for `.docx` with full inheritance chain
  (run → run-style → paragraph → paragraph-style → docDefaults).
- Helpers: `looksLikeBijoy`, `hasBengaliUnicode`, `shouldConvertAsBijoy`,
  `scanUnmapped`, `isSuspiciousLeftover`, `describeCodepoint`.
- Trailing-© reph reorder so `Kg©KZ©vi` → `কর্মকর্তার`.
- `Í` (U+00CD) prefix-pair handling so `we¯ÍvwiZ` → `বিস্তারিত`.
- `iæ → রু` multi-byte rule with correct ordering before single-byte `æ → ু`.
- `ÿ → ক্ষ` mapping (alternate Sutonny MJ encoding).
- Precomposed nukta letters (ড়/ঢ়/য়) preserved per Word/Office convention.
- Bigram-based Bijoy detection plus English-word lookup for ambiguous
  low-ASCII runs.
- ESM + CJS dual builds with TypeScript declaration files.
