# Ultra Fractal Language Support for VS Code

## Executive summary

This project will provide a VS Code extension for editing Ultra Fractal formula
source files. The first usable release will prioritize accurate syntax
highlighting and editor behavior. A subsequent milestone will add conservative
structural diagnostics without claiming to reproduce the Ultra Fractal
compiler.

The extension will initially support:

- `.ufm` - fractal formulas
- `.ucl` - coloring algorithms
- `.uxf` - transformations
- `.ulb` - class and plug-in libraries

Parameter sets (`.upr`) and miscellaneous `.txt` files are outside the initial
scope because they are not Ultra Fractal formula source files and use different
structures.

## Project goals

1. Make Ultra Fractal formula files immediately recognizable and readable in
   VS Code with theme-compatible syntax highlighting.
2. Provide useful editing behavior such as comment toggling, bracket matching,
   indentation, folding, and document outlines.
3. Detect definite structural mistakes while avoiding noisy or speculative
   warnings.
4. Remain responsive on the large real-world files in `uf-formulas/`.
5. Produce an installable VSIX package that can later be published to the VS
   Code Marketplace and Open VSX.

## Non-goals for the first release

- Reimplementing the complete Ultra Fractal compiler or runtime.
- Guaranteeing that a file accepted by the extension will compile in Ultra
  Fractal.
- Evaluating formulas or rendering fractals.
- Full type inference, overload resolution, or class inheritance analysis.
- Formatting or automatically rewriting legacy formula syntax.
- Syntax support for `.upr` parameter sets.
- Automating the Ultra Fractal GUI to retrieve compiler messages.

## Current inputs

The local development checkout can contain these ignored reference inputs:

- The Ultra Fractal 6 manual in `uf6-manual.pdf`.
- 403 relevant formula and library files in `uf-formulas/`.
- Approximately 3.5 million lines of real-world Ultra Fractal source.
- Examples of legacy syntax, compiler directives, classes, imports, parameter
  blocks, embedded documentation, and files several megabytes in size.

This corpus can be used locally for discovery, compatibility checks, and
performance testing. It and the manual are not redistributed or tracked by
Git. Committed regression fixtures are original, minimal examples; the
extension must never rewrite local reference inputs.

## Recommended architecture

The extension should be developed in TypeScript and divided into three layers:

1. **Declarative language support**
   - VS Code language registration
   - TextMate grammar
   - Language configuration
   - Snippets, if added
2. **Editor-independent analysis core**
   - Lexer/tokenizer
   - Error-tolerant structural parser
   - Versioned language catalog
   - Diagnostics and document-symbol extraction
3. **VS Code integration**
   - Diagnostic collection
   - Document symbols
   - Import navigation
   - Configuration and commands

The analyzer should not import the VS Code API. Keeping it editor-independent
will make it easy to unit test and, if later justified, expose through a
Language Server Protocol implementation.

Proposed layout:

```text
.
├── package.json
├── tsconfig.json
├── language-configuration.json
├── syntaxes/
│   └── ultra-fractal.tmLanguage.json
├── src/
│   ├── extension.ts
│   ├── analyzer/
│   │   ├── lexer.ts
│   │   ├── parser.ts
│   │   ├── diagnostics.ts
│   │   └── symbols.ts
│   └── catalog/
│       └── uf6.ts
├── test/
│   ├── grammar/
│   ├── analyzer/
│   ├── fixtures/
│   └── integration/
└── uf-formulas/
```

## Milestone overview

| Milestone | Outcome | Depends on |
| --- | --- | --- |
| M0 - Foundation and specification | Buildable extension skeleton and documented language inventory | None |
| M1 - Syntax highlighting MVP | Accurate highlighting for the four supported file types | M0 |
| M2 - Editor ergonomics | Comments, indentation, folding, outlines, and starter snippets | M1 |
| M3 - Structural analyzer | Editor-independent lexer, parser, and conservative lint rules | M0 |
| M4 - VS Code diagnostics | Live diagnostics and configurable import resolution | M3 |
| M5 - Corpus hardening | Compatibility and performance validated against the repository corpus | M1-M4 |
| M6 - Release candidate | Installable, documented, versioned VSIX package | M5 |

