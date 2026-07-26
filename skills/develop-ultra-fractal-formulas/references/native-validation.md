# Manual UF6 Compilation and Render Validation

## Keep the native pass manual and reproducible

Do not automate or control the Ultra Fractal GUI. Give the user a
platform-neutral checklist and accept the resulting compiler text, settings,
and images.

Record:

- Ultra Fractal 6 build and runtime environment;
- source filename and exact entry;
- import/search-path context;
- formula, inside coloring, outside coloring, and transformations selected;
- location, magnification, rotation, and precision;
- maximum iterations and other global render controls;
- all non-default parameters relevant to the result.

## Compile

1. Save or reload every affected source file through the user's normal UF6
   workflow.
2. Select the exact changed entry.
3. Compile with the intended imports and formula search paths available.
4. Copy the complete compiler message exactly, including filename and source
   location.
5. Do not paraphrase the message before preserving the original text.
6. If compilation succeeds, record that the user confirmed it and identify
   the tested entry. Do not generalize success to untested entries.

For a failure, return:

```text
UF6 build/environment:
File and entry:
Exact compiler message:
Relevant source lines:
Imports available:
```

## Exercise runtime behavior

After successful compilation:

1. Test the default parameters.
2. Test representative interior values and meaningful boundaries.
3. Check for runtime messages, non-finite behavior, unexpectedly blank output,
   and excessive render time.
4. For mathematically faithful work, use the same cases and tolerances as the
   independent algorithm check.
5. For creative work, sample enough of the parameter space to identify useful
   and hazardous regions without imposing a fidelity requirement.

Record each tested parameter set. A successful default does not validate the
full range.

## Render and compare

Use a fixed baseline when comparing revisions:

1. Keep the location, precision, iterations, formula selections,
   transformations, coloring algorithms, gradients, and parameters fixed.
2. Render the baseline and the changed version.
3. Label each image with the configuration that produced it.
4. Supply the original image or screenshot rather than only a verbal
   description when appearance matters.
5. Change one controlled variable per follow-up experiment when possible.

For creative work, evaluate whether the image supports the declared artistic
goal and whether parameters produce controllable variation. For faithful work,
use the render as a behavior check, not proof that the implemented mathematics
is correct.

## Report the native result

Keep these outcomes separate:

```text
UF6 compilation/runtime: user-confirmed | failed with supplied message | not tested
Render: reviewed | rendered but not reviewed | not supplied
Tested entry and configuration: ...
Observed result: ...
Next controlled experiment: ...
```

A screenshot cannot establish hidden compiler details. A copied compiler
message cannot establish visual quality. Preserve that boundary in every
debugging pass.
