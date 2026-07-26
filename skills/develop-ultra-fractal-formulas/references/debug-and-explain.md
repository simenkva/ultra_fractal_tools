# Debug and Explain UF6 Source

## Triage in four categories

### Design and algorithm

Establish whether the expected result is creative, mathematically faithful, or
hybrid. For faithful work, compare the governing equation and an independent
reference calculation before assuming the UF source expresses the intended
mathematics. For creative work, distinguish an accidental numerical failure
from an intentional visual departure.

### Structural

Run `scripts/analyze_formula.py` with the actual file type. Address focused
errors before warnings. Preserve stable `UF` identifiers and exact locations.
Remember that a structurally clean file may still fail compilation.

### Compiler and runtime

Request the exact Ultra Fractal message, source filename, line, UF6 build, and
relevant imported files. Keep the compiler wording distinct from analyzer
diagnostics.

Classify the message as:

- syntax or declaration;
- type conversion or overload;
- undefined identifier, class, import, or member;
- invalid section or setting;
- runtime bounds, array, or numerical behavior;
- unresolved.

Verify the implicated construct in official UF6 documentation. Apply a minimal
fix, rerun structural analysis, and ask the user to compile again. Do not infer
success from the proposed fix.

### Visual

Request a render plus formula type, parameter values, location/zoom, maximum
iterations, precision, inside/outside selection, and expected appearance.
Separate:

- observation: what is visible;
- hypothesis: likely algorithmic cause;
- experiment: one controlled change;
- result: what the next render confirms.

A screenshot cannot prove compilation details that are not visible.

## Diagnose malformed source

1. Work from the earliest focused diagnostic; later messages may be recovery
   effects.
2. Check strings and continuations, delimiters, language blocks, directive
   nesting, definition braces, legal sections, and section order.
3. Reduce a complex failure to an original minimal reproducer when possible.
4. Keep legacy warnings separate from definite structural errors.
5. Avoid inventing missing parameter declarations: UF6 permits references
   without matching parameter blocks.

## Explain unfamiliar code

1. Identify file type, entries/classes, imports, and legacy constructs.
2. Describe execution in section order, distinguishing once-per-image,
   per-pixel, iterative, final/output, and default/UI roles only when sourced.
3. Trace important variables from initialization through output or bailout.
4. Explain verified built-ins and predefined symbols; list unresolved calls or
   members separately.
5. Translate the mathematical recurrence or mapping into plain language.
6. Describe each user-facing parameter and interaction.
7. Point out numerical and performance risks as risks, not proven bugs.
8. Do not rewrite unless asked.

When mathematical intent is uncertain, explain the recurrence mechanically and
label any interpretation as an inference. A familiar-looking equation or
attractive render does not prove the author's intended mathematics.

## Compiler-message response format

```text
Message supplied by Ultra Fractal:
<exact text>

Likely category:
<category and evidence>

Proposed minimal change:
<change>

Validation after change:
Design/algorithm: ...
Structural: ...
UF6 compilation: requires rerun
Render: requires rerun if behavior changed
```
