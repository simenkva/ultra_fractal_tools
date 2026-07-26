# UF6 Evidence Map

## Authority and provenance

Apply this hierarchy without promoting a lower source over a higher one:

1. **Official**: Ultra Fractal 6 manual and official help pages.
2. **Repository-verified**: versioned catalog, language notes, and analyzer
   documentation.
3. **Corpus-observed**: private community code showing real usage, including
   old syntax, workarounds, and possible errors.
4. **Design inference**: a new mathematical or software design derived for the
   task.

Identify the source near any uncertain claim. If sources conflict, prefer
official UF6 documentation, describe the conflict, and require a compiler test.

## Official topic map

Use these official UF6 help pages for documented semantics:

| Topic | Official source |
|---|---|
| Types | <https://www.ultrafractal.com/help/writing/language/types.html> |
| Keywords | <https://www.ultrafractal.com/help/writing/reference/keywords.html> |
| Built-in functions | <https://www.ultrafractal.com/help/writing/reference/functions/functions.html> |
| Predefined symbols | <https://www.ultrafractal.com/help/toc-18-5-3.html> |
| General settings | <https://www.ultrafractal.com/help/toc-18-5-4-0.html> |
| Parameter settings | <https://www.ultrafractal.com/help/toc-18-5-4-1.html> |
| Compiler directives | <https://www.ultrafractal.com/help/writing/reference/directives/compilerdirectives.html> |
| Classes | <https://www.ultrafractal.com/help/writing/classes/classes.html> |
| Visibility | <https://www.ultrafractal.com/help/writing/classes/membervisibility.html> |
| Fractal formulas | <https://www.ultrafractal.com/help/writing/formulas/fractalformulas.html> |
| Coloring algorithms | <https://www.ultrafractal.com/help/writing/formulas/coloringalgorithms.html> |
| Transformations | <https://www.ultrafractal.com/help/writing/formulas/transformations.html> |

Do not infer signatures, overloads, return types, or members from a name-only
catalog entry. Open the corresponding official reference.

## Local manual map

The private UF6 manual is text-searchable. Useful PDF page topics include:

| Pages | Topics |
|---|---|
| 230-245 | Formula language, files, sections, expressions, types, variables, parameters, arrays, control flow, and functions |
| 246-261 | Classes, visibility, inheritance, fields, methods, plug-ins, imports, and memory |
| 262-268 | Transformations, fractal formulas, coloring algorithms, direct coloring, global sections, and images |
| 269-278 | Randomness, symmetry, switch, perturbation, help, debugging, optimization, compatibility, and execution sequence |

The manual introduction says the compiler reference is excluded. Use official
online help for complete built-in and compiler-reference semantics.

## Repository map

- `src/catalog/uf6.ts`: UF6 names, section orders, settings, and official URLs.
- `docs/language-catalog.md`: catalog scope and version policy.
- `docs/legacy-syntax.md`: accepted compatibility constructs.
- `docs/diagnostics.md`: analyzer contract and stable `UF` identifiers.
- `docs/corpus-validation.md`: corpus limitations, encoding, and privacy.
- `snippets/ultra-fractal.code-snippets`: plausible minimal skeletons, not
  compiler proof.
- `syntaxes/ultra-fractal.tmLanguage.json`: lexical recognition, not semantic
  validation.

The analyzer checks structure only. It cannot guarantee compilation, resolve
types or overloads, validate every class member, predict runtime behavior, or
predict a rendered image.

Language provenance and algorithm validation are separate. Official UF6
documentation can establish what a construct means without establishing that a
new algorithm uses it correctly. Conversely, an independent numerical
calculation can support the mathematics without establishing that UF6 accepts
the source.

## Unknown-symbol protocol

For an unfamiliar built-in, class, member, setting, or section:

1. Search the versioned catalog and repository notes.
2. Search the manual by topic and page.
3. Consult the exact official UF6 reference page.
4. Inspect an explicit import or at most three corpus examples if useful.
5. If unresolved, report it as unknown and request source or compiler output.

Never fill an evidence gap from analogy with another language or UF version.
