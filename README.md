# Ultra Fractal Language Support

VS Code language support for Ultra Fractal formula source files.

Coded with OpenAI Codex.

The extension registers a single `ultra-fractal` language mode for:

- `.ufm` fractal formulas
- `.ucl` coloring algorithms
- `.uxf` transformations
- `.ulb` class and plug-in libraries

It provides theme-compatible syntax highlighting for formulas, coloring
algorithms, transformations, classes, comments, strings, directives, numbers,
parameters, predefined symbols, sections, declarations, and legacy labels.
Editor support also includes semicolon comment toggling, bracket and quote
pairs, Ultra Fractal-aware word selection and indentation, structural folding
including `comment { ... }` documentation, Outline symbols, and starter
snippets.

An editor-independent structural analyzer now tokenizes and parses incomplete
source and produces stable, conservative diagnostic rules. It checks strings,
delimiters, language blocks, compiler directives, duplicate definitions,
sections, parameters, imports when resolution is exhaustive, and optional
legacy warnings. VS Code displays these diagnostics on open, edit, and save;
Ultra Fractal remains the authority on compilation. See
[the diagnostic rule reference](docs/diagnostics.md) and `PLAN.md` for the
roadmap.

## Diagnostics and imports

Run **Ultra Fractal: Validate Current File** from the Command Palette to
validate immediately. Normal edit validation is debounced, and diagnostics are
removed when a document closes. The **Ultra Fractal** output channel records
validation status and unexpected analyzer failures.

These settings control the integration:

- `ultraFractal.lint.enabled` enables diagnostics without affecting syntax
  highlighting or other editor features.
- `ultraFractal.lint.debounceMilliseconds` sets the edit delay from 0 to 5000
  milliseconds.
- `ultraFractal.lint.maxDiagnostics` limits displayed diagnostics to between 1
  and 1000 per file.
- `ultraFractal.lint.severityOverrides` maps stable rule IDs to `error`,
  `warning`, `information`, `hint`, or `off`.
- `ultraFractal.formulaSearchPaths` lists directories containing imported
  formula files. Relative paths are resolved from workspace folders.

Imports are searched in the current document directory, workspace folders,
and configured formula directories. A resolvable quoted import is a document
link and supports **Go to Definition**. Search-path changes immediately refresh
missing-import diagnostics.

## Snippets

Type one of these prefixes and select the matching completion:

- `uf-formula` - fractal formula
- `uf-coloring` - coloring algorithm
- `uf-transform` - transformation
- `uf-class` - class
- `uf-param` - parameter block
- `uf-func` - function block
- `uf-if` - conditional block

Indentation follows entries, sections, and Ultra Fractal block keywords.
Section labels and closers such as `endif`, `endfunc`, and `}` are aligned while
they are typed. Existing files are never formatted or rewritten automatically.

## Development

```sh
npm ci
npm test
npm run corpus:verify
npm run benchmark:analyzer
npm run benchmark:grammar
npm run test:integration
```

The corpus commands and benchmarks use a separately downloaded, local
`uf-formulas/` directory and report a clear skip when it is absent. The
reference corpus and Ultra Fractal manual are ignored by Git and are never
packaged with the extension. See the
[corpus review](docs/corpus-validation.md) and
[performance budgets](docs/performance.md) for the M5 workflow and baseline.

Live structural analysis runs in a cancellable worker so large files do not
block the Extension Host. Unchanged document versions reuse cached diagnostics,
and closing a document releases its pending work and cached state.

Press F5 in VS Code and choose **Run Ultra Fractal Extension** to open an
Extension Development Host. Scope conventions and bundled-theme verification
are documented in `docs/scope-policy.md` and `docs/theme-check.md`.

## Language catalog

The versioned UF6 catalog is defined in `src/catalog/uf6.ts`. Its scope,
provenance, and compatibility decisions are documented in
`docs/language-catalog.md` and `docs/legacy-syntax.md`.