## M0 - Foundation and language specification

**Status:** Complete (2026-07-19)

### Objective

Create a minimal, buildable VS Code extension and establish a documented source
of truth for the supported language constructs.

### Deliverables

- TypeScript extension scaffold with reproducible build, lint, and test scripts.
- `ultra-fractal` language ID registered for `.ufm`, `.ucl`, `.uxf`, and `.ulb`.
- Development-host launch configuration.
- Initial fixtures selected from each supported file type.
- A versioned UF6 catalog containing, at minimum:
  - Reserved and semi-reserved keywords
  - Type names
  - Control-flow and block keywords
  - Compiler directives
  - Formula sections by file type and their legal ordering
  - Built-in functions
  - Predefined `#` symbols
  - Known settings used in `default:` and related blocks
- Documentation of legacy constructs that must remain accepted.

### Acceptance criteria

- The extension compiles from a clean checkout.
- Opening each supported file type selects the Ultra Fractal language mode.
- Unsupported `.upr` and `.txt` files are not claimed automatically.
- Language catalog entries identify their Ultra Fractal version and source.
- No generated files or dependencies are committed unintentionally.

### Completion evidence

- `npm ci` completes from `package-lock.json`, followed by a passing `npm test`.
- A VS Code 1.129.1 Extension Host integration run confirms `.ufm`, `.ucl`,
  `.uxf`, and `.ulb` open as `ultra-fractal`, while `.upr` and `.txt` do not.
- Catalog tests verify that every catalog group is non-empty, UF6-versioned,
  officially sourced, and case-insensitively unique where applicable.
- Fixture tests verify all four supported kinds and validate the optional
  local-corpus manifest without requiring copyrighted inputs in a clean clone.
- `.gitignore` and the package `files` allowlist exclude build output,
  dependencies, the formula corpus, the manual, and test runtimes from source
  control or distributable packages as appropriate. Current `vsce` versions
  reject combining that allowlist with a `.vscodeignore` file.

## M1 - Syntax highlighting MVP

**Status:** Complete (2026-07-19)

### Objective

Provide dependable, theme-compatible lexical highlighting using a TextMate
grammar.

### Required token classes

- Semicolon line comments.
- `comment { ... }` documentation entries.
- Strings, escapes, and backslash line continuation.
- Integers, floats, scientific notation, imaginary constants, and complex
  expressions.
- `@parameter` references and `#predefined` symbols.
- `$define`, `$undef`, `$ifdef`, `$else`, and `$endif` directives.
- Entry identifiers, class declarations, inheritance specifications, and
  imports.
- Section labels such as `global:`, `init:`, `loop:`, `bailout:`, `default:`,
  `switch:`, `transform:`, and coloring sections.
- Type names, declarations, functions, parameter blocks, settings, control-flow
  keywords, operators, and member access.
- Legacy empty labels and Fractint-compatible entry syntax without grammar
  failure.

### Deliverables

- `syntaxes/ultra-fractal.tmLanguage.json`.
- Grammar fixtures with token-scope assertions.
- Visual examples checked with at least one bundled light theme and one bundled
  dark theme.
- A short scope naming policy so custom colors are not required for normal VS
  Code themes.

### Acceptance criteria

- Strings and comments do not leak highlighting into following entries.
- Keywords are matched case-insensitively where Ultra Fractal does so.
- Sigil symbols keep the sigil and identifier in a coherent scope.
- Braces inside strings and line comments do not terminate entries.
- Representative `.ufm`, `.ucl`, `.uxf`, and `.ulb` fixtures have stable token
  snapshots.
- Opening the largest corpus files does not cause sustained editor lockups.

### Completion evidence

- The registered `source.ultra-fractal` TextMate grammar covers all required
  lexical families and uses the standard scope policy in
  `docs/scope-policy.md`.
