# Stability, locking, and chaos: a circle-map Lyapunov plane in Ultra Fractal

Most Ultra Fractal parameter planes answer an escape-time question: does an orbit remain bounded, and how quickly does it leave if it does not? The circle map asks for a different calculation. Its state always lives on a circle. Nothing escapes. What changes across the parameter plane is the long-term stability of the orbit.

That makes the Lyapunov exponent a natural quantity to draw. Negative values point to attraction, values near zero occur in neutral or quasiperiodic motion, and positive values usually signal sensitive, chaotic behavior. The resulting image contains broad stability regions, thin boundaries, and complicated areas where a finite iteration count matters.

The Ultra Fractal implementation comes as a pair:

- [`circle_map_lyapunov.ufm`](circle_map_lyapunov.ufm) performs the orbit and Lyapunov calculation;
- [`circle_map_lyapunov.ucl`](circle_map_lyapunov.ucl) colors the signed result.

Separating those jobs is useful. The formula calculates a number; the coloring decides how that number should look.

## The map behind the picture

The formula uses the sine-circle map

$$
\theta_{k+1}
=\theta_k+\Omega-\frac{K}{2\pi}\sin(2\pi\theta_k)
\pmod 1.
$$

The phase $\theta$ is reduced modulo one after every step. $\Omega$ is the bare rotation number, and $K$ controls the nonlinear sine term. In the UF parameter plane, $\Omega$ is taken from `real(#pixel)`, while $K$ is taken from `imag(#pixel)`.

Some books and papers put a plus sign in front of the sine term. A half-turn of the phase relates the two sign conventions, so this does not define a substantially different family.

For $0\leq K<1$, the map is invertible and orientation-preserving. At $K=1$, its derivative can reach zero. For $K>1$, the map folds and multistability or chaotic behavior becomes possible. This is why the default view extends through the region above $K=1$.

Circle maps are well known for mode locking. Over parameter intervals, the average rotation number stays fixed at a rational value. In a two-parameter view these locked regions form tongues. A Lyapunov plot does not label the rotation number, but it makes many of the stable regions conspicuous because an attracting orbit has a negative exponent.

## Calculating the exponent

Differentiating the map with respect to the phase gives

$$
f'(\theta)=1-K\cos(2\pi\theta).
$$

For one orbit, the finite-time Lyapunov estimate is

$$
\lambda_N=
\frac{1}{N}
\sum_{k=0}^{N-1}
\log\left|1-K\cos(2\pi\theta_k)\right|.
$$

The word *finite-time* deserves to stay in the description. UF uses a finite maximum iteration count, so the image shows an estimate, not an infinite limiting value. Near $\lambda=0$, more iterations or a longer discarded transient can alter the classification of individual pixels.

The formula first runs a user-selected number of transient iterations without adding them to the sum. This gives the orbit time to approach its eventual behavior. After the transient, it accumulates the logarithms and divides by the number of samples collected so far.

There is a small UF-specific trap here. UF6 defines `log(0)` as zero. Mathematically, the logarithm of an exactly zero derivative should tend to negative infinity. The formula therefore replaces a derivative magnitude below `Derivative floor` by that small positive floor before taking the logarithm. With the default $10^{-30}$, a critical iterate contributes a large negative value instead of a misleading zero.

Periodicity checking is disabled as well. A repeating orbit is precisely the sort of behavior the formula is meant to measure. If UF stopped it during the discarded transient, there might be no Lyapunov samples at all.

## Passing a real number to a coloring formula

UF fractal formulas expose their final `z` value to coloring algorithms as `#z`. The circle-map formula uses that channel deliberately:

$$
z=\theta+i\lambda.
$$

The real part keeps the current phase. The imaginary part holds the running Lyapunov estimate. The companion coloring reads `imag(#z)` in its `final` section.

All points remain in the formula until Maximum Iterations, so they are treated as inside points. Select `Circle Map Lyapunov` as the **Inside** coloring algorithm. The outside coloring is not used.

The supplied color scheme is direct rather than gradient-based:

- negative exponents move from light gray toward blue;
- values within the zero tolerance stay light gray;
- positive exponents move toward red.

Color strength follows a smooth exponential response. `Exponent contrast` controls how quickly it approaches the stable or chaotic color. `Zero tolerance` controls the width of the neutral band.

This coloring is not part of the mathematics. Blue and red can be replaced freely without changing the exponent. Even the neutral threshold is a display choice applied to a finite-time estimate.

<!-- IMAGE NEEDED: Supply an unedited UF6 PNG. Record the view, magnification, maximum iterations, initial phase, transient, derivative floor, zero tolerance, contrast, and colors. -->
![Circle-map Lyapunov parameter plane](circle-map-lyapunov-plane.png)

*Suggested figure: the default $(\Omega,K)$ parameter plane, with blue for negative exponents, gray near zero, and red for positive exponents.*

## Loading and using the pair in UF6

Keep the `.ufm` and `.ucl` files in formula folders known to Ultra Fractal, then refresh the formula lists if necessary.

