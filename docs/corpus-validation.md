# Corpus validation

M5 uses the locally downloaded `uf-formulas/` collection as an optional,
read-only compatibility input. The collection and Ultra Fractal manual remain
ignored by Git and excluded from extension packages. The committed baseline
contains file names, sizes, line counts, and aggregate diagnostic counts only;
it contains no formula source, diagnostic excerpts, or copied documentation.

## Commands

```sh
npm run corpus:scan
npm run corpus:verify
npm run corpus:baseline
```

`corpus:scan` compiles the project, analyzes every `.ufm`, `.ucl`, `.uxf`, and
`.ulb` file, and writes `out/corpus-analysis.json`. Each file runs in an
isolated worker with a 120-second timeout and a bounded heap. The default is one
worker at a time to avoid multiplying the substantial memory needed by the
largest files; `UF_CORPUS_WORKERS` can select between one and four workers.

`corpus:verify` compares a fresh deterministic report with
`test/baselines/corpus-analysis.json`. `corpus:baseline` replaces that reviewed
baseline and should be used only after investigating the diff. All three
commands report a clear skip and exit successfully when the optional corpus is
absent.

Files are decoded as Latin-1 for the scan. This preserves every byte and covers
the non-UTF-8 text present in older submissions; formula syntax itself is
ASCII-compatible. Regression tests separately cover Latin-1 text, LF, CRLF,
legacy CR, and mixed CR/CRLF input.

Import resolution is deliberately conservative. Imports found in the current
directory or corpus root are marked found. An absent import remains unchecked,
because the scan does not have the user's Ultra Fractal installation and all
of its configured formula search paths. Consequently, the scan never claims
that an external or built-in library is missing.

## Reviewed baseline

The 2026-07-20 baseline covers 403 supported files, 3,543,322 physical lines,
and 101,460,929 bytes. It contains 232 error-level and 412 warning-level
structural diagnostics in 54 files; 349 files are clean. These counts describe
the downloaded corpus, not a claim that every reported source fragment fails
in every Ultra Fractal version.

| Rule | Count | Files | Review disposition |
| --- | ---: | ---: | --- |
| `UF1001` | 54 | 9 | All samples are malformed continued strings: a blank line interrupts the string or whitespace follows the continuation backslash. Follow-on errors remain possible after broken string recovery. |
| `UF1002` | 2 | 2 | One entry has no closing brace; one class setting has an additional opening parenthesis without its match. |
| `UF1003` | 56 | 6 | Fifty unmatched parameter closers come from concatenated names such as a type followed by `param...` without a separating keyword. Two heading issues and one orphaned conditional closer are source issues; the remaining three diagnostics are documented follow-ons from `UF1001` recovery. |
| `UF1004` | 0 | 0 | No invalid compiler-directive nesting was found. |
| `UF1005` | 8 | 6 | Each sampled identifier is genuinely declared twice in its file, including two pairs of repeated classes. |
| `UF1006` | 112 | 3 | Three `.ulb` submissions contain regular formula/coloring entries rather than class declarations, so their sections are illegal for the declared file kind. |
| `UF2001` | 320 | 15 | Repeated or reordered sections occur mainly in legacy and compiler-conditional layouts. The rule remains a warning because those layouts can be intentional. |
| `UF2002` | 24 | 19 | Duplicate parameter names include compiler-conditional alternatives; warning severity preserves compatibility without treating them as definite compiler failures. |
| `UF2003` | 0 | 0 | External misses are unchecked because the scan cannot exhaust the user's search paths. M4 tests cover exhaustive missing-import behavior separately. |
| `UF2004` | 68 | 2 | These are accepted empty legacy section labels and are intentionally optional warnings. |

The scan prompted one analyzer correction: delimiters in file preambles and in
legal punctuation-heavy entry identifiers are no longer treated as formula
delimiters. The original minimal regression is committed as
`test/analyzer/corpus-regressions.ufm`.

The structural rules follow the official descriptions of
[formula files and entries](https://www.ultrafractal.com/help/writing/language/formulafilesandentries.html),
[sections](https://www.ultrafractal.com/help/writing/language/sections.html),
and [classes](https://www.ultrafractal.com/help/writing/classes/classes.html).
Ultra Fractal remains the compilation authority.