- Eleven unit checks pass, including explicit comment/string leakage checks,
  case-insensitive coverage of the complete UF6 function/directive catalog,
  and stable scope inventories for `.ufm`, `.ucl`, `.uxf`, and `.ulb`.
- The three largest corpus files total 472,700 lines and tokenize in under 15
  seconds in the standalone full-corpus benchmark, with no individual line
  reaching the two-second safety cutoff.
- VS Code 1.129.1 Dark+ and Light+ resolve the representative scopes to useful,
  distinct theme colors without custom token color rules; exact examples are
  recorded in `docs/theme-check.md`.

## M2 - Editor ergonomics

**Status:** Complete (2026-07-19)

### Objective

Make routine formula editing comfortable before adding semantic analysis.

### Deliverables

- Language configuration for:
  - Semicolon comment toggling
  - Bracket matching and auto-closing
  - Auto-surrounding for brackets and strings
  - Word selection including `@` and `#` symbols
  - Indentation around entries and block keywords
  - Folding for entries, classes, functions, parameter blocks, and sections
- Document symbols for entries and classes, with nested sections and functions
  when reliable.
- Starter snippets for fractal formulas, coloring algorithms,
  transformations, classes, parameters, functions, and conditional blocks.

### Acceptance criteria

- Comment toggling inserts and removes `;` correctly on single and multiple
  lines.
- Pressing Enter after block openers produces useful indentation.
- Closing keywords and closing braces outdent predictably.
- The Outline view lists top-level entries and classes in source order.
- Snippets generate syntactically plausible skeletons and use tab stops.
- Legacy source is not reformatted automatically.

### Completion evidence

- The language configuration supplies semicolon comments, matching and
  surrounding pairs, sigil-aware words, and case-insensitive indentation rules.
- A narrowly scoped on-type provider aligns newly typed section labels and
  closing keywords without registering a document formatter or modifying
  existing source.
- The read-only Outline provider covers entries, classes, sections, and
  functions in source order. Folding covers those constructs plus parameter
  blocks; fixtures verify all four supported file types.
- Seven contributed snippets generate tab-stopped fractal, coloring,
  transformation, class, parameter, function, and conditional skeletons.
- Seventeen unit tests and a VS Code 1.129.1 Extension Host run exercise actual
  comment, pair, word-selection, indentation, folding, Outline, and snippet
  behavior. The three largest corpus files scan for M2 structure in under 225
  milliseconds each in the standalone check.
- The package dry run contains all four compiled editor modules, the grammar,
  language configuration, snippets, and README, while excluding tests and the
  corpus.

## M3 - Structural analyzer

**Status:** Complete (2026-07-19)

### Objective

Build an error-tolerant analysis core that reports definite structural problems
without requiring VS Code or Ultra Fractal.

### Deliverables

- A lexer that tracks ranges for identifiers, literals, symbols, comments,
  directives, newlines, and line continuations.
- An error-tolerant parser for entries, classes, sections, declarations, and
  nested blocks.
- Diagnostics with stable rule identifiers and severity levels.
- Unit tests for valid, incomplete, malformed, and legacy source.

### Initial diagnostic rules

Errors:

- Unterminated strings.
- Unmatched `()`, `[]`, and `{}` delimiters outside strings and comments.
- Mismatched block pairs such as `if`/`endif`, `while`/`endwhile`,
  `func`/`endfunc`, and `param`/`endparam`.
- Invalid compiler-directive nesting.
- Duplicate entry or class identifiers in the same file, compared using Ultra
  Fractal's case rules.
- Sections that are definitely illegal for the current formula type.

Warnings:

- Sections in an invalid or suspicious order.
- Duplicate parameter declarations within an entry.
- Missing imported files when all configured search locations have been
  checked.
- Constructs accepted for compatibility but discouraged for new formulas,
  provided the warning can be disabled.

### Diagnostic policy

- Do not report an unknown `@parameter` merely because it has no parameter
  block; Ultra Fractal permits implicit parameters.
