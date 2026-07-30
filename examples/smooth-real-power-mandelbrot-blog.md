# Between the Multibrots: a smooth real-power formula for Ultra Fractal

The familiar Multibrot formula

$$
z_{k+1}=z_k^p+c
$$

has no difficulty with $p=2,3,4,\ldots$. Each integer gives a polynomial, so the map is analytic and single-valued. The trouble begins when the power control is allowed to move continuously. Writing $z^p$ with a non-integer $p$ means choosing a branch of the complex logarithm. A branch cut then enters the picture, whether or not it makes an attractive fractal.

For this experiment I wanted something else: a smooth family of real two-dimensional maps that passes exactly through every integer Multibrot. Between those integers it need not be analytic. In fact, the departure from analyticity should be a visible and adjustable part of the formula.

That request became two entries in one Ultra Fractal 6 formula file:

- `SmoothRealPowerMandelbrot`, for the parameter plane;
- `SmoothRealPowerJulia`, for the corresponding dynamical plane.

The two entries support UF's normal Mandelbrot-to-Julia switching. The complete source is in [`smooth_real_power_mandelbrot.ufm`](smooth_real_power_mandelbrot.ufm).

## Choosing an interpolation

There is no canonical answer here. The requirement fixes the maps at integer powers, but it does not say what must happen between them. This is partly a mathematical construction and partly a design decision.

Let

$$
n=\lfloor p\rfloor,\qquad t=p-n.
$$

Thus $n$ is the integer below $p$, while $t$ runs from zero to one. The formula turns $t$ into a blend value with

$$
s(t)=
\frac{\exp(-1/t)}
     {\exp(-1/t)+\exp[-1/(1-t)]},
\qquad 0<t<1.
$$

The endpoint values are $s(0)=0$ and $s(1)=1$. This is a *flat* step: all its derivatives settle to zero at either end. That matters because `floor(p)` changes abruptly at each integer. A plain linear blend would still hit the correct maps, but its dependence on $p$ would have a kink there.

The map used before adding $c$ is

$$
F_p(z)=
(1-s)z^n+s z^{n+1}
+a\,s(1-s)\overline{z^n}.
$$

The first two terms interpolate between adjacent monomials. For any fixed $p$, they are still a polynomial in $z$. The final conjugate term is the real-map bridge. If $a\neq0$, it makes the intermediate map non-holomorphic. Its factor $s(1-s)$ forces it to disappear at both ends of every interval.

At an integer $p=m$, the result is exactly

$$
F_m(z)=z^m.
$$

No approximation is involved. The integer formulas are the usual analytic Multibrots; the unusual behavior lives strictly between them.

The construction is smooth in the real variables $x$, $y$, and $p$, where $z=x+iy$. It is not a definition of the conventional complex power at non-integer $p$, and it should not be presented as one. It is one smooth path through the integer family.

## What the controls do

`Power p` chooses the position in the family. Integer settings recover the ordinary power maps. The interesting territory lies between them, especially around half-integers where the two monomials have equal weight.

`Non-analytic bridge` is the coefficient $a$. At zero, the interpolated map is holomorphic in $z$ for each fixed $p$, although it is still a blend of two integer powers rather than the conventional $z^p$. Increasing the value strengthens the conjugate contribution. It has no effect when `Power p` is an integer.

`Bailout value` uses Ultra Fractal's `|z|`, which is the squared modulus. The default value of 256 therefore corresponds to a radius of 16. This relatively generous bailout is intentional: the intermediate maps are not ordinary monomials, so a radius inherited uncritically from the quadratic Mandelbrot formula would be a weak choice.

There is plenty to explore without changing the source. I would begin at $p=2$, move slowly toward $2.5$, then continue to $3$. First leave the bridge at 1. Next repeat the trip with the bridge at 0. The difference separates the effect of blending adjacent powers from the effect of the explicitly non-analytic term.

<!-- IMAGE NEEDED: Supply an unedited UF6 PNG. Record p, bridge strength, bailout, maximum iterations, location, magnification, and coloring. -->
![A non-integer member of the smooth real-power Mandelbrot family](smooth_real_power_mandelbrot.png)

*Suggested figure: one non-integer parameter plane, preferably with a small comparison at the neighboring integer power. The caption should state the power and bridge strength.*

## The Julia companion and switching

The Julia entry evaluates the same $F_p$, but it starts with `z = #pixel` and adds a fixed `seed` on every iteration:

