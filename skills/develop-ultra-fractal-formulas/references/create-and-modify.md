# Create and Modify UF6 Source

## Choose the source type

| Type | Purpose | Documented section order |
|---|---|---|
| `.ufm` | Fractal formula | `global`, `builtin`, `init`, `loop`, `bailout`, `perturbinit`, `perturbloop`, `default`, `switch` |
| `.ucl` | Coloring algorithm | `global`, `init`, `loop`, `final`, `default` |
| `.uxf` | Transformation | `global`, `transform`, `default` |
| `.ulb` | Classes and plug-ins | `public`, `protected`, `private`, `default` |

Classes embedded in another supported file still use class visibility
sections. Omit unused sections rather than adding empty ceremony.

## Create from a description

1. Restate the intended equation, mapping, measurement, or color output and
   classify the design as creative, mathematically faithful, or hybrid.
2. Establish material constraints: inside/outside use, gradient index versus
   direct color, coordinate source, bailout or convergence rule, maximum
   iterations, precision/deep zoom needs, and compatibility requirements.
3. Verify every proposed section, predefined symbol, built-in, and setting.
4. Write the smallest source with one entry and the minimal required sections.
5. Use original identifiers and control flow. Do not translate a corpus entry
   line by line.
6. Run structural analysis before adding optional behavior.
7. Add one coherent executable or structural change at a time and revalidate.
   Defer revalidation for comment, caption, hint, or prose-only changes until
   the final check.
8. Perform design or algorithm checks appropriate to the declared intent.
9. Explain section execution, equations, intentional artistic choices,
   parameter effects, and expected qualitative behavior.
10. Mark compilation and rendering as untested until the user supplies results.

For unfamiliar mathematics, derive the algorithm first in plain language or
pseudocode. Then map it to verified UF6 constructs. Require an independent
reference calculation only when mathematical fidelity is part of the claim;
creative use of a mathematical idea may instead use exploratory probes.

## Extend or modify existing source

1. Read the entire affected entry or class and its imports.
2. Record existing public behavior: parameter names, types, defaults, order,
   entry identifiers, class interfaces, and switch relationships.
3. Determine whether the requested change intentionally breaks any of them.
4. Make the smallest coherent change. Preserve names and defaults unless the
   request requires a migration.
5. Avoid opportunistic modernization in the same patch.
6. Preserve or explicitly revise the existing creative, faithful, or hybrid
   intent.
7. Run structural analysis over the complete file after executable or
   structural changes and once before handoff, not only over the changed
   excerpt.
8. Present the behavioral change and any compatibility impact.
9. Request a UF6 compile, then a before/after render using the same location
   and parameters when visual equivalence matters.

## Refactor safely

- Separate behavior-preserving refactoring from mathematical changes.
- Prefer clear local names and small functions when they improve traceability.
- Preserve parameter-block order because it can affect UI order.
- Preserve entry and class identifiers when saved parameter sets or imports
  may refer to them.
- Treat compiler directives as an independent hierarchy.
- Do not replace accepted legacy behavior solely to satisfy style.
- Use compiler and render comparisons to establish equivalence.

## Minimum handoff

Provide the complete changed entry or file when authorized, an algorithm
explanation, a parameter table, structural results, remaining semantic risks,
and exact instructions for the next UF6 compiler or render test.
