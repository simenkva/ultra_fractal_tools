# Design Intent and Algorithm Validation

Contents: [intent](#choose-the-intent-before-the-burden-of-proof),
[creative](#validate-creative-work), [faithful](#validate-mathematically-faithful-work),
[hybrid](#validate-hybrid-work), [parameters](#design-parameters-by-intent), and
[reporting](#report-algorithmic-status).

## Choose the intent before the burden of proof

Use one of these working modes:

- **Creative**: The goal is exploratory or visual. Mathematical exactness is
  not required unless the user asks for it.
- **Mathematically faithful**: The result is expected to implement a named
  equation, map, estimator, or published technique accurately.
- **Hybrid**: A checked mathematical kernel feeds an intentionally artistic
  mapping, perturbation, coloring, or parameterization.

Infer the mode when the request is explicit. Ask only when the choice changes
the implementation or the claims that can be made. A useful question is:
“Should this reproduce the named mathematics faithfully, or use it as a
starting point for visual exploration?”

Do not describe creative work as less rigorous. Judge it against its declared
goal. Do not use “creative” to conceal an unintended numerical failure or to
make a fidelity claim without evidence.

## Validate creative work

For creative designs:

1. State the visual or behavioral exploration target.
2. Check that the default produces finite, nontrivial state under a small
   independent probe when practical.
3. Sample representative and boundary parameter values.
4. Identify singularities, blank-output regions, explosive iteration costs,
   and intentional discontinuities.
5. Prefer controls that produce distinct, understandable changes.
6. Keep useful surprises when they support the design; document them rather
   than “correcting” them toward a canonical formula.
7. Evaluate appearance only from renders with recorded parameters and view
   context.

Report `mathematical fidelity was not a design goal` when appropriate. Do not
invent a mathematical interpretation after seeing an attractive image.

## Validate mathematically faithful work

Match the validation to the claim:

1. Write the governing equation and map each term to source variables.
2. Build an independent reference calculation outside UF source. Use a
   task-specific temporary Python, JavaScript, spreadsheet, or hand
   calculation rather than reusing the same implementation structure.
3. Select known cases, invariants, limiting behavior, or qualitative regimes.
4. Test convergence with iteration count, step size, transient length, or
   precision when those quantities affect the result.
5. State tolerances and why they are appropriate.
6. Compare representative parameter values, including boundaries and failure
   regimes.
7. Label guards, clamps, smoothing, and remapping that alter the defined
   mathematics.

Examples of useful checks include stable, neutral, and chaotic regimes for an
exponent estimator; a known fixed point for a recurrence; symmetry or
conservation where documented; and convergence as a numerical control is
refined. These are examples, not universal requirements.

A successful independent calculation supports the algorithmic claim only. It
does not prove UF6 compilation or rendering.

## Validate hybrid work

Separate the layers:

1. Identify the mathematical kernel and its inputs and outputs.
2. Validate that kernel as faithfully as the claim requires.
3. Identify every creative transform applied afterward, such as nonlinear
   scaling, clamping, phase shifts, coordinate distortion, banding, or direct
   coloring.
4. Evaluate the creative layer through parameter probes and renders.
5. Report the mathematical and artistic results independently.

If the creative layer feeds back into the recurrence, state that the whole
system is now a new design unless the modified system is also validated.

## Design parameters by intent

For creative work, prioritize expressive coverage, stable defaults, and
discoverable interactions. A range may deliberately include unstable or
surprising regions when the hint explains them.

For faithful work, use meaningful domains, units, and defaults tied to the
reference problem. Do not silently restrict a valid mathematical domain only
because a narrower range renders more attractively.

For hybrid work, distinguish parameters that alter the mathematical kernel
from those that alter presentation.

## Report algorithmic status

Use one of these statuses:

- `reference-tested`: independent cases or calculations passed.
- `exploratory checks`: representative numerical behavior was probed without
  a fidelity claim.
- `not a fidelity goal`: exact mathematical correspondence was intentionally
  outside scope.
- `not run`: no independent algorithm or design check was performed.

Name the cases, tolerances, or sampled ranges behind the status. Never convert
structural, compiler, or visual success into an algorithmic success claim.
