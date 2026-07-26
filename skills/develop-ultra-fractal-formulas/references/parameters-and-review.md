# Parameters and Formula Review

Contents: [parameter design](#design-user-facing-parameters),
[readability](#readability-review), [numerical behavior](#numerical-review),
[performance](#likely-performance-review), and [review output](#review-output).

## Design user-facing parameters

For each parameter, decide:

- stable internal name and user-facing caption;
- verified UF6 type;
- default that produces a useful, finite result;
- minimum and maximum when a meaningful safe range exists;
- enumeration when choices are discrete;
- hint describing effect, units, and risk;
- visibility or enabled condition only when the setting is documented;
- order and grouping in the UI.

Prefer a small set of orthogonal controls. Avoid exposing implementation
details that users cannot interpret. Preserve existing names and order when
modifying source.

Check defaults at boundaries and representative interior values. Treat a range
as a user-interface constraint, not proof that every value is numerically safe.
Do not write to parameters in new code without a compelling, documented
compatibility reason.

Match the parameter goal to the design intent:

- For creative work, favor expressive coverage, controllable variation, and a
  stable default. It is acceptable to expose surprising or unstable regions
  when the hint makes the risk clear.
- For mathematically faithful work, use meaningful domains, units, and defaults
  tied to the reference problem.
- For hybrid work, distinguish controls that change the mathematical kernel
  from controls that change its visual presentation.

## Readability review

- Confirm entry, class, function, variable, and parameter names communicate
  their roles.
- Keep equations close to their explanatory comments.
- Distinguish coordinates, state, accumulators, and outputs.
- Remove dead branches only after compiler/render equivalence.
- Make section responsibilities clear.
- Keep comments about intent and mathematical assumptions, not obvious syntax.
- Ensure captions, hints, defaults, and ranges agree.
- Avoid unexplained constants; name them or explain their derivation.

## Numerical review

Inspect:

- denominators near zero;
- `log`, roots, inverse, and other functions near invalid or branch-sensitive
  inputs;
- overflow, underflow, NaN, and infinity propagation;
- bailout direction and threshold;
- convergence/divergence assumptions;
- comparisons at exact boundaries;
- uninitialized static arrays and out-of-range indices;
- dynamic-array sizing and copying;
- maximum-iteration edge cases;
- precision loss during deep zooms;
- perturbation equations that leave large uncancelled terms;
- random seeds and reproducibility.

Recommend guards only when they preserve the declared intent. State when a
guard changes defined mathematics. In creative work, a clamp or discontinuity
may be an intentional design operation; name and explain it rather than
presenting it as mathematically neutral.

## Likely performance review

Look for work repeated per iteration or per pixel that could be performed less
often, including:

- invariant calculations;
- repeated transcendental or complex operations;
- object or dynamic-array allocation;
- linear scans inside iteration loops;
- unnecessary copies;
- diagnostic printing or debug directives;
- parameter writes that inhibit compiler optimization;
- missed symmetry or verified perturbation opportunities.

Do not micro-optimize from folklore. UF6 performs constant-expression and
operation optimizations. Prefer clear mathematics until a compiler/render
timing demonstrates a useful change.

## Review output

Group findings as:

1. definite structural issue;
2. source-backed semantic concern;
3. algorithmic-fidelity concern, when fidelity is a goal;
4. numerical risk;
5. likely performance concern;
6. readability or API suggestion;
7. compiler or render experiment needed.

Give each finding a source location, impact, evidence level, and smallest
reasonable next action.
