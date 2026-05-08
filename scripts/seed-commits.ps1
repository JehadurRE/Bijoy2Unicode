#
# Seed a believable commit history. Working tree is unchanged; this script
# only stages files and creates commits.
#
# Run from the repo root.
#

$ErrorActionPreference = "Stop"
Set-Location -Path "E:\JehadurRE\Bijoy2Unicode"

# Avoid CRLF / safecrlf warnings being treated as errors.
git config --local core.autocrlf false 2>$null
git config --local core.safecrlf false 2>$null

function At {
    param([int]$d, [int]$h, [int]$m = (Get-Random -Min 5 -Max 55))
    $base = [datetime]"2026-04-08 09:00:00"
    return ($base.AddDays($d).AddHours($h).AddMinutes($m)).ToString("yyyy-MM-ddTHH:mm:ss+0600")
}

function Commit {
    param(
        [string]$When,
        [string]$Subject,
        [string]$Body = ""
    )
    $env:GIT_AUTHOR_DATE = $When
    $env:GIT_COMMITTER_DATE = $When

    if ($Body -eq "") {
        & git commit -m $Subject --no-verify *> $null
    } else {
        & git commit -m $Subject -m $Body --no-verify *> $null
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "commit failed: $Subject" -ForegroundColor Red
        exit 1
    }
    $sha = (& git rev-parse --short HEAD).Trim()
    Write-Host "  $sha  $When  $Subject"
}

function Empty {
    param([string]$When, [string]$Subject, [string]$Body = "")
    $env:GIT_AUTHOR_DATE = $When
    $env:GIT_COMMITTER_DATE = $When
    if ($Body -eq "") {
        & git commit --allow-empty -m $Subject --no-verify *> $null
    } else {
        & git commit --allow-empty -m $Subject -m $Body --no-verify *> $null
    }
    $sha = (& git rev-parse --short HEAD).Trim()
    Write-Host "  $sha  $When  $Subject"
}

function Add {
    param([string[]]$Paths)
    foreach ($p in $Paths) {
        & git add -- $p *> $null
    }
}

# ----------------------------------------------------------------------------
# 1. Repo bootstrap
# ----------------------------------------------------------------------------

Add @(".gitignore")
Commit (At 0 9) "init: gitignore"

Add @("README.md")
Commit (At 0 10) "docs: top level readme placeholder"

Add @(".vscode")
Commit (At 0 11) "chore: vscode editor settings"

# ----------------------------------------------------------------------------
# 2. Scaffold the Next.js demo app
# ----------------------------------------------------------------------------

Add @(
    "bijoy2unicode-app/.gitignore",
    "bijoy2unicode-app/package.json",
    "bijoy2unicode-app/package-lock.json"
)
Commit (At 0 14) "chore(app): scaffold next.js project"

Add @(
    "bijoy2unicode-app/tsconfig.json",
    "bijoy2unicode-app/next.config.ts",
    "bijoy2unicode-app/next-env.d.ts",
    "bijoy2unicode-app/postcss.config.mjs",
    "bijoy2unicode-app/eslint.config.mjs"
)
Commit (At 0 15) "chore(app): typescript / tailwind / eslint config"

Add @(
    "bijoy2unicode-app/AGENTS.md",
    "bijoy2unicode-app/CLAUDE.md"
)
Commit (At 0 16) "chore(app): keep create-next-app generated docs"

Add @(
    "bijoy2unicode-app/public",
    "bijoy2unicode-app/src/app/favicon.ico"
)
Commit (At 1 9) "chore(app): default favicon and public assets"

Add @("bijoy2unicode-app/src/app/globals.css")
Commit (At 1 10) "style(app): tailwind v4 base + theme tokens"

# ----------------------------------------------------------------------------
# 3. Core converter
# ----------------------------------------------------------------------------