- Do not type-check arbitrary expressions in this milestone.
- Do not reject semi-reserved keywords without considering their context.
- Prefer no diagnostic over a speculative diagnostic.
- Every rule must have a focused test and a documented reason.

### Acceptance criteria

- Analysis returns a partial result rather than throwing on incomplete input.
- Diagnostic ranges point to the smallest useful source span.
- Every reported error describes both the problem and the expected closing or
  matching construct.
- The analyzer has no dependency on the VS Code API.
- Tests cover nested and interleaved compiler directives separately from normal
  control-flow nesting.

### Completion evidence

- `src/analyzer/` contains an editor-independent source map, lexer, tolerant
  parser, typed syntax tree, diagnostic engine, and public barrel module; a
  source-level test confirms none imports the VS Code API.
- The lexer emits range-bearing identifiers, string/number/boolean literals,
  symbols, line and documentation comments, directives, physical newlines, and
  line continuations. Tests cover LF, CRLF, legacy CR-CRLF input, continued
  strings, adjacent quoted fragments, and masking of delimiters in non-code.
- The parser returns partial entries and classes with sections, declarations,
  and nested normal blocks. Compiler directives use an independent nesting
  stack, including explicit nested and interleaved regression cases.
- Ten stable rules (`UF1001`-`UF1006` and `UF2001`-`UF2004`) have fixed
  severities, focused source ranges, documented rationale, and focused tests.
  Missing imports are reported only after a resolver returns `missing`, and
  compatibility warnings can be disabled.
- Fourteen analyzer tests cover valid `.ufm`, `.ucl`, `.uxf`, and `.ulb`
  fixtures plus incomplete, malformed, legacy, duplicate, illegal-order,
  directive, import, and inline-alias cases. The full unit suite has 31 passing
  tests, and the VS Code 1.129.1 Extension Host suite remains green.
- A read-only scan of all 403 supported files in the ignored local corpus
  completed without an exception. Reviewing and baselining its diagnostics is
  intentionally reserved for M5.
- A package dry run includes the compiled analyzer, UF6 catalog, and diagnostic
  reference while excluding tests, the local corpus, and the manual.

## M4 - VS Code diagnostics and navigation

**Status:** Complete (2026-07-19)

### Objective

Expose the analyzer through responsive VS Code features.

### Deliverables

- Diagnostics on file open, change, save, and close.
- Debounced validation with cancellation of obsolete work.
- Configuration for enabling linting, severity overrides, maximum diagnostics,
  and Ultra Fractal formula search paths.
- Import resolution relative to workspace and configured formula directories.
- Document links or definition navigation for resolvable imports.
- An `Ultra Fractal: Validate Current File` command.
- An output channel for analyzer status and unexpected failures.

### Acceptance criteria

- Diagnostics disappear when the responsible text is corrected.
- Closing a document clears its diagnostics.
- A rapid sequence of edits does not queue stale validation runs.
- Missing-import warnings update when search-path settings change.
- Extension failures are contained and do not interrupt normal editing.
- Linting can be disabled independently of syntax highlighting.

### Completion evidence

- A VS Code diagnostics controller validates supported documents on open,
  debounced changes, save, configuration changes, and workspace/import changes;
  close handling cancels pending work, clears diagnostics, and releases its
  per-document state.
- Generation, document-version, timer, and cancellation checks prevent an
  obsolete edit from publishing. A real Extension Host test confirms three
  rapid edits coalesce into at most one analysis run and publish only the final
  version.
- Settings provide independent lint enablement, a bounded debounce interval,
  a diagnostic limit, stable per-rule severity or suppression overrides, and
  formula search paths. Configuration changes revalidate open files.
- Imports resolve against the document directory, workspace folders, and
  configured absolute or workspace-relative directories. Resolved imports are
  clickable and support **Go to Definition**; exhaustive misses produce
  `UF2003`.
- The **Ultra Fractal: Validate Current File** command validates immediately,
  while the **Ultra Fractal** output channel records validation status and
  contains unexpected analyzer failures.
