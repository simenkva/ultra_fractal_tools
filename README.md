# Ultra Fractal Language Support

Edit Ultra Fractal formula source in VS Code with syntax highlighting, folding,
Outline symbols, snippets, import navigation, and conservative structural
diagnostics.

![Ultra Fractal syntax highlighting in the Dark+ palette](images/highlighting.png)

## Supported files

| Extension | Ultra Fractal source type |
| --- | --- |
| `.ufm` | Fractal formulas |
| `.ucl` | Coloring algorithms |
| `.uxf` | Transformations |
| `.ulb` | Classes and plug-in libraries |

The extension does not claim `.upr` parameter sets or miscellaneous `.txt`
files.

## Features

- Theme-compatible TextMate highlighting for current and legacy formula syntax.
- Semicolon comment toggling, bracket and quote pairs, word selection, and
  section-aware indentation.
- Folding for entries, classes, functions, parameters, sections, and
  `comment { ... }` documentation.
- Outline symbols for entries, classes, sections, and functions.
- Seven starter snippets. Type `uf-` to find them.
- Links and **Go to Definition** for resolvable quoted imports.
- Worker-backed structural diagnostics with stable `UF` rule identifiers.

![Structural diagnostics and rule identifiers](images/diagnostics.png)

## Installation

### From a VSIX

1. Download the `.vsix` file from the matching GitHub release.
2. Open the Extensions view in VS Code.
3. Select **Views and More Actions**, then **Install from VSIX...**.
4. Reload VS Code when prompted.

You can also install from a terminal:

```sh
code --install-extension ultra-fractal-language-0.1.0.vsix
```

Marketplace and Open VSX installation links will appear here after the first
registry release.

## Using the extension

Open any supported formula file. VS Code selects the **Ultra Fractal** language
mode and starts validation. Run **Ultra Fractal: Validate Current File** from
the Command Palette to request a fresh check.

The extension searches quoted imports in the current file's directory,
workspace folders, and configured formula directories. Select a linked import
or use **Go to Definition** to open a resolved file.

### Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `ultraFractal.lint.enabled` | `true` | Enables structural diagnostics. Highlighting and editor features stay active when you turn it off. |
| `ultraFractal.lint.debounceMilliseconds` | `300` | Delays validation after an edit. Accepted range: 0 to 5000 ms. |
| `ultraFractal.lint.maxDiagnostics` | `100` | Limits displayed diagnostics per file. Accepted range: 1 to 1000. |
| `ultraFractal.lint.severityOverrides` | `{}` | Maps a rule ID to `error`, `warning`, `information`, `hint`, or `off`. |
| `ultraFractal.formulaSearchPaths` | `[]` | Adds directories for import resolution. Relative paths start at each workspace folder. |

For example:

```json
{
  "ultraFractal.lint.severityOverrides": {
    "UF2004": "off"
  },
  "ultraFractal.formulaSearchPaths": [
    "formulas",
    "/path/to/shared/formulas"
  ]
}
```

The [diagnostic rule reference](docs/diagnostics.md) lists each rule and its
default severity.

## Validation limits

The analyzer checks definite structural problems such as unterminated strings,
mismatched delimiters, malformed language blocks, duplicate definitions, and
invalid section or parameter structure. It also reports conservative warnings
for suspicious legacy constructs.

The analyzer does not compile or run formulas. It does not implement full type
checking, overload resolution, class inheritance analysis, or section-aware
validation of every predefined symbol. Ultra Fractal remains the authority for
compiler and runtime results. A clean VS Code Problems panel does not guarantee
that Ultra Fractal will accept a formula.

Missing-import diagnostics require a complete set of search paths. Add your
formula directories to `ultraFractal.formulaSearchPaths` before treating a
missing import as an error.

## Reporting problems

Use the [GitHub issue tracker](https://github.com/simenkva/ultra_fractal_tools/issues).
Include the extension version, VS Code version, file type, relevant `UF` rule
identifiers, and a small formula that reproduces the problem. Remove private or
third-party formula code before posting. See [SUPPORT.md](SUPPORT.md) for the
full checklist.

The extension collects no telemetry and makes no network requests. Read
[PRIVACY.md](PRIVACY.md) for details.

## Development

```sh
npm ci
npm test
npm run test:integration
npm run package:contents
npm run package:vsix
```

The corpus commands and benchmarks use a separate, ignored `uf-formulas/`
directory:

```sh
npm run corpus:verify
npm run benchmark:analyzer
npm run benchmark:grammar
```

They print a skip when the local corpus is absent. The project does not track
or package the reference corpus or Ultra Fractal manual. The
[corpus review](docs/corpus-validation.md),
[performance budgets](docs/performance.md), and
[release checklist](docs/releasing.md) document the validation process.

Press F5 in VS Code and choose **Run Ultra Fractal Extension** to open an
Extension Development Host.

## Project notes

The UF6 catalog lives in `src/catalog/uf6.ts`. Its provenance and compatibility
decisions appear in `docs/language-catalog.md` and `docs/legacy-syntax.md`.

Ultra Fractal is a product of Frederik Slijkerman. This independent extension
is not affiliated with or endorsed by Ultra Fractal. The project used OpenAI
Codex during development.

## License

Simen Kvaal licenses this extension under the [MIT License](LICENSE).
