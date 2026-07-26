---
name: develop-ultra-fractal-formulas
description: Develop, explain, debug, refactor, and review Ultra Fractal 6 source, including fractal formulas (.ufm), coloring algorithms (.ucl), transformations (.uxf), and classes or plug-in libraries (.ulb). Use for creative or mathematically faithful formula design, user-facing parameters, structural diagnostics, compiler-message triage, legacy modernization, related-file bundles, imports and plug-ins, numerical risks, performance review, or rendered-image feedback.
---

# Develop Ultra Fractal Formulas

Target Ultra Fractal 6 explicitly. Treat later versions as separate and
unverified unless the user supplies version-specific evidence.

## Establish the design intent

Classify substantial design work before choosing its validation burden:

- **Creative**: Optimize for interesting, controllable visual behavior.
  Mathematical fidelity is optional. Check numerical robustness, parameter
  behavior, compilation, and renders without turning the task into a proof
  obligation.
- **Mathematically faithful**: Implement a stated map, estimator, or algorithm
  accurately. Require independent numerical checks appropriate to the claim.
- **Hybrid**: Keep a source-backed or numerically checked mathematical core
  separate from intentional artistic mappings, distortions, or coloring.

Infer the intent when it is clear. Ask only when the distinction would change
the implementation. Allow the intent to change during exploration, and label
intentional departures from canonical mathematics instead of treating them as
errors.

## Keep four validation categories separate

1. **Design and algorithm validation**: Check the declared goal. For faithful
   work, use independent calculations, known cases, invariants, convergence, or
   stated tolerances. For creative work, use exploratory probes and robustness
   checks; `mathematical fidelity was not a design goal` is a valid result.
2. **Structural validation**: Use this repository's analyzer for strings,
   delimiters, blocks, directives, definitions, sections, parameters, and
   conservatively resolved imports.
3. **Compilation and runtime validation**: Require Ultra Fractal 6 for types,
   overloads, class resolution, compiler rules, and runtime behavior.
4. **Visual validation**: Require rendered images plus parameter and location
   context to evaluate appearance.

Never use one category as proof of another. Never call a formula compiled,
working, mathematically verified, or visually correct after structural
analysis alone. Never present untested code as known-working code.

Read [design-and-validation.md](references/design-and-validation.md) for
faithful mathematics, creative exploration, hybrid designs, or numerical test
design.

## Follow the evidence hierarchy

Use evidence in this order:

1. UF6 manual and official Ultra Fractal documentation.
2. The repository's versioned UF6 catalog and language notes.
3. A small number of private local corpus examples as observations of usage.
4. Original reasoning for the requested design.

For unfamiliar or uncertain language constructs, read
[evidence-map.md](references/evidence-map.md). Label uncertain claims as
`official`, `repository-verified`, `corpus-observed`, or `design inference`.
Do not invent a built-in, section, setting, class, member, overload, or
compiler behavior. If the evidence does not resolve a claim, say so and
request the imported source, official help, or compiler result.

Do not require an evidence-map or corpus search for a small self-contained
formula that uses familiar, repository-verified constructs.

## Choose the fast or full path

Use the fast path only for one self-contained `.ufm`, `.ucl`, or `.uxf` that
uses familiar verified constructs, has no imports or classes, has no legacy
ambiguity, and does not make a nontrivial mathematical-fidelity claim:

1. State or infer the design intent.
2. Make the smallest coherent change or formula.
3. Check relevant defaults and numerical hazards.
4. Run structural validation after executable or structural changes and once
   before handoff.
5. Report compilation and rendering as untested unless supplied.

Use the full path for unfamiliar constructs, faithful mathematical claims,
legacy syntax, classes, imports, plug-ins, related-file bundles, compiler
messages, or significant numerical and performance risks.

Read only the task references that apply, completely, before acting:

- [create-and-modify.md](references/create-and-modify.md) for creation,
  extension, or refactoring.
- [debug-and-explain.md](references/debug-and-explain.md) for source
  diagnostics, compiler messages, explanations, or screenshots.
- [parameters-and-review.md](references/parameters-and-review.md) for
  parameters, readability, numerical behavior, or likely performance.