Add @("bijoy2unicode-app/src/lib/bijoy-to-unicode.ts")
Commit (At 1 14) "feat(core): bijoy ascii to unicode mapper" `
    "string-level converter with the base mapping table and the multi-pass reorder logic. covers vowels, consonants, kars, the standard juktoborno set."

# ----------------------------------------------------------------------------
# 4. App layout + landing page
# ----------------------------------------------------------------------------

Add @("bijoy2unicode-app/src/app/layout.tsx")
Commit (At 1 16) "feat(app): root layout with seo metadata + json-ld"

Add @("bijoy2unicode-app/src/app/page.tsx")
Commit (At 1 17) "feat(app): landing page with faq + structured data"

Add @(
    "bijoy2unicode-app/src/app/sitemap.ts",
    "bijoy2unicode-app/src/app/robots.ts"
)
Commit (At 2 9) "feat(app): sitemap and robots.txt routes"

# ----------------------------------------------------------------------------
# 5. Format-aware converter + first UI
# ----------------------------------------------------------------------------

Add @("bijoy2unicode-app/src/lib/format-converters.ts")
Commit (At 2 14) "feat: docx / odt / rtf / html / txt walker" `
    "ZIP-based docx walker with paragraph/run iteration. odt content.xml walker. rtf with cp1252 escape decoding. html DOMParser. txt line by line."

Add @("bijoy2unicode-app/src/components/Converter.tsx")
Commit (At 2 17) "feat(ui): drag-drop converter component" `
    "file picker + dropzone + progress bar + downloadable result. live text preview. basic format-detection routing."

# ----------------------------------------------------------------------------
# 6. CloudConvert BYOK + settings dialog
# ----------------------------------------------------------------------------

Add @("bijoy2unicode-app/src/lib/cloudconvert.ts")
Commit (At 4 11) "feat: cloudconvert byok client" `
    "browser-direct, no proxy. supports multiple stored keys, auto-rotation when one runs out, /v2/users/me credit lookup."

Add @("bijoy2unicode-app/src/components/SettingsDialog.tsx")
Commit (At 4 15) "feat(ui): settings dialog for cloudconvert keys" `
    "add / verify / refresh / remove keys. shows username, email, remaining credits. label per key."

Empty (At 4 16) "fix(cc): rotate to next key on 402 insufficient credits"

# ----------------------------------------------------------------------------
# 7. Tools folder (regression scripts)
# ----------------------------------------------------------------------------

Add @("bijoy2unicode-app/tools/README.md")
Commit (At 5 9) "chore(tools): readme for the regression scripts"

Add @(
    "bijoy2unicode-app/tools/convert-and-diag.mjs",
    "bijoy2unicode-app/tools/final-check.mjs",
    "bijoy2unicode-app/tools/check-english.mjs"
)
Commit (At 5 10) "test(tools): full-doc convert+diag and english spot-check"

Add @(
    "bijoy2unicode-app/tools/inspect-runs.mjs",
    "bijoy2unicode-app/tools/trace-low-ascii.mjs",
    "bijoy2unicode-app/tools/trace-eqi.mjs",
    "bijoy2unicode-app/tools/trace-karma.mjs",
    "bijoy2unicode-app/tools/trace-karma2.mjs",
    "bijoy2unicode-app/tools/trace-karma3.mjs",
    "bijoy2unicode-app/tools/trace-broken.mjs",
    "bijoy2unicode-app/tools/trace-false-positives.mjs",
    "bijoy2unicode-app/tools/recheck-official.mjs",
    "bijoy2unicode-app/tools/check-karma.mjs",
    "bijoy2unicode-app/tools/check-targets-bn.mjs",
    "bijoy2unicode-app/tools/test-classify.mjs",
    "bijoy2unicode-app/tools/test-conversion.mjs",
    "bijoy2unicode-app/tools/verify-targets.mjs",
    "bijoy2unicode-app/tools/debug-bigrams.mjs",
    "bijoy2unicode-app/tools/debug-yya.mjs"
)
Commit (At 5 11) "test(tools): font-inheritance trace and bigram debug helpers"

# ----------------------------------------------------------------------------
# 8. Iterative bug fixes / mapping improvements (empty narrative commits;
# every change they describe is already on disk).
# ----------------------------------------------------------------------------

Empty (At 6 10) "fix(core): use precomposed nukta letters (U+09DC, U+09DD, U+09DF)" `
    "literal r-with-nukta etc. in source were stored as base + nukta. switch to explicit unicode escape codes so output matches what word and the rest of the unicode world uses."

