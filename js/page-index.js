/* page-index.js — the cover: hero cake, cut of the week, витрина, ₽/kg chart, map teaser. */
import {
  shell, catalog, ufa, isCake, hasInside, money, gram, esc, cardHTML, wireCards,
  renderSection, Cake3D, openInside, reveal, ICON,
} from './app.js'
import { renderMap, zoneListHTML } from './map.js'

shell('index')

const c = await catalog()
const cakes = c.items.filter((i) => isCake(i) && hasInside(i))

/* ---------------------------------------------------------------- hero */
// the hero cake rotates through the most layered cakes; one pick per page load
const showy = cakes
  .filter((i) => i.img && i.layers.length >= 6)
  .sort((a, b) => b.layers.length - a.layers.length)
  .slice(0, 12)
const hero = showy[Math.floor(Math.random() * showy.length)] || cakes[0]

const heroCv = document.querySelector('[data-hero-cake]')
const cake = new Cake3D(heroCv, hero, { open: false })
const heroRead = document.querySelector('[data-hero-read]')
heroCv.addEventListener('cake:layer', (e) => {
  heroRead.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
  heroRead.style.opacity = e.detail ? 1 : 0
})

document.querySelector('[data-hero-facts]').innerHTML = `
  <p class="kicker">Торт на обложке</p>
  <h2 style="font-size:clamp(1.75rem,5vw,3rem)">${esc(hero.title || hero.name)}</h2>
  <p style="color:var(--ink-2);max-width:40ch">${esc((hero.short || '').replace(/^Вес:?\s*[\d\s.,]*(?:кг|гр|грамм)?\.?\s*/i, ''))}</p>
  <dl>
    <dt>Цена</dt><dd class="num">${money(hero.price)}</dd>
    <dt>Вес</dt><dd class="num">${gram(hero.grams)}</dd>
    ${hero.perKg ? `<dt>За кило</dt><dd class="num">${money(hero.perKg)}</dd>` : ''}
    <dt>Слоёв</dt><dd class="num">${hero.layers.length}</dd>
    ${hero.shelf ? `<dt>Хранение</dt><dd>${hero.shelf}</dd>` : ''}
  </dl>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;padding-top:.5rem">
    <button class="btn btn--sm btn--berry" data-inside="${hero.slug}">Посмотреть внутри</button>
    <a class="btn btn--sm btn--ghost" href="tort.html?c=${encodeURIComponent(hero.slug)}">Подробнее</a>
  </div>`

/* ---------------------------------------------------------------- cut of the week */
// pick a cake whose interior is genuinely interesting: many distinct components
const distinct = (i) => new Set(i.layers.map((l) => l.label)).size
const week = cakes
  .filter((i) => i.img)
  .sort((a, b) => distinct(b) - distinct(a) || b.layers.length - a.layers.length)[0]

document.querySelector('[data-cut-title]').textContent = week.title || week.name
document.querySelector('[data-cut-sub]').textContent =
  `${distinct(week)} разных составляющих в одном торте. Наведите на слой — журнал подпишет, что это.`

const cutXs = document.querySelector('[data-cut-xs]')
const drawCut = () => renderSection(cutXs, week)
drawCut()
let rt
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCut, 180) })

document.querySelector('[data-cut-side]').innerHTML = `
  ${week.img ? `<img src="${week.img.thumb}" alt="${esc(week.name)}" loading="lazy">` : ''}
  <dl class="spec">
    <div><dt>Вес</dt><dd class="num">${gram(week.grams)}</dd></div>
    <div><dt>Цена</dt><dd class="num">${money(week.price)}</dd></div>
    ${week.perKg ? `<div><dt>₽ за кг</dt><dd class="num">${money(week.perKg)}</dd></div>` : ''}
    <div><dt>Слоёв</dt><dd class="num">${week.layers.length}</dd></div>
    ${week.shelf ? `<div><dt>Хранение</dt><dd>${week.shelf}</dd></div>` : ''}
  </dl>
  <div class="spec__tags">${week.tags.map((t) => `<span class="tag tag--${t.key}">${t.label}</span>`).join('')}</div>
  <div style="display:grid;gap:.5rem">
    <button class="btn btn--berry btn--wide" data-add="${week.slug}">В корзину · ${money(week.price)}</button>
    <button class="btn btn--ghost btn--wide" data-inside="${week.slug}">Повертеть в 3D</button>
  </div>`

/* ---------------------------------------------------------------- витрина */
const FILTERS = [
  { key: 'all', label: 'Все торты' },
  { key: 'choco', label: 'Шоколадные' },
  { key: 'fruit', label: 'Фруктовые' },
  { key: 'lenten', label: 'Постные' },
  { key: 'honey', label: 'Медовые' },
  { key: 'cheese', label: 'Крем-чиз' },
  { key: 'nut', label: 'С орехом' },
]
const fBar = document.querySelector('[data-cake-filters]')
const grid = document.querySelector('[data-cake-grid]')
let active = 'all'