- Four focused M4 unit tests bring the full unit suite to 35 passing tests. A
  VS Code 1.129.1 Extension Host run covers open/change/save/close behavior,
  correction clearing, rapid edits, lint toggling, severity overrides,
  diagnostic limits, live search-path updates, import navigation, and failure
  containment.

## M5 - Corpus validation and hardening

**Status:** Complete (2026-07-20)

### Objective

Prove that the extension handles the repository's real formula collection with
acceptable compatibility and performance.

M5 is divided into two independently reviewable sub-goals. M5a establishes
correctness against the corpus before M5b fixes performance budgets around the
stabilized behavior.

### M5a - Corpus compatibility baseline

#### Objective

Turn the ignored local formula corpus into repeatable compatibility evidence,
then review and correct false positives without redistributing source files.

#### Deliverables

- An automated full-corpus analysis command.
- A machine-readable, aggregate baseline of diagnostics emitted for
  `uf-formulas/`, containing no formula source text.
- Regression fixtures for every corrected false positive or crash.
- Tests covering mixed line endings and representative source encodings found
  in the corpus.

#### Quality gates

- No analyzer crashes or infinite loops across the supported corpus.
- No unreviewed error-level diagnostics on known-good fixtures.
- Every diagnostic class found in the corpus is reviewed, sampled, or explicitly
  deferred with a reason.
- The corpus and manual remain read-only reference inputs excluded from Git and
  distributable packages.

#### Acceptance criteria

- The corpus command succeeds when the local corpus is available and reports a
  clear skip when it is absent.
- A complete scan produces a deterministic machine-readable summary grouped by
  rule, severity, file type, and file.
- All known false positives are fixed, downgraded with justification, or
  explicitly documented.
- Each analyzer correction has a focused, original regression fixture that can
  run in a clean checkout without the reference corpus.

#### Completion evidence

- `npm run corpus:scan`, `corpus:baseline`, and `corpus:verify` use isolated,
  memory-bounded workers with a per-file timeout. They clearly skip when the
  optional corpus is absent, and verification reproduces the committed
  deterministic baseline exactly.
- The reviewed baseline covers 403 supported files, 3,543,322 physical lines,
  and 101,460,929 bytes. Its 644 diagnostics are grouped by severity, stable
  rule, file type, and file without storing source text, diagnostic excerpts,
  timings, or memory measurements.
- Every stable rule and every diagnostic category present in the scan is
  classified in `docs/corpus-validation.md`. External imports remain unchecked
  because the scan cannot exhaust a user's Ultra Fractal search paths.
- Corpus review corrected delimiter false positives in file preambles and
  punctuation-heavy entry identifiers. An original minimal fixture preserves
  both cases without redistributing corpus content.
- Unit coverage verifies deterministic/source-free reports, the committed
  baseline, absent-corpus discovery, Latin-1 decoding, and LF, CRLF, CR, and
  mixed CR/CRLF input. Known-good fixtures for all four file types remain free
  of diagnostics.

### M5b - Performance and lifecycle hardening

#### Objective

Set enforceable performance budgets and keep validation responsive and
resource-safe on typical and multi-megabyte formula files.

#### Deliverables

- Performance measurements for representative typical files and the largest
  corpus files.
- Recorded analysis, grammar-tokenization, and editor-lifecycle budgets with
  regression checks where practical.
- Cancellable large-file validation that avoids rescanning unchanged source.
- Lifecycle coverage proving closed-document state and resources are released.
- An end-to-end large-file scenario in a VS Code Extension Development Host.

#### Quality gates

- Normal editing remains responsive on typical source files.
- Large-file analysis is cancellable and does not repeatedly rescan unchanged
  documents.
- TextMate patterns avoid catastrophic backtracking on multi-megabyte files.
- Memory used for closed documents is released.

#### Acceptance criteria

- Performance budgets are recorded with the test environment and enforced in
  regression tests where stable enough to be meaningful.
- Typical-file edits stay within the recorded responsiveness budget, and a
  superseded large-file run cannot publish stale diagnostics.
