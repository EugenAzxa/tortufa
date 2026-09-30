/* page-catalog.js — the whole shop, filterable. */
import { shell, catalog, hasInside, isCake, cardHTML, wireCards, params, reveal } from './app.js'

shell('catalog')
const c = await catalog()

// only categories that actually hold products, parents first
const cats = c.categories
  .filter((x) => x.count > 0)
  .sort((a, b) => b.count - a.count)

const TAGS = [
  { key: 'lenten', label: 'Постное' },
  { key: 'choco', label: 'Шоколад' },
  { key: 'fruit', label: 'Фрукты' },
  { key: 'honey', label: 'Мёд' },
  { key: 'nut', label: 'Орех' },
  { key: 'cheese', label: 'Крем-чиз' },
  { key: 'classic', label: 'Классика' },
]

const q = params()
const state = {
  cat: q.get('cat') || 'all',
  tag: q.get('tag') || null,
  search: q.get('q') || '',
  sort: 'pop',
  onlyCut: q.get('cut') === '1',
}

const catsEl = document.querySelector('[data-cats]')
const tagsEl = document.querySelector('[data-tags]')
const gridEl = document.querySelector('[data-grid]')
const countEl = document.querySelector('[data-found]')
const searchEl = document.querySelector('[data-search]')
const sortEl = document.querySelector('[data-sort]')
const cutEl = document.querySelector('[data-only-cut]')

catsEl.innerHTML = `<button class="chip" data-cat="all" aria-pressed="${state.cat === 'all'}">Всё · ${c.items.length}</button>` +
  cats.map((x) => `<button class="chip" data-cat="${x.slug}" aria-pressed="${state.cat === x.slug}">${x.name} · ${x.count}</button>`).join('')
tagsEl.innerHTML = TAGS.map((t) =>
  `<button class="chip" data-tag="${t.key}" aria-pressed="${state.tag === t.key}">${t.label}</button>`).join('')
searchEl.value = state.search
cutEl.checked = state.onlyCut

const sorters = {
  // "default" means: the things people came for — photographed cakes you can cut open
  pop: (a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, 'ru'),
  cheap: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
  dear: (a, b) => (b.price ?? -1) - (a.price ?? -1),
  perkg: (a, b) => (a.perKg ?? 1e9) - (b.perKg ?? 1e9),
  heavy: (a, b) => (b.grams ?? -1) - (a.grams ?? -1),
}

const rank = (i) => (isCake(i) ? 8 : 0) + (hasInside(i) ? 4 : 0) + (i.img ? 2 : 0) + (i.inStock ? 1 : 0)

const paint = () => {
  const s = state.search.trim().toLowerCase()
  let list = c.items
    .filter((i) => state.cat === 'all' || i.cats.some((x) => x.slug === state.cat))
    .filter((i) => !state.tag || i.tags.some((t) => t.key === state.tag))
    .filter((i) => !state.onlyCut || hasInside(i))
    .filter((i) => !s || i.name.toLowerCase().includes(s) || (i.short || '').toLowerCase().includes(s))
  list = list.sort(sorters[state.sort] || sorters.pop)

  countEl.textContent = list.length
    ? `${list.length} ${plural(list.length, 'позиция', 'позиции', 'позиций')}`
    : ''
  gridEl.innerHTML = list.map((i) => cardHTML(i)).join('') ||
    '<p class="empty">Ничего не нашлось. Попробуйте снять фильтры.</p>'
  wireCards(gridEl)

  const u = new URLSearchParams()
  if (state.cat !== 'all') u.set('cat', state.cat)
  if (state.tag) u.set('tag', state.tag)
  if (state.search) u.set('q', state.search)
  if (state.onlyCut) u.set('cut', '1')
  history.replaceState(null, '', u.toString() ? `?${u}` : location.pathname)
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

catsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]')
  if (!b) return
  state.cat = b.dataset.cat
  catsEl.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b))
  paint()
})
tagsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tag]')
  if (!b) return
  state.tag = state.tag === b.dataset.tag ? null : b.dataset.tag
  tagsEl.querySelectorAll('[data-tag]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.tag === state.tag))
  paint()
})
let t
searchEl.addEventListener('input', (e) => {
  clearTimeout(t)
  t = setTimeout(() => { state.search = e.target.value; paint() }, 160)
})
sortEl.addEventListener('change', (e) => { state.sort = e.target.value; paint() })
cutEl.addEventListener('change', (e) => { state.onlyCut = e.target.checked; paint() })

paint()
reveal()