Choose `Circle Map Lyapunov Parameter Plane` as the fractal formula. In the Inside tab, choose the direct coloring algorithm titled `Circle Map Lyapunov`. The formula defaults to 2,000 maximum iterations and discards the first 500. Maximum Iterations must be greater than `Discarded transient`; otherwise no samples are collected and the stored exponent remains zero.

The horizontal coordinate is $\Omega$, and the vertical coordinate is $K$. A sensible first window covers roughly $0\leq\Omega\leq1$ and $0\leq K\leq3$. The formula's default center is $(0.5,1.5)$.

For a first exploration:

1. Leave `Initial phase` at its generic default.
2. Render with the supplied coloring and inspect the region around $K=1$.
3. Increase Maximum Iterations before trusting very fine structures near the gray boundary.
4. Change `Initial phase` and compare. Above $K=1$, coexisting attractors can make the measured exponent seed-dependent.

The last point is easy to overlook. A Lyapunov parameter plane is not always a property of $(\Omega,K)$ alone. It can also describe the attractor reached from the chosen initial phase.

## A few numerical landmarks

Independent test calculations used the formula's default initial phase, a 500-step transient, and 2,000 total iterations.

| Parameters | Expected behavior | Finite-time exponent |
|---|---|---:|
| $K=0$ | Rigid rotation; derivative is one | $0.000000000$ |
| $\Omega=0,\ K=0.5$ | Attracting fixed point | $-0.693147181$ |
| $\Omega=0.5,\ K=2$ | Representative chaotic orbit | $+0.365802300$ |

These are checks on the recurrence and its derivative, not universal labels for every nearby point. The chaotic example in particular depends on its orbit and numerical settings.

A source analyzer also found the fractal and coloring entries with no structural errors or warnings, and a related-file check reported no bundle advisories. Structural success means sections, parameters, and references look consistent to the analyzer. It does not mean the UF6 compiler has been imitated.

In this project there is stronger native evidence. After trying the files in Ultra Fractal, the formula author described both the formula and its coloring as “perfect.” The publication image and its exact render settings are still needed for a visual record.

## What Codex contributed

The research and implementation were assisted by Codex. For a UF user, the simplest description is “an AI coding assistant that can read and write formula source.” It was guided by a local skill called `develop-ultra-fractal-formulas`.

Here, *skill* has a specific and fairly modest meaning. It is a set of working instructions, UF6 references, checklists, and source-analysis tools. It reminds Codex about details such as the special behavior of `log(0)`, the role of `#z`, the distinction between inside and outside coloring, and the need to keep mathematical, structural, native, and visual checks separate. The skill is not loaded by Ultra Fractal and has no effect when the formula runs.

Codex researched the map, derived the update and derivative used in the source, wrote the `.ufm` and `.ucl` pair, and ran independent numerical checks. The human user opened the result in UF6 and judged its behavior. Codex has not seen the final render because the PNG has not yet been supplied.

That division of labor is worth recording. AI assistance can reduce the distance between an equation and a testable UF formula, but it does not turn a parser result into a native compile, or a numerical spot check into a good image.

## Reading the finished image carefully

The direct colors make the main interpretation easy, but the gray band is not a proof of quasiperiodicity. It means only that the estimated exponent lies within the selected tolerance of zero. A longer run may resolve some gray pixels as weakly stable or weakly unstable.

Likewise, a positive exponent usually suggests chaos, but an initial phase placed exactly on an unstable periodic orbit can also give a positive value. The default phase avoids obvious symmetry points, not every exceptional orbit.

Those cautions do not make the plot less useful. They tell us what it is: a configurable numerical view of stability across a two-parameter family. The image becomes more informative when the caption includes the transient, iteration count, initial phase, and color tolerance.

## Further reading

- M. H. Jensen, P. Bak, and T. Bohr, “Transition to chaos by interaction of resonances in dissipative systems. I. Circle maps,” *Physical Review A* 30, 1960–1969 (1984). [https://doi.org/10.1103/PhysRevA.30.1960](https://doi.org/10.1103/PhysRevA.30.1960)
- J. C. Bastos de Figueiredo and C. P. Malta, “Lyapunov graph for two-parameters map: Application to the circle map,” *International Journal of Bifurcation and Chaos* 8, 281–293 (1998). [https://doi.org/10.1142/S0218127498000176](https://doi.org/10.1142/S0218127498000176)
- M. Mugnaine, M. R. Sales, J. D. Szezech Jr., and R. L. Viana, “Dynamics, multistability, and crisis analysis of a sine-circle nontwist map,” *Physical Review E* 106, 034203 (2022). [https://doi.org/10.1103/PhysRevE.106.034203](https://doi.org/10.1103/PhysRevE.106.034203)
- [Ultra Fractal help: direct coloring algorithms](https://www.ultrafractal.com/help/writing/formulas/directcoloringalgorithms.html)
- [Ultra Fractal help: the `#z` predefined symbol](https://www.ultrafractal.com/help/writing/reference/predefined/z.html)
- [Ultra Fractal help: the `log` function](https://www.ultrafractal.com/help/writing/reference/functions/log.html)
