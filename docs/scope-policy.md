# TextMate scope policy

The Ultra Fractal grammar uses established TextMate scope families so bundled
and third-party VS Code themes work without extension-specific color rules.

| Ultra Fractal construct | Primary scope family |
| --- | --- |
| Formula entry name | `entity.name.function` |
| Class and inherited class | `entity.name.type`, `entity.other.inherited-class` |
| Function or method | `entity.name.function` |
| Primitive type | `storage.type` |
| Built-in class | `support.class` |
| Control flow and sections | `keyword.control` |
| Block/contextual words | `keyword.other` |
| Operators | `keyword.operator` |
| Built-in function | `support.function` |
| Setting name | `support.type.property-name` |
| `@parameter` | `variable.other.parameter` |
| `#predefined` symbol | `variable.language.predefined` |
| Ordinary variable reference | `variable.other.readwrite` |
| Numeric and boolean constants | `constant.numeric`, `constant.language` |
| Strings | `string.quoted.double` |
| Semicolon comments | `comment.line.semicolon` |
| `comment { ... }` entry | `comment.block.documentation` |
| Delimiters and separators | `punctuation.*` |

All scopes end in `.ultra-fractal` to make them inspectable and selectively
customizable while retaining a standard parent scope.

## Lexical decisions

- Matching is case-insensitive for language-defined words.
- The entire `@name` or `#name` token receives one coherent scope, including
  its sigil.
- Ultra Fractal uses a trailing backslash for physical-line continuation. It is
  scoped as `constant.character.escape.line-continuation`; a backslash directly
  before a closing quote is not treated as a C-style escaped quote because the
  public formula corpus uses expressions such as `enum = "\" "|"`, where that
  backslash is the string content and the following quote is its delimiter.
- A quoted string that lacks both a closing quote and trailing continuation
  backslash ends at the physical line boundary. This prevents an incomplete
  edit from coloring the remainder of the file as a string.
- A documentation entry ends only at a closing brace on its own logical line,
  so braces in HTML-like documentation text do not terminate it.
- User-defined class types cannot be identified reliably with lexical rules.
  M1 highlights declared class names and documented built-in classes; semantic
  resolution belongs to a later analyzer milestone.
- A late ordinary-identifier fallback scopes variable reads, writes, and
  switch mappings without overriding earlier rules for settings, types,
  functions, keywords, `@parameters`, or `#predefined` symbols. TextMate
  highlighting does not resolve whether two identical names refer to the same
  symbol.
