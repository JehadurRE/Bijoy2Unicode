# Manual Test & Diagnostic Scripts

Quick scripts for verifying the Bijoy → Unicode converter against real-world
files. They are not part of the build — run them ad-hoc with `tsx` / `node`.

All scripts assume the test corpus lives at:

```
E:/JehadurRE/Bijoy2Unicode/testfiles/
```

## Scripts

| Script | What it does |
|---|---|
| `convert-and-diag.mjs` | Runs the converter on the test `.docx`, writes the result, then scans every part of the output for leftover Bijoy bytes and reports counts/samples. |
| `final-check.mjs` | Scans every `<w:t>` body in the converted file for Bijoy bytes and reports counts of user-known leftover fragments (`cwiwPwZ`, `GwWG`, etc.). |
| `check-english.mjs` | Spot-checks that English phrases survived intact and prints the first 800 chars of converted body for visual inspection. |
| `inspect-runs.mjs` | Walks the original `.docx` and shows every Bijoy run with its resolved font (paragraph + style + run inheritance). Useful for diagnosing why a run wasn't converted. |
| `trace-low-ascii.mjs` | Traces the full font-inheritance chain for specific Bijoy fragments (`cwiwPwZ bs`, `GwWG`, `eQi 5gvm 17w\`b`). |
| `recheck-official.mjs` | Locates every "Official Visit" run in the original to verify Latin runs aren't being incorrectly classified. |
| `test-classify.mjs` | Standalone test of the `looksLikeEnglish` heuristic with a curated set of Bijoy and English samples. Pure JS, no imports. |

## How to run

```pwsh
# from the bijoy2unicode-app folder
npx --yes tsx tools/convert-and-diag.mjs
npx --yes tsx tools/final-check.mjs
npx --yes tsx tools/check-english.mjs
npx --yes tsx tools/inspect-runs.mjs
npx --yes tsx tools/trace-low-ascii.mjs
npx --yes tsx tools/recheck-official.mjs
node tools/test-classify.mjs   # pure JS, no tsx needed
```

## Adding a new test file

Drop the source `.docx` (or `.doc` after CloudConvert upgrade) into
`E:/JehadurRE/Bijoy2Unicode/testfiles/` and update the `SRC` constant at the
top of each script.