- [legacy-classes-plugins.md](references/legacy-classes-plugins.md) for legacy
  syntax, classes, imports, inheritance, or plug-ins.
- [bundles.md](references/bundles.md) for related `.ufm`, `.ucl`, `.uxf`, or
  `.ulb` files.
- [native-validation.md](references/native-validation.md) for a reproducible,
  manual UF6 compile and render pass.

## Use the core workflow

1. Determine the source type, design intent, and intended visual or
   mathematical behavior.
2. Ask only for missing constraints that change the implementation. State safe
   assumptions for details that do not.
3. Choose the fast or full path and consult only the evidence needed.
4. Build or isolate the smallest testable formula first.
5. Use clear names and expose useful parameters with justified defaults and
   bounds.
6. Perform design or algorithm validation appropriate to the declared intent.
7. Run structural validation after changes to executable statements, sections,
   parameter declarations, imports, directives, blocks, or delimiters.
8. Defer revalidation after comment, caption, hint, or prose-only edits, but
   always run one final structural check before handoff.
9. Explain the algorithm, execution sections, parameters, intentional creative
   choices, and expected behavior.
10. List everything still requiring the UF6 compiler, runtime, or a render.
11. Incorporate exact compiler messages or screenshots in the next pass and
    repeat only the affected validation categories.

## Run deterministic helpers

Resolve the skill directory from the loaded `SKILL.md`; do not hard-code a
user-specific path.

Run structural analysis:

```sh
python3 scripts/analyze_formula.py --format json path/to/formula.ufm
```

Pass multiple related files to analyze them in one invocation. Use
`--imports exhaustive` only when all Ultra Fractal search roots are known.
Add each root with `--search-path`; keep imports unchecked otherwise. Run
`python3 scripts/analyze_formula.py --help` for wrapper and analyzer options.

Check a related-file bundle and optional expectations:

```sh
python3 scripts/check_bundle.py --format json \
  path/to/formula.ufm path/to/coloring.ucl
```

Read [bundles.md](references/bundles.md) before using a bundle manifest or
interpreting `UFB` advisories.

Search the private manual without loading it into model context:

```sh
python3 scripts/search_manual.py "parameter settings" --max-results 5
```

Find a few corpus examples by metadata before inspecting any excerpt:

```sh
python3 scripts/find_corpus_examples.py \
  --type ucl --feature direct-coloring --feature parameters --limit 3
```

Use `--excerpt` only when metadata is insufficient. Treat any excerpt as
private research material: do not reproduce it or make a rename-only
adaptation.

The helpers accept explicit `--repo`, `--manual`, and `--corpus` paths. They
also recognize `ULTRA_FRACTAL_TOOLS_ROOT`, `ULTRA_FRACTAL_MANUAL`, and
`ULTRA_FRACTAL_CORPUS`. Do not search unrelated user directories.

## Report results honestly

End substantial source-writing and debugging work with:

```text
Target: Ultra Fractal 6
Design intent: creative | mathematically faithful | hybrid
Design/algorithm check: reference-tested | exploratory checks | not a fidelity goal | not run
Structural check: passed | failed | not run
UF6 compilation/runtime: user-confirmed | failed with supplied message | not tested
Render check: reviewed | rendered but not reviewed | not supplied
Evidence used: official | repository-verified | corpus-observed | design inference
Remaining uncertainties: ...
Next test: ...
```

Compress this report for fast-path tasks without collapsing the categories.
Report analyzer diagnostics with path, one-based line and column, severity,
stable `UF` identifier, and message. Report bundle conventions with their
separate `UFB` identifiers. Do not assign `UF` identifiers to Ultra Fractal
compiler messages. Do not assign `UFB` identifiers to them either.

## Protect private and third-party source

- Read only the files and roots needed for the task.
- Keep formula source, corpus excerpts, compiler messages, and screenshots
  local unless the user explicitly directs otherwise.
- Do not put private code into web queries.
- Do not bundle the manual, formula corpus, extracted text, caches, local
  absolute paths, compiler logs, or screenshots.
- Generate examples and implementations independently from the requested
  mathematics or behavior.
- Prefer synthetic minimal reproducers when sharing or testing a bug.
