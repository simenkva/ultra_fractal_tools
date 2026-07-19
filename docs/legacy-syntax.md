# Legacy Ultra Fractal syntax accepted by this project

This document records compatibility constructs that syntax highlighting and
later analyzers must tolerate. Acceptance does not imply that new snippets or
formatting should generate these forms.

## Case insensitivity

Identifiers, keywords, compiler directives, sections, and predefined symbols
must be recognized without relying on the capitalization used in the catalog.

Sources:

- <https://www.ultrafractal.com/help/writing/language/variables.html>
- <https://www.ultrafractal.com/help/writing/reference/directives/compilerdirectives.html>

## Omitted and empty section labels

- A `.ufm` entry without an initial label starts in `init:`.
- In `.ufm`, an empty `:` label starts `loop:` and makes the final loop
  statement the bailout expression. A separate `bailout:` section is then not
  used.
- A `.ucl` entry without an initial label starts in `final:`; `init:` and
  `loop:` are not allowed in that shorthand form.
- A `.uxf` entry without an initial label starts in `transform:`.

Sources:

- <https://www.ultrafractal.com/help/writing/formulas/fractalformulas.html>
- <https://www.ultrafractal.com/help/writing/formulas/coloringalgorithms.html>
- <https://www.ultrafractal.com/help/writing/formulas/transformations.html>

The corpus files `uf-formulas/anv.ufm` and `uf-formulas/rsp.ufm` contain empty
legacy labels and are selected as regression inputs in
`test/fixtures/corpus-manifest.json`.

## Parameters and predefined aliases

- Parameters are normally written as `@name`, but the predefined parameters
  `p1` through `p6` and functions `fn1` through `fn4` may omit `@`.
- A parameter block is optional, so a referenced `@parameter` is not invalid
  merely because no matching block exists.
- Writing to parameters is accepted for compatibility, although discouraged.
- In fractal formulas, the `#` prefix may be omitted from `#z`.

Source: <https://www.ultrafractal.com/help/writing/language/parameters.html>

## Semi-reserved keywords

`const`, `import`, `new`, `return`, `static`, and `this` act as keywords in the
appropriate context but can also be older variable names. Later parsers must
interpret them contextually.

Source: <https://www.ultrafractal.com/help/writing/reference/keywords.html>

## Compiler directives

Directive nesting is a separate hierarchy from sections and normal
conditionals. Directives can cross section and loop boundaries, so a later
structural parser must not force directive blocks to nest inside syntax blocks.

Source:
<https://www.ultrafractal.com/help/writing/reference/directives/compilerdirectives.html>

## Entries, comments, and line continuations

- Entry identifiers may contain almost any non-whitespace characters.
- An optional parenthesized entry setting follows an entry identifier.
- `;` starts a comment through the end of the physical line.
- `comment { ... }` is a special non-code entry and can contain HTML-like help
  content.
- A trailing backslash continues a statement or setting on the next line.

Sources:

- <https://www.ultrafractal.com/help/writing/language/formulafilesandentries.html>
- <https://www.ultrafractal.com/help/writing/language/sections.html>

## Source encodings and line endings

The repository corpus contains ASCII and ISO-8859 text, CRLF line endings, and
some files with mixed CR/CRLF terminators. This is corpus compatibility data,
not a claim that these encodings are language syntax. Tests and future file
readers must avoid assuming that every source file is UTF-8 with LF endings.

