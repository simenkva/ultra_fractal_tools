# Changelog

This file records user-visible changes to Ultra Fractal Language Support.

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