const paintGrid = () => {
  const list = (active === 'all' ? cakes : cakes.filter((i) => i.tags.some((t) => t.key === active)))
    .slice(0, 12)
  grid.innerHTML = list.map((i) => cardHTML(i, { size: 'md' })).join('') ||
    '<p class="empty">Пока нечего показать</p>'
  wireCards(grid)
}
fBar.innerHTML = FILTERS.map((f) =>
  `<button class="chip" data-f="${f.key}" aria-pressed="${f.key === 'all'}">${f.label}</button>`).join('')
fBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]')
  if (!b) return
  active = b.dataset.f
  fBar.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', x === b))
  paintGrid()
})
paintGrid()

// the hero + featured buttons live outside the grid, so wire them too
document.body.addEventListener('click', (e) => {
  const ins = e.target.closest('[data-inside]')
  if (ins && !ins.closest('[data-cake-grid]')) { e.preventDefault(); openInside(ins.dataset.inside) }
})

/* ---------------------------------------------------------------- lenten */
const lenten = c.items.filter((i) => i.tags.some((t) => t.key === 'lenten'))
const lentenCake = lenten.find((i) => i.img && hasInside(i)) || lenten[0]
if (lentenCake?.img) {
  document.querySelector('[data-lenten-shot]').innerHTML =
    `<img src="${lentenCake.img.full}" alt="${esc(lentenCake.name)}" loading="lazy">`
}
document.querySelector('[data-lenten-strip]').innerHTML = lenten.slice(0, 5).map((i) =>
  `<a href="tort.html?c=${encodeURIComponent(i.slug)}" class="strip-item">
     <b>${esc(i.title || i.name)}</b><span class="num">${money(i.price)}</span>
   </a>`).join('')

/* ---------------------------------------------------------------- ₽/kg */
const perkg = cakes.filter((i) => i.perKg).sort((a, b) => a.perKg - b.perKg)
const cheap = perkg.slice(0, 5)
const dear = perkg.slice(-5).reverse()
const max = perkg[perkg.length - 1].perKg
const bar = (i, tone) => `
  <li>
    <a href="tort.html?c=${encodeURIComponent(i.slug)}">
      <span class="perkg__name">${esc(i.title || i.name)}</span>
      <span class="perkg__track"><i style="width:${(i.perKg / max) * 100}%;background:${tone}"></i></span>
      <b class="num">${money(i.perKg)}</b>
    </a>
    <em class="num">${gram(i.grams)} · ${money(i.price)}</em>
  </li>`
document.querySelector('[data-perkg]').innerHTML = `
  <div class="perkg__col" data-rise>
    <p class="kicker">Выгоднее всего</p>
    <ol class="perkg__list">${cheap.map((i) => bar(i, 'var(--green)')).join('')}</ol>
  </div>
  <div class="perkg__col" data-rise>
    <p class="kicker">Самые дорогие за кило</p>
    <ol class="perkg__list">${dear.map((i) => bar(i, 'var(--berry)')).join('')}</ol>
  </div>
  <p class="perkg__note">Медиана по каталогу тортов — <b class="num">${money(perkg[Math.floor(perkg.length / 2)].perKg)}</b> за килограмм. Считали по весу и цене из каталога цеха.</p>`

/* ---------------------------------------------------------------- map teaser */
const m = await ufa()
const mini = document.querySelector('[data-mini-map]')
renderMap(mini, m, { interactive: true, pins: true, labels: false })
document.querySelector('[data-zone-list]').innerHTML = zoneListHTML(m)
mini.addEventListener('map:select', (e) => {
  const list = document.querySelector('[data-zone-list]')
  const key = e.detail?.zone?.key
  list.querySelectorAll('li').forEach((li) => li.classList.toggle('is-on', !!key && li.dataset.zone === key))
})

/* ---------------------------------------------------------------- к чаю */
const tea = c.items.filter((i) => i.cats.some((x) => /k-chayu|pirozhnye|pechene|chak-chak|pirogi|pryaniki|keksy/.test(x.slug)))
const teaPick = tea.filter((i) => i.img).slice(0, 8)
const teaGrid = document.querySelector('[data-tea-grid]')
teaGrid.innerHTML = teaPick.map((i) => cardHTML(i, { size: 'sm' })).join('')
wireCards(teaGrid)

/* ---------------------------------------------------------------- counters */
const counters = document.querySelectorAll('.numbers [data-countup]')
if (counters.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue
      const el = e.target
      const to = +el.dataset.countup
      let t0
      const step = (t) => {
        t0 ??= t
        const k = Math.min(1, (t - t0) / 900)
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)))
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      io.unobserve(el)
    }
  }, { threshold: 0.5 })
  counters.forEach((el) => io.observe(el))
}

reveal()