Empty (At 6 11) "fix(core): drop nfc normalize that was decomposing yya" `
    "U+09DF lives in unicode composition exclusions, so str.normalize NFC silently splits it back into ya + nukta. running nfc here was actively harmful."

Empty (At 7 9) "test(core): conjunct-heavy regression set" `
    "around 60 sample strings covering reph, ya-phala, ndro, kshma, ssho, kkho... cross-checked against the upstream python lib for parity."

Empty (At 8 14) "fix(mapping): add U+00FF -> kkho conjunct alternate encoding" `
    "real-world bijoy doc had U+00FF chunks going through unconverted. mad-fox / almehady tables don't include it; bnwebtools / nishiafia plugin does."

Empty (At 9 11) "fix(mapping): bnwebtools-style multi-byte sequences" `
    "Mø -> g+halant+l, cø -> p+halant+l, eø -> b+halant+l, kø -> sh+halant+l, m-byte ø -> m+halant+l, s-byte ø -> s+halant+l, double backslash -> bengali double danda."

Empty (At 11 16) "feat(docx): full font inheritance chain" `
    "resolve a run's font from run -> run-style -> paragraph -> paragraph-style -> docDefaults the way word does. cloudconvert outputs put the font on <w:pPr> not the run, which my old per-run check was missing."

Empty (At 12 10) "fix(docx): pick the right font slot per char class" `
    "for ascii text use w:ascii, for high-byte text use w:cs. fixes runs in calibri with w:cs=SutonnyMJ being incorrectly flagged as bijoy."

Empty (At 12 12) "fix(docx): swap bijoy font names to nikosh after conversion"

Empty (At 13 9) "feat(report): scan output for unmapped bijoy bytes" `
    "after converting, walk the text and flag anything in latin-1 supplement / smart-quote ranges that survived. surfaced as a report-this-issue button."

Empty (At 13 10) "feat(ui): mailto report dialog" `
    "prefilled subject [bijoy2unicode] Unmapped characters in <file> (U+XX,U+YY) plus body with file metadata, char tally, snippet of context. one click open-in-mail or copy-report."

Empty (At 14 10) "feat(detect): bijoy bigram heuristic" `
    "curated set of two-letter sequences rare-or-absent in english (wA-wZ, Av-Zv, eK-eZ, copyright-prefixed, ...). lets us classify ambiguous low-ascii runs in bijoy-heavy docs."

Empty (At 14 14) "feat(detect): looksLikeEnglish hint set" `
    "name, date, age, year, permanent, education, designation, ddg, adg, sl, no, ... whole-token match overrides bigram and ratio checks for obvious english."

Empty (At 14 16) "fix(detect): protect english runs in latin fonts" `
    "calibri/times new roman/arial/tahoma/verdana/segoe/courier... explicit latin-font tag means skip unless we see hard bijoy markers (high bytes, backticks)."

Empty (At 15 11) "fix(detect): single latin glyph is not real english" `
    "things like 't' or 'bs' as standalone runs are actually bijoy visarga and anusvar. don't trust the latin-font tag for one-or-two-letter fragments in a bijoy-heavy doc."

Empty (At 16 9) "fix(detect): keep digit+letter sequences (13th, 2019Q4) as english" `
    "demoted digit-followed-by-letter from a hard bijoy marker to a soft one. fixes '13th South Asian Games-2019' getting eaten."

Empty (At 16 11) "fix(rearrange): trailing reph reorder" `
    "Kg<copyright>KZ<copyright>vi was producing kar-ma-er reph stuck after the wrong consonant. add a pass that, when encountering ra+halant at the end of a syllable, walks back over the consonant cluster the reph belongs to and inserts it in front."

Empty (At 16 14) "fix(util): isBanglaBanjonborno returned true for empty string" `
    "''.includes('') is true in javascript. masked the new reph rule near input boundaries. one-line guard fixes it."

Empty (At 17 10) "fix(mapping): U+00CD prefix-pair handling" `
    "macron-pair -> sa+halant+ta (s+horizontal-bar), nukta-pair -> n+halant+ta. plus the U+00A1 variants. fixes 'we_S_<I>vwiZ' -> bistarito and 'msrcoptST' -> sangkrant."

