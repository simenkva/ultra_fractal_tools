# Changelog

This file records user-visible changes to Ultra Fractal Language Support.

## 0.2.0 - 2026-07-26

### Added

- A Codex skill for designing, explaining, debugging, and reviewing UF6
  formulas while separating structural, mathematical, compiler, and visual
  validation.
- A command-line structural analyzer with text and JSON output, import search
  paths, and stable `UF` diagnostic identifiers.
- Bundle validation for related formula files, including duplicate-entry and
  expected-entry-type checks.
- Deterministic, bounded helpers for searching a private local UF6 manual and
  formula corpus without packaging or redistributing either source.

### Fixed

- Ordinary identifiers in executable expressions and `switch` assignments now
  receive a variable TextMate scope instead of falling through to unscoped grey
  text.

### Notes

The Codex skill, command-line analyzer, and private-reference helpers are
repository development tools; they are not installed by the VSIX. Structural
analysis still does not replace the Ultra Fractal compiler, mathematical
validation, or rendered-image evaluation.

## 0.1.0 - 2026-07-20

### Added

- Syntax highlighting for `.ufm`, `.ucl`, `.uxf`, and `.ulb` source files.
- Comment toggling, indentation, folding, Outline symbols, and seven snippets.
- Conservative structural diagnostics with stable rule identifiers and
  configurable severities.
- Quoted-import links and definition navigation with configurable search paths.
- Cancellable worker analysis and diagnostic caching for large formula files.
- MIT licensing for source and packaged releases.

### Notes

Structural diagnostics do not replace the Ultra Fractal compiler. Version
0.1.0 does not perform full type checking, overload resolution, class
inheritance analysis, or formula execution.
