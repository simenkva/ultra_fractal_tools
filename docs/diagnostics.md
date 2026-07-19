# Structural analyzer and diagnostic rules

The M3 analyzer is an editor-independent TypeScript core. It tokenizes and
parses incomplete Ultra Fractal source without importing the VS Code API. Live
editor diagnostics are intentionally deferred to M4.

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