- Revalidation reuses unchanged results or demonstrably avoids redundant scans.
- Closing a document cancels its work, removes diagnostics, and releases cached
  state.
- The grammar and analyzer complete on the largest corpus files without a
  timeout, runaway memory use, or catastrophic backtracking.
- The VS Code Extension Host scenario passes with the same cancellation and
  cleanup behavior exercised by unit-level tests.

#### Completion evidence

- Live diagnostics run in a worker outside the Extension Host with a 768 MiB
  old-generation heap bound. Obsolete work terminates the worker; unchanged
  document versions and import-root sets reuse cached diagnostic arrays.
- Import navigation uses a cancellable line scanner rather than the full
  analyzer on the Extension Host and shields `comment { ... }` documentation
  entries from false links.
- `npm run benchmark:analyzer` enforces 2-second typical-file, 15-second
  large-file, 45-second combined, and 768 MiB heap budgets. The reference run
  completed typical files in 15-20 ms and each of the five largest files in
  1.1-2.2 seconds using at most 500 MiB heap.
- `npm run benchmark:grammar` tokenized 472,700 lines and 5,591,632 tokens in
  14.1 seconds of wall time. No line reached its two-second cutoff, and the
  enforced wall-time budget remains 60 seconds.
- The VS Code 1.129.1 Extension Host suite validates a generated source larger
  than 2 MiB, bounds import navigation, cancels its in-flight analyzer worker,
  publishes only the corrected version, proves an unchanged validation is a
  cache hit, and confirms close removes diagnostics and all controller state.
- The full unit suite has 43 passing tests. Package review includes both worker
  modules and M5 documentation while excluding tests, the reference corpus,
  the manual, source files, and dependencies.

## M6 - Release candidate and distribution

**Status:** Complete (2026-07-20)

### Objective

Create a polished extension package that can be installed and evaluated by
Ultra Fractal users.

### Deliverables

- Versioned VSIX package produced with `@vscode/vsce`.
- README with:
  - Supported file types and features
  - Installation instructions
  - Screenshots
  - Configuration reference
  - Linter limitations
  - Issue-reporting guidance
- `CHANGELOG.md`, license, extension icon, repository metadata, and privacy
  statement if required.
- Clean package-content review using the VSIX manifest.
- Manual installation test in a normal VS Code profile.
- Marketplace and Open VSX publishing checklist.

### Acceptance criteria

- The VSIX installs without development tooling.
- Highlighting works even when linting is disabled.
- The packaged extension contains no formula corpus or manual unless their
  redistribution rights have been explicitly confirmed.
- README examples accurately reflect the shipped behavior.
- The release notes distinguish structural validation from Ultra Fractal
  compiler validation.
- Publishing credentials and publisher ownership remain external to the
  repository.

### Completion evidence

- Release metadata now targets version 0.1.0 with repository, issue tracker,
  icon, banner, privacy, support, and preview-listing metadata.
- `@vscode/vsce` 3.9.2 is pinned as a development dependency. Package scripts
  compile, test, review contents, and build the VSIX.
- The README includes feature and file-type coverage, VSIX installation,
  screenshots, every setting, analyzer limits, privacy, and issue-reporting
  guidance. `CHANGELOG.md`, `PRIVACY.md`, `SUPPORT.md`, and the two-registry
  release checklist cover the remaining release documentation.
- Simen Kvaal confirmed the MIT license. The VSIX manifest links its packaged
  `LICENSE.txt`, icon, README, changelog, repository, support page, and release
  identity.
- `ultra-fractal-language-0.1.0.vsix` contains 35 files and is 192,663 bytes.
  Its SHA-256 digest is
  `ddbe6d59a449c618da72fd24847ac7bb7a7ab8f3129e4445b0ea1e6736ab9f73`.
  Archive and `vsce` file-list audits confirm that it contains no corpus,
  manual, TypeScript source, tests, source maps, dependencies, or credentials.
