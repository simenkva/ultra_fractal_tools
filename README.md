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
legacy warnings. Live display of these diagnostics in VS Code is planned for
M4; Ultra Fractal remains the authority on compilation. See
[the diagnostic rule reference](docs/diagnostics.md) and `PLAN.md` for the
roadmap.

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
npm run benchmark:grammar
npm run test:integration
```

The grammar benchmark requires a separately downloaded, local `uf-formulas/`
directory. That reference corpus and the Ultra Fractal manual are ignored by
Git and are never packaged with the extension.

Press F5 in VS Code and choose **Run Ultra Fractal Extension** to open an
Extension Development Host. Scope conventions and bundled-theme verification
are documented in `docs/scope-policy.md` and `docs/theme-check.md`.

## Language catalog

The versioned UF6 catalog is defined in `src/catalog/uf6.ts`. Its scope,
provenance, and compatibility decisions are documented in
`docs/language-catalog.md` and `docs/legacy-syntax.md`.