$$
z_{k+1}=F_p(z_k)+c.
$$

In the Mandelbrot entry, `c` is the pixel and the initial value is zero. In the Julia entry, the pixel is the initial value and `c` is a parameter. That is the usual distinction, even though $F_p$ is not analytic between the integer powers.

The `switch` sections make this practical. Enter Switch mode while using `SmoothRealPowerMandelbrot`, select a point, and UF opens `SmoothRealPowerJulia` with that point copied into `Julia seed`. Power, bridge strength, and bailout go with it. Switching back returns to the parameter-plane entry.

This is ordinary UF formula switching, not a custom user-interface trick. The implementation follows the [UF6 switch feature](https://www.ultrafractal.com/help/writing/formulas/switchfeature.html).

<!-- IMAGE NEEDED: Supply the Julia image reached by switching from the parameter plane. Record the seed as well as all shared parameters and render settings. -->
![The corresponding smooth real-power Julia set](smooth_real_power_julia.png)

*Suggested figure: a Julia rendering reached with Switch mode from the parameter-plane image above.*

## Using the formula in Ultra Fractal 6

Place [`smooth_real_power_mandelbrot.ufm`](smooth_real_power_mandelbrot.ufm) in a formula folder known to UF6, or leave it in `My Formulas` if that is already one of your formula folders. Refresh the formula list if UF is open.

Choose `Smooth Real-Power Mandelbrot` as the fractal formula. It works with normal inside and outside coloring algorithms, so there is no required companion coloring file. Set `Power p` to an integer first. This gives a useful baseline and confirms that the selected coloring behaves as expected. Then move to a non-integer value and adjust `Non-analytic bridge`.

Use Switch mode when you find a parameter-plane location that looks promising. The Julia formula is also available directly under the title `Smooth Real-Power Julia` if you prefer to type the seed.

One practical warning: changing $p$ changes the map, not merely the coloring. A location that is interesting at $p=2.2$ may be empty at $p=2.3$. Small parameter steps and saved locations are your friends.

## How Codex and the UF skill were used

This formula was developed with Codex, an AI coding assistant. The named `develop-ultra-fractal-formulas` skill is not an Ultra Fractal plug-in, and it does not add anything to UF itself. It is a local package of instructions, UF6 references, checklists, and source-inspection tools that guides Codex while it writes or reviews formula files.

In this case, Codex translated the mathematical request into UF source, added the Julia entry and switch sections, and checked the construction with calculations outside UF. The skill prompted a useful classification: this is a hybrid design. Exact agreement at integer powers can be tested mathematically; the choice of path between them is creative.

The same distinction applies to validation:

- An independent calculation checked $p=2,3,4$ at a nontrivial complex value. The formula agreed exactly with direct integer exponentiation in all three tests.
- The blend gave $s(0.5)=0.5$ and settled to its endpoint values at machine precision near zero and one.
- A UF source analyzer found both entries and reported no structural errors or warnings.
- That analyzer is not the Ultra Fractal compiler. Native compilation and the final appearance must be checked in UF6.

Native compilation of the Mandelbrot and Julia entries was not separately documented during this write-up. Codex also did not render the published images, choose the final locations, or decide that a picture was good. Those are UF-side decisions. Any article about an AI-assisted formula should say so plainly; otherwise a source check can too easily be mistaken for a finished visual test.

## Where this could go next

The conjugate bridge is deliberately simple. Other flat terms could be inserted while keeping the same integer anchors. For example, a bridge could respect selected rotational symmetries, or its strength could vary with $|z|$. Those would define different families, not improvements to a unique real-power map.

I like the present version because the bargain is easy to understand. The integer powers remain untouched. Between them, one control governs how strongly the map leaves complex analyticity. That is enough structure to make the experiment reproducible, but enough freedom to produce images that are not just branch-cut versions of $z^p$.

## Further reading

- L. Baribeau and T. Ransford, “Cross-sections of multibrot sets,” *The Journal of Analysis* 24, 95–101 (2016). [https://doi.org/10.1007/s41478-016-0010-9](https://doi.org/10.1007/s41478-016-0010-9)
- [Ultra Fractal help: writing fractal formulas](https://www.ultrafractal.com/help/writing/formulas/fractalformulas.html)
- [Ultra Fractal help: the switch feature](https://www.ultrafractal.com/help/writing/formulas/switchfeature.html)