- VS Code 1.129.1 installed that exact VSIX into an empty profile without
  development tooling and listed
  `ultra-fractal-tools.ultra-fractal-language@0.1.0`. Opening the grammar
  fixture activated the installed extension through `onLanguage:ultra-fractal`,
  displayed Dark+ highlighting, and ran worker diagnostics. Restarting the
  profile with `ultraFractal.lint.enabled` set to `false` retained Ultra Fractal
  language selection and highlighting while the Problems counts stayed at
  zero and the analyzer performed no validation.
- Fifty unit and package tests pass. The VS Code Extension Host suite passes all
  language, editing, Outline, folding, snippet, diagnostic, import, caching,
  cancellation, and lifecycle checks.
- The final corpus verification processes 403 files, 3,543,322 lines, and
  101,460,929 bytes without a baseline change. The analyzer's five large files
  complete in 8.94 seconds against a 45-second budget; the three-file grammar
  benchmark completes in 14.60 seconds against a 60-second wall budget.

## Post-1.0 candidates

These features should be prioritized from user feedback rather than included
automatically in the initial release:

- Hover documentation and links for built-ins, settings, directives, and
  predefined symbols.
- Context-sensitive completions and function signatures.
- Go to definition and references for local functions, classes, and parameters.
- Section-aware validation of predefined `#` symbols.
- Semantic highlighting from resolved declarations.
- Type checking and class inheritance analysis.
- An LSP wrapper if other editors or heavy cross-file analysis need it.
- A separate language mode for `.upr` parameter sets.
- Optional integration with a future documented Ultra Fractal compiler or CLI.

## Risks and mitigations

### Context-sensitive and legacy syntax

Ultra Fractal supports compatibility syntax and semi-reserved keywords. A
strict parser could reject valid historical formulas.

Mitigation: keep the parser error-tolerant, develop against real corpus samples,
and reserve error severity for unambiguous failures.

### No documented command-line compiler

The available Ultra Fractal documentation describes compilation through the
built-in formula editor and Compiler Messages window. Without a documented CLI,
the extension cannot use the authoritative compiler as a portable linter.

Mitigation: clearly label diagnostics as structural checks and retain the Ultra
Fractal application as the authority for compilation and runtime behavior.

### Grammar performance on large files

Several corpus files are multiple megabytes. Poorly bounded TextMate regular
expressions can degrade editor responsiveness.

Mitigation: prefer line-oriented patterns, avoid broad nested backtracking, and
benchmark the largest files before release.

### Reference and redistribution rights

The project can derive factual symbol names and language behavior from the
official documentation, but bundling manuals, help text, or the full public
formula corpus may require permission.

Mitigation: vendor only the minimal factual catalog needed by the extension,
link to official documentation, and exclude source corpora and manuals from the
VSIX by default.

## Definition of done for version 1.0

Version 1.0 is complete when:

1. All four supported file extensions activate the correct language mode.
2. Syntax highlighting covers the required token classes and passes grammar
   fixtures.
3. Core editing behaviors and document outlines work reliably.
4. Structural diagnostics are responsive, configurable, tested, and clearly
   described as non-authoritative.
5. The full repository corpus can be processed without crashes or unacceptable
   editor slowdown.
6. An installable VSIX passes a clean-profile installation test.
7. Documentation accurately states supported features, exclusions, and known
   limitations.

## Reference material

- Ultra Fractal formula files and entries:
  <https://www.ultrafractal.com/help/writing/language/formulafilesandentries.html>
- Ultra Fractal sections:
  <https://www.ultrafractal.com/help/writing/language/sections.html>
- Ultra Fractal classes and imports:
  <https://www.ultrafractal.com/help/writing/classes/importingclasses.html>
- Ultra Fractal compiler directives:
  <https://www.ultrafractal.com/help/writing/reference/directives/compilerdirectives.html>
- VS Code syntax highlighting guide:
  <https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide>
- VS Code language configuration guide:
  <https://code.visualstudio.com/api/language-extensions/language-configuration-guide>
- VS Code language server guide:
  <https://code.visualstudio.com/api/language-extensions/language-server-extension-guide>
- VS Code extension publishing guide:
  <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
