# Тортуфа — сладкий журнал

A web magazine for the Ufa confectionery **«Уфа Десерт»** (ООО «Компания Дионис»,
[tortufa.ru](https://tortufa.ru)). Its one idea: **you click a cake and see what is inside.**

Static site. No framework, no build step, no runtime dependencies — open `index.html`
through any web server and it runs.

---

## What it does

**Разрез — the cross-section.** Every cake is drawn from its real recipe. The workshop's
own product descriptions list the components in order (*«Ванильный бисквит, воздушный
крем-чиз, лимонный конфитюр, хрустящая меренга…»*), and a Russian confectionery lexicon
turns each phrase into a layer with a colour and a texture. Nothing is invented: the
sponges, creams, confitures and crunch you see are the ones the pastry chefs wrote down.

- **`js/section.js`** — an annotated SVG slice. Crumb-textured sponge, jam squashed out
  at the edges, glaze rolling over the crust, fruit pieces suspended in the filling, and
  magazine leader lines to every component. Hover a layer, it names itself.
- **`js/cake3d.js`** — the same stack as a spinnable 3D cake, painted on a plain canvas.
  Each angular strip is shaded by its own surface normal, which is what makes a flat
  canvas read as round. Drag to turn it; click and a wedge cuts out, exposing two radial
  faces and landing the slice on the plate beside it. No WebGL, no libraries.

**Карта — the delivery map.** Real administrative outlines of Ufa and its seven city
districts, straight from OpenStreetMap, projected to flat SVG at build time. Districts
are tinted by delivery zone, neighbourhoods are pinned at their true coordinates, and
every price is the one the workshop publishes. No tile server, no map library, no key.

**Конструктор — build your own.** The ingredient palette is walked out of the catalogue,
so you can only pick components the workshop actually uses, and `js/recipe.js` stacks
them with the same rules the catalogue parser uses. The price is a range derived from
what comparable cakes really cost per kilo, and it says so.

**Витрина** — all 158 catalogue positions with filters, search, sort and price-per-kilo.
**Корзина** — a basket in `localStorage` that composes a ready-to-send order for
WhatsApp, the phone or the clipboard (there is no checkout backend).

Mobile is first-class throughout: the lab puts the cake above the picker, the
cross-section swaps leader lines for a tappable legend, the map keeps its labels crisp
because they are HTML on top of the SVG rather than text inside it.

---

> **Новая сессия?** Начните с [NOTES/03-START-HERE.md](NOTES/03-START-HERE.md) –
> где что лежит, как запустить, что уже сделано и чего делать нельзя.

## Layout

```
index.html        the cover — hero cake, разрез недели, витрина, ₽/kg, map teaser
razrez.html       the lab: pick anything with an interior, spin it, cut it
catalog.html      all 158 positions, filterable
konstruktor.html  build your own cake: pick components, watch it stack in 3D
tort.html?c=slug  one product: photo, 3D, cross-section, taste profile, neighbours
karta.html        the delivery map
basket.html       the order
about.html        the workshop, the catalogue in numbers, a layer glossary

css/main.css        tokens, reset, type, header, buttons
css/components.css  cards, cross-section, 3D stage, sheet, footer
css/pages.css       page-level blocks

js/app.js         shared shell: data, header/footer, theme, basket, cards, the reveal
js/section.js     the annotated SVG cross-section
js/cake3d.js      the spinnable, cuttable 3D cake
js/map.js         the delivery map
js/recipe.js      the assembly rules the constructor and the parser share
js/page-*.js      one module per page

data/catalog.json the 158 products with layer stacks, tags, taste profiles
data/cakes.json   just the cakes
data/ufa.json     districts, zones, pins, delivery rules
data/raw-*.json   untouched scrape, kept so the build is reproducible

tools/            the build pipeline (below)
NOTES/            working notes, decisions, what is left
```

## Rebuilding the data

```bash
node tools/scrape.mjs      # pull the live catalogue (WooCommerce Store API)
node tools/build-data.mjs  # parse layers, weights, tags, taste profiles
node tools/build-map.mjs   # Ufa + districts from OpenStreetMap (Nominatim)
node tools/build-zones.mjs # geocode the delivery neighbourhoods
node tools/serve.mjs       # http://localhost:4173
```

`build-map.mjs` and `build-zones.mjs` hit OpenStreetMap and are rate-limited to one
request a second — run them only when the geography changes. `data/ufa.json` is
committed, so a normal checkout needs nothing.

## Deploying

Any static host. The repo ships `.nojekyll` for GitHub Pages and `vercel.json` for
Vercel; both serve the root directory as-is.

## Where the content comes from

Product names, prices, weights, compositions and photographs belong to «Уфа Десерт» and
are read from the public WooCommerce Store API of tortufa.ru. Delivery zones and prices
are quoted from [tortufa.ru/oplata_dostavka](https://tortufa.ru/oplata_dostavka/).
District boundaries are © OpenStreetMap contributors, ODbL.
