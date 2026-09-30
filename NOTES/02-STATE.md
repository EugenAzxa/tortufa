# Where things stand

_Last updated: 30 September 2026._

## Done and working

| Page | State |
|---|---|
| `index.html` | Cover, 3D hero cake (random pick from the most layered ones), «Разрез недели» with the annotated cross-section, filterable cake grid, постная полка, ₽/kg data block, quote, map teaser, «к чаю» grid |
| `razrez.html` | The lab: searchable picker with mini layer-stacks, 3D cake, annotated cross-section, taste profile, buy. Hovering a layer in 3D highlights the same layer in the flat section |
| `catalog.html` | All 158 positions. Category chips, tag chips, search, sort (price, ₽/kg, weight), «только с разрезом». State is mirrored into the URL |
| `tort.html?c=slug` | Photo, 3D cake, cross-section, spec, taste profile, quantity, basket, related items |
| `karta.html` | Interactive district map, zone legend, delivery calculator, rules |
| `basket.html` | localStorage basket → WhatsApp / phone / clipboard order text |
| `about.html` | The workshop, catalogue statistics, glossary of every component that appears across the catalogue |

Verified in Chrome at 1440px and at a true 390px viewport (rendered inside a sized
iframe — headless Chrome on Windows cannot make a window narrower than ~500px, so a
direct `--window-size=390` screenshot lies and looks like horizontal overflow; it is not).

## Data

- 158 products, 42 cakes, 75 items with a readable interior.
- 7 Ufa districts + city outline, 10 delivery neighbourhoods, all geocoded.
- Delivery prices quoted verbatim from tortufa.ru/oplata_dostavka.

The site publishes two statements the workshop itself publishes together and which do not
quite agree: «Доставка от 1000 рублей — бесплатно» and «при заказе от 2000 руб.
осуществим доставку по адресу без указания времени». Both are shown as written rather
than reconciled. **Worth asking the client which is current.**

## Known rough edges

- Photographs are hot-linked to tortufa.ru rather than copied into the repo. Fine while
  the sites share an owner; if the magazine gets its own domain, download and optimise
  them (`img.full` / `img.thumb` already carry the right WordPress size variants).
- The layer stack is a faithful *reading* of the description, not a technologist's card.
  Where a description names one filling and the cake has three gaps, the filling is
  repeated — which is how these cakes are actually assembled, but it is an inference.
- Three cakes have unusually terse descriptions («Медовый с заварным кремом»), so their
  cross-sections are the plainest. Richer text from the workshop would improve them for
  free — no code change needed.
- `openInside()` keeps one `Cake3D` instance at a time and destroys it on close; if the
  sheet is ever opened from several places at once that needs revisiting.

## Ideas worth doing next

1. **Share cards.** An `og:image` per cake rendered from the cross-section would make the
   разрез travel — it is the most shareable thing here and currently has no preview.
2. **«Соберите свой торт».** The lexicon already has colours and roles for every
   component; letting people stack their own and send it as a custom order is a small
   step from `section.js` and a genuinely viral mechanic.
3. **Real ordering.** Today the basket hands off to WhatsApp. A form endpoint or a link
   into the existing WooCommerce cart would close the loop.
4. **Photo of the real cut.** Where the workshop has a photograph of a cake actually cut,
   showing it beside the diagram would prove the diagram honest.
5. Pull `data/` on a schedule so prices never drift from the live catalogue.

## Running it

```bash
node tools/serve.mjs     # http://localhost:4173
```

Rebuild data only when needed — see README. The OSM steps are rate-limited to 1 req/s and
`data/ufa.json` is committed, so a fresh checkout needs no network.
