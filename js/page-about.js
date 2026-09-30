/* page-about.js — the workshop, the catalogue in numbers, and a layer glossary
   built from the components that actually appear across the catalogue. */
import { shell, catalog, ufa, money, esc, reveal } from './app.js'
import { renderMap } from './map.js'

shell('about')
const c = await catalog()
const m = await ufa()

/* ---------------------------------------------------------- mini map */
renderMap(document.querySelector('[data-mini]'), m, { interactive: false, pins: false, labels: false })

/* ---------------------------------------------------------- category stats */
const top = c.categories
  .filter((x) => x.count > 0 && x.parent === 0)
  .concat(c.categories.filter((x) => x.count > 0 && x.parent !== 0))
const seen = new Set()
const rows = []
for (const cat of c.categories.filter((x) => x.count > 0).sort((a, b) => b.count - a.count)) {
  if (seen.has(cat.slug)) continue
  seen.add(cat.slug)
  const items = c.items.filter((i) => i.cats.some((x) => x.slug === cat.slug) && i.price)
  if (!items.length) continue
  const prices = items.map((i) => i.price).sort((a, b) => a - b)
  rows.push({
    name: cat.name, slug: cat.slug, n: items.length,
    min: prices[0], max: prices[prices.length - 1], mid: prices[Math.floor(prices.length / 2)],
  })
}
const maxN = Math.max(...rows.map((r) => r.n))
document.querySelector('[data-stats]').innerHTML = rows.slice(0, 12).map((r) => `
  <a class="catstat" href="catalog.html?cat=${r.slug}" data-rise>
    <span class="catstat__name">${esc(r.name)}</span>
    <span class="catstat__bar"><i style="width:${(r.n / maxN) * 100}%"></i></span>
    <b class="num">${r.n}</b>
    <em class="num">${money(r.min)} — ${money(r.max)}</em>
  </a>`).join('')

/* ---------------------------------------------------------- glossary */
// every distinct component across the catalogue, with how often it shows up
const count = new Map()
for (const i of c.items) {
  for (const l of i.layers || []) {
    const k = l.label
    if (!count.has(k)) count.set(k, { label: k, color: l.color, role: l.role, n: 0 })
    count.get(k).n++
  }
}
const ROLE_ORDER = ['корж', 'прослойка', 'начинка', 'хруст', 'обмазка', 'покрытие']
const glossary = [...count.values()].sort((a, b) =>
  ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.n - a.n)

document.querySelector('[data-lexicon]').innerHTML = ROLE_ORDER.map((role) => {
  const list = glossary.filter((g) => g.role === role)
  if (!list.length) return ''
  return `<div class="lex-group" data-rise>
    <p class="kicker">${role}</p>
    <ul>${list.map((g) => `
      <li><i style="background:${g.color}"></i><span>${esc(g.label)}</span><b class="num">${g.n}</b></li>`).join('')}</ul>
  </div>`
}).join('')

reveal()