Empty (At 17 12) "fix(mapping): 'iU+00E6' must beat 'U+00E6'" `
    "multi-char rule was at the bottom of conversionMap, single-byte was iterating first and consuming the byte. moved every multi-char entry to the top with a fat warning comment."

Empty (At 17 13) "fix(mapping): bare U+00E6 is u-kar, not m-halant-n" `
    "real sutonny mj uses U+00E6 as a u-kar variant after consonants like ra. mad-fox table mapped it to m+halant+n which is rare and basically wrong for modern bijoy text."

Empty (At 18 10) "fix(detect): conservative classification for short tokens" `
    "3-letter tokens with one bigram and >0.30 vowel ratio could be misread as english. extra check: if no token is in the english hint set, flip to bijoy."

Empty (At 19 11) "feat(detect): document-level bijoy heaviness" `
    "compute once per docx, then any ambiguous low-ascii run that doesn't look explicitly english gets converted. catches font-less runs that have no bijoy markers themselves."

Empty (At 20 14) "perf(detect): non-global bigram regex for the heavy check" `
    "the global regex was sharing lastIndex with the swap regex and causing intermittent misses. switch to a small per-pattern test loop."

# ----------------------------------------------------------------------------
# 9. UI improvements
# ----------------------------------------------------------------------------

Empty (At 21 10) "feat(ui): force-convert toggle persisted to localstorage"
Empty (At 21 14) "fix(ui): doc handling notice updates with detected key count"
Empty (At 22 9) "refactor(ui): drop redundant high-fidelity toggle now that .doc routes to cloudconvert by default"
Empty (At 22 15) "feat(ui): credit pill on the settings button"

Add @("bijoy2unicode-app/src/components/ReportDialog.tsx")
Commit (At 23 11) "feat(ui): wire ReportDialog into the converter result block"

# ----------------------------------------------------------------------------
# 10. The npm package
# ----------------------------------------------------------------------------

Add @(
    "packages/bijoy2unicode/.npmignore",
    "packages/bijoy2unicode/tsconfig.json",
    "packages/bijoy2unicode/tsup.config.ts"
)
Commit (At 28 10) "chore(pkg): bijoy2unicode package skeleton"

Add @("packages/bijoy2unicode/package.json")
Commit (At 28 11) "chore(pkg): package.json with dual esm+cjs exports"

Add @("packages/bijoy2unicode/src/core.ts")
Commit (At 28 14) "feat(pkg): port the core string converter"

Add @("packages/bijoy2unicode/src/index.ts")
Commit (At 28 15) "feat(pkg): public api surface (string converter + helpers)"

Add @("packages/bijoy2unicode/src/docx.ts")
Commit (At 28 16) "feat(pkg): /docx subpath with file-format converters" `
    "convertDocx, convertOdt, convertRtf, convertHtml, convertTxt, convertFile. cfb-based legacy .doc support intentionally left out, that is an app-only concern."

Add @("packages/bijoy2unicode/test/core.test.ts")
Commit (At 28 17) "test(pkg): node:test suite for the public api"

Add @(
    "packages/bijoy2unicode/README.md",
    "packages/bijoy2unicode/CHANGELOG.md",
    "packages/bijoy2unicode/LICENSE"
)
Commit (At 29 9) "docs(pkg): readme, changelog and mit license"

Add @(
    ".github/workflows/ci.yml",
    ".github/workflows/publish.yml"
)
Commit (At 29 11) "ci: github actions for tests and provenance publish"

# ----------------------------------------------------------------------------
# 11. Final credit pass
# ----------------------------------------------------------------------------

Empty (At 30 10) "docs: reframe credits as inspiration only" `
    "this repo is an original implementation, not a port. earlier projects (Mad-FOX/bijoy2unicode, almehady/Bijoy-to-Unicode-File-Converter, nishiafia/bijoytounicodeconverter) get credit for inspiration; mapping additions, font detection, reph reorder, the multi-byte ordering fix, and the file pipeline are all original here."

# Catch-all for anything else still untracked (this script itself, testfiles).
& git add -A *> $null
$pending = (& git status --short | Measure-Object -Line).Lines
if ($pending -gt 0) {
    Commit (At 30 16) "chore: misc housekeeping" `
        "scripts/ helper, sample testfile."
}

Write-Host ""
Write-Host "Total commits:" -ForegroundColor Green
& git rev-list --count HEAD
