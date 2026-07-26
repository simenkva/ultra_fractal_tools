# Bundled theme check

The representative M1 fixture was tokenized with VS Code 1.129.1's bundled
Dark+ and Light+ TextMate rules on 2026-07-19. The check resolved the actual
foreground assigned after the base theme and `+` theme rules were combined; it
did not add Ultra Fractal-specific colors.

| Example | Scope family | Dark+ | Light+ |
| --- | --- | --- | --- |
| `My-Formula` | `entity.name.function` | `#DCDCAA` | `#795E26` |
| `$IFDEF` | `keyword.control` | `#C586C0` | `#AF00DB` |
| `float` | `storage.type` | `#569CD6` | `#0000FF` |
| `@seed` | `variable.other.parameter` | `#9CDCFE` | `#001080` |
| Ordinary variable | `variable.other.readwrite` | `#9CDCFE` | `#001080` |
| `1.25e-3` | `constant.numeric` | `#B5CEA8` | `#098658` |
| `isNaN` | `support.function` | `#DCDCAA` | `#795E26` |
| Continued string text | `string.quoted.double` | `#CE9178` | `#A31515` |
| Continuation backslash | `constant.character.escape` | `#D7BA7D` | `#EE0000` |
| Semicolon comment | `comment.line.semicolon` | `#6A9955` | `#008000` |

The two bundled themes distinguish the principal lexical categories and keep
continued string content consistently colored on its second physical line.
Punctuation and ordinary operators intentionally inherit each theme's normal
editor foreground when the theme has no more specific rule.
