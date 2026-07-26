# Structural analyzer and diagnostic rules

The analyzer is an editor-independent TypeScript core. It tokenizes and parses
incomplete Ultra Fractal source without importing the VS Code API. The M4 VS
Code integration validates supported files on open, edit, and save, and clears
diagnostics when a document closes.

The analyzer performs structural checks only. Ultra Fractal remains the
authority on compilation, types, overloads, class resolution, and runtime
behavior. In particular, the analyzer does not report an `@parameter` merely
because the file contains no corresponding parameter block.

## API and ranges

`analyze(source, options)` returns tokens, a partial syntax tree, and sorted
diagnostics. Callers must provide the formula file type (`ufm`, `ucl`, `uxf`, or
`ulb`). Source ranges use zero-based lines and characters, absolute offsets,
and an exclusive end position.

Import checking is opt-in. A resolver returns `found`, `missing`, or
`unchecked`; `UF2003` is emitted only for `missing`, which means every
configured search location was checked. Resolver failure is treated as
`unchecked` rather than as a missing file.

Any rule can be suppressed through `disabledRules`. This is especially useful
for the optional compatibility warning `UF2004`.

## Command-line structural analysis

After compiling the project, files can be checked without starting VS Code:

```sh
npm run analyze:formula -- path/to/formula.ufm
npm run analyze:formula -- --format json path/to/coloring.ucl
```

The command derives the formula type from `.ufm`, `.ucl`, `.uxf`, or `.ulb`.
For standard input, pass `--stdin` and an explicit `--file-type`. Text output
uses one-based line and column locations. JSON output uses the analyzer's
zero-based, exclusive ranges and explicitly records that the result is
structural, not compiled or rendered. Each JSON file report also includes
top-level entry and class identifiers with their source ranges. This supports
project-level tooling without turning naming conventions into analyzer rules.

Import checking is unchecked by default. Use `--imports exhaustive` only when
the document directory and every `--search-path` together represent all
locations that Ultra Fractal would search. This prevents an absent local file
from being misreported when it could exist in an unconfigured installation
folder.

## VS Code integration

Edit validation is debounced and obsolete scheduled work is cancelled. The
**Ultra Fractal: Validate Current File** command bypasses the delay. Unexpected
analyzer failures are contained, clear the affected diagnostic collection, and
are recorded in the **Ultra Fractal** output channel.

Analysis runs in a memory-bounded worker outside the Extension Host. Cancelling
obsolete work terminates that worker. An unchanged document version and import
root set reuse cached diagnostics; severity and display-limit changes therefore
do not rescan source. Closing a document removes both its diagnostics and its
cached controller state.

The `ultraFractal.lint.severityOverrides` setting changes displayed severity by
stable rule ID; assigning `off` suppresses that rule. Displayed results are
bounded by `ultraFractal.lint.maxDiagnostics`, and
`ultraFractal.lint.enabled` can disable all diagnostics without disabling
highlighting, folding, Outline, snippets, or import navigation.

For imports, the extension searches the current document directory, workspace
folders, and `ultraFractal.formulaSearchPaths`, in that order. Relative
configured paths are resolved from workspace folders (or from the document
directory when no workspace is open). A missing-import warning is emitted only
when every available root was checked. Resolvable imports become document links
and **Go to Definition** targets.

## Stable rules

| Rule | Severity | Condition and reason |
| --- | --- | --- |
| `UF1001` | Error | A string reaches a physical line without a closing quote or trailing continuation. This is unambiguously incomplete. |
| `UF1002` | Error | `()`, `[]`, or `{}` are unmatched or mismatched outside strings and comments. The reported range is the smallest useful opener or closer. |
| `UF1003` | Error | `if`, `while`, `repeat`, `func`, `param`, or `heading` has an invalid matching closer. Inline parameter aliases such as `param x = object.x` do not open blocks. |
| `UF1004` | Error | `$ifdef`, `$else`, and `$endif` nesting is invalid. Directive nesting is tracked independently because UF6 allows directives to cross sections, loops, and conditionals. |
| `UF1005` | Error | A case-insensitive entry or class identifier is repeated in one file. UF6 uses identifiers to distinguish definitions in a file. |
| `UF1006` | Error | A section is not legal for the parsed definition. Class declarations use class visibility sections even when declared in a `.ufm`, `.ucl`, or `.uxf` file. |
| `UF2001` | Warning | Legal sections are repeated or appear outside the documented order. This is a warning because historical formulas can use unusual layouts. |
| `UF2002` | Warning | A parameter block name is repeated case-insensitively within one definition. Leading `@` does not create a distinct parameter name. |
| `UF2003` | Warning | An import resolver has exhaustively checked its configured locations and reported the imported file missing. No resolver means no warning. |
| `UF2004` | Warning | Accepted legacy syntax is discouraged for new formulas. M3 currently applies this to the empty `.ufm` section label, which UF6 interprets as `loop:`. |

The section inventories come from the versioned catalog in
`src/catalog/uf6.ts`. Compiler-directive behavior follows the official note
that directives have a separate hierarchy:
<https://www.ultrafractal.com/help/writing/reference/directives/compilerdirectives.html>.
