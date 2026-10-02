# How it is built, and why

## The one decision everything follows from

The brief was "click a cake and see how it looks inside". The tempting version is to draw
a pretty generic cake. The honest version is to show *this* cake's interior — and that
turned out to be possible, because the workshop already writes the recipe into every
product description:

> Вес: 1100 гр. Ванильный бисквит, воздушный крем-чиз, лимонный конфитюр, хрустящая
> меренга. Сверху торт покрыт взбитыми сливками и изящной белой глазурью.

So the whole project hangs on a parser. `tools/lexicon.mjs` is a list of ~90 Russian
confectionery phrases, each mapped to a layer kind (`sponge` / `cream` / `fill` / `top` /
`crunch`), a colour and a texture. `tools/build-data.mjs` finds every non-overlapping
match in order, then assembles a believable stack: sponge, cream, filling, sponge, …,
frosting, glaze. The layer count comes from an explicit statement ("3 вида бисквита") or
from the weight. That single stack drives both renderers.

### The trap that cost the most time

**`\w` and `\b` in JavaScript are ASCII-only.** `/ванильн\w+ бисквит/` silently matches
nothing in Cyrillic, so every cake came out as a generic "Бисквит". The fix is the `cyr()`
helper in `build-data.mjs`, which rewrites `\w` → `[а-яёa-z0-9]` and `\b` into a
lookaround pair before compiling any lexicon pattern. Any new pattern must go through it.

### The second trap

Savoury bakes share vocabulary with cakes: a вак-беляш is "сдобно-песочное тесто,
картошка, фарш мясной" and the parser happily gave it a cream diagram. `cuttable()` in
`build-data.mjs` excludes pies, bread, dough and semi-finished goods by category and by
savoury keywords. 75 of 158 positions end up with an interior; all 42 cakes do.

## The two renderers

**`js/section.js` — the flat cross-section.** SVG, one band per layer, bottom-first in the
data and reversed on screen. Jam and cream bands get wavy edges (they squash), sponge gets
a displacement filter plus air pockets, nuts and meringue get drawn as shapes, fruit named
in the filling appears as coloured pieces inside the jam. Labels are laid out with a small
push-apart pass so leader lines never collide. Below 720px the leader lines are replaced by
a tappable legend.

**`js/cake3d.js` — the 3D cake.** A painter, not a 3D engine. The cake is a stack of
cylinders in axonometric projection; the circle is cut into 108 angular strips, only
front-facing ones are drawn, sorted far-to-near, each shaded by `normal · light`. Strips
overlap by a third of a step because butt-joined quads leave hairline seams. Cutting
removes an angular range from the wall and draws the two radial faces inside the notch;
when the notch spins to the back the faces are skipped and the cake reads as whole, which
is also physically correct. The removed wedge is drawn separately on the plate.

**`js/cake-gl.js` — the lit cake.** The same contract as `cake3d.js` (constructor,
`setItem`, `toggleCut`, `setFocus`, `destroy`, the `cake:layer` event) in WebGL, used on
the cover and in the app. What it changes is the outside: a real cake shows its layers
only where it is cut. Trailing `обмазка`/`покрытие` layers become the coat, with real
radial thickness, and the sides wear them; a cake with no coat stays naked and shows its
stripes. Glaze poured over frosting stays on top and drips; glazed straight onto sponge,
it covers the sides. Geometry is hand-built in cake-local coordinates (x = r·sinθ,
z = r·cosθ, three's own cylinder convention) as two groups, body and slice, which share
their cut faces, so the whole cake is seamless and cutting just slides the slice out.
Piping, berries and an inscription exist only as options: the catalogue never says a
cake has roses, so the cover never shows any. The inscription is a canvas texture on an
overlay with planar uv over the whole top, which is why it splits cleanly when cut.

Three.js is not loaded from a CDN. `tools/three-entry.mjs` lists the classes in use and
`npm run vendor` bundles just those into `js/vendor/three.min.js` (~140 KB gzipped). A new
class in `cake-gl.js` means a new name there and a rebuild, or the import is `undefined`.
Pages load `cake-gl.js` with a dynamic import and keep `cake3d.js` as the fallback; the
cover paints the flat cake first and swaps only after the WebGL one has drawn a frame.

## Animation has to be fail-safe

The staged reveal of the layers originally used a CSS animation with `fill: both` and a
delay. That leaves elements at `opacity: 0` whenever the animation does not actually run —
a throttled background tab, a headless capture, a compositor that never ticks. It is now
the Web Animations API with a `setTimeout` that cancels any animation still unfinished
after 1.8s; cancelling returns the element to its own style, which is visible. Same idea
behind `.js [data-rise]`: the hidden state only applies once the script that reveals it is
alive, plus a 4s fallback that reveals everything regardless.

**Rule for this codebase: never let an element's only path to being visible run through an
animation.**

## The map

`tools/build-map.mjs` asks Nominatim for Ufa and its seven districts with
`polygon_geojson=1`, simplifies the rings with Ramer–Douglas–Peucker (ε ≈ 0.0011°),
projects them equirectangularly with the cosine correction for 54.7°N, and writes SVG path
strings plus label centroids. `tools/build-zones.mjs` geocodes the delivery neighbourhoods
and projects them through the same transform, so pins land where the places really are.

District labels and pins are **HTML positioned over** the SVG, not `<text>` inside it —
that is what keeps them crisp and tappable at every size, and it is why `map.js` needs the
viewBox origin (`VX`/`VY`) to convert user units to percentages.

A pin is a zero-size anchor exactly on its place; the dot centres on it and the label
hangs off one of eight sides. `layoutPins()` measures every side once, then picks per
pin the side that touches no other label, dot or frame edge (greedy, then a few passes of
every pin reconsidering), with a second ring a step further out plus a hairline back to
the dot for when the city is too tight. District names are placed after, around the pins,
and may only drift to a spot still inside their own district. Both rerun on resize and
after the webfont lands; the first run is synchronous, because the cover keeps the main
thread busy for a second and labels would sit piled up until it frees.

Ufa's city relation trails a long southern tail; the viewBox deliberately stays at
`0 0 1000 1520` (the full city) and `.umap__svg` clips with `overflow: hidden`.

## Product photos

The site does not hotlink tortufa.ru. `tools/fetch-images.mjs` downloads each product's
original photo and writes `assets/products/<slug>-600.webp` (cards) and `-1200.webp`
(the cake page), recording the source URL in `assets/products/sources.json`. On a rerun
a product is fetched again only if its photo URL changed; products that left the
catalogue lose their files. `build-data.mjs` emits local paths only when the manifest's
source matches the product's current photo, and otherwise falls back to the shop's URL
with a warning, so a stale fetch never shows the wrong cake.

## Conventions

- Data is built once and committed. Pages only read JSON; nothing parses at runtime.
- Every page is `<link>` + one `type="module"` script. `shell()` injects header, drawer,
  footer, theme and basket.
- One berry accent, cream paper, Playfair Display + Inter. Dark theme is a token swap and
  follows the OS unless the toggle overrides it.
- Mobile first: every block is written small-screen up, then widened with `min-width`.
