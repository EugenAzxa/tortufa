/* page-razrez.js — the cross-section lab: pick anything with an interior,
   spin it, cut it, read every layer. */
import {
  shell, catalog, isCake, hasInside, money, gram, esc, basket, toast,
  renderSection, renderStackChip, Cake3D, params, reveal,
} from './app.js'

shell('razrez')

const c = await catalog()
const all = c.items.filter(hasInside)

const GROUPS = [
  { key: 'torty', label: 'Торты', test: (i) => isCake(i) },
  { key: 'pirozhnye', label: 'Пирожные', test: (i) => i.cats.some((x) => /pirozhnye/.test(x.slug)) },
  { key: 'lenten', label: 'Постные', test: (i) => i.tags.some((t) => t.key === 'lenten') },
  { key: 'choco', label: 'Шоколадные', test: (i) => i.tags.some((t) => t.key === 'choco') },
  { key: 'all', label: 'Всё', test: () => true },
]

let group = 'torty'
let query = ''
let current = null
let cake = null

const listEl = document.querySelector('[data-lab-list]')
const fEl = document.querySelector('[data-lab-filters]')
const xsEl = document.querySelector('[data-lab-xs]')
const infoEl = document.querySelector('[data-lab-info]')
const readEl = document.querySelector('[data-lab-read]')
const cv = document.querySelector('[data-lab-cake]')

fEl.innerHTML = GROUPS.map((g) =>
  `<button class="chip" data-g="${g.key}" aria-pressed="${g.key === group}">${g.label}</button>`).join('')

const visible = () => {
  const g = GROUPS.find((x) => x.key === group)
  const q = query.trim().toLowerCase()
  return all
    .filter((i) => g.test(i))
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q))
    .sort((a, b) => b.layers.length - a.layers.length)
}

const paintList = () => {
  const list = visible()
  listEl.innerHTML = list.map((i) => `
    <li><button data-pick="${i.slug}" aria-current="${current?.slug === i.slug}">
      <span class="stackchip" data-chip="${i.slug}"></span>
      <span><b>${esc(i.title || i.name)}</b><span class="num">${gram(i.grams)} · ${money(i.price)}</span></span>
      <span class="num" style="font-size:.6875rem;opacity:.6">${i.layers.length}</span>
    </button></li>`).join('') || '<li class="empty">Ничего не нашлось</li>'
  listEl.querySelectorAll('[data-chip]').forEach((el) => {
    const it = c.bySlug[el.dataset.chip]
    if (it) renderStackChip(el, it, { h: 30 })
  })
}

const profileRows = [
  ['choco', 'Шоколад', '#57351f'],
  ['fruit', 'Фрукты', '#c21e45'],
  ['cream', 'Кремовость', '#c9862f'],
  ['crunch', 'Хруст', '#8a6a4f'],
  ['sweet', 'Сладость', '#a81236'],
  ['airy', 'Воздушность', '#7f9c45'],
]

const paintInfo = (i) => {
  infoEl.innerHTML = `
    ${i.img ? `<img src="${i.img.thumb}" alt="${esc(i.name)}" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--r);border:1px solid var(--line)" loading="lazy">` : ''}
    <div>
      <p class="kicker">${esc(i.cat?.name || '')}</p>
      <h3 style="font-size:1.5rem;padding-block:.3rem">${esc(i.title || i.name)}</h3>
      <p style="font-size:.875rem;color:var(--ink-2)">${esc((i.short || '').replace(/^Вес:?\s*[\d\s.,]*(?:кг|гр|грамм)?\.?\s*/i, ''))}</p>
    </div>
    <div class="spec__tags">${i.tags.map((t) => `<span class="tag tag--${t.key}">${t.label}</span>`).join('')}</div>
    <dl class="spec">
      <div><dt>Цена</dt><dd class="num">${money(i.price)}</dd></div>
      <div><dt>Вес</dt><dd class="num">${gram(i.grams)}</dd></div>
      ${i.perKg ? `<div><dt>₽ за кг</dt><dd class="num">${money(i.perKg)}</dd></div>` : ''}
      <div><dt>Слоёв</dt><dd class="num">${i.layers.length}</dd></div>
      ${i.shelf ? `<div><dt>Хранение</dt><dd>${i.shelf}</dd></div>` : ''}
    </dl>
    <div>
      <p class="kicker" style="padding-bottom:.6rem">Профиль вкуса</p>
      <div class="profile">
        ${profileRows.map(([k, label, tone]) => `
          <div class="profile__row"><span>${label}</span><i><b style="width:${i.profile[k]}%;background:${tone}"></b></i></div>`).join('')}
      </div>
    </div>
    <div style="display:grid;gap:.5rem">
      <button class="btn btn--berry btn--wide" data-buy>В корзину · ${money(i.price)}</button>
      <a class="btn btn--ghost btn--wide" href="tort.html?c=${encodeURIComponent(i.slug)}">Страница торта</a>
    </div>`
  infoEl.querySelector('[data-buy]').onclick = () => { basket.add(i.slug); toast('Добавили в корзину') }
}

const drawXs = () => { if (current) renderSection(xsEl, current) }

const select = (slug, { push = true } = {}) => {
  const i = c.bySlug[slug]
  if (!i) return
  current = i
  listEl.querySelectorAll('[data-pick]').forEach((b) =>
    b.setAttribute('aria-current', b.dataset.pick === slug))
  cake?.destroy()
  cake = new Cake3D(cv, i, { open: false })
  drawXs()
  paintInfo(i)
  if (push) history.replaceState(null, '', `?c=${encodeURIComponent(slug)}`)
  // keep the chosen row in view inside the picker without moving the page
  const row = listEl.querySelector(`[data-pick="${CSS.escape(slug)}"]`)?.closest('li')
  if (row) {
    const top = row.offsetTop - listEl.offsetTop
    if (top < listEl.scrollTop || top + row.offsetHeight > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = top - listEl.clientHeight / 2 + row.offsetHeight / 2
    }
  }
}

cv.addEventListener('cake:layer', (e) => {
  readEl.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
  readEl.style.opacity = e.detail ? 1 : 0
  // mirror the 3D hover onto the flat cross-section
  xsEl.querySelectorAll('.xs-band, .xs-label, .xs__legend li').forEach((n) => n.classList.remove('is-on'))
  const xs = xsEl.querySelector('.xs')
  if (xs) xs.dataset.focus = e.detail ? '1' : ''
  if (e.detail) {
    xsEl.querySelectorAll('.xs-band, .xs-label').forEach((n) => {
      const t = n.querySelector('title')?.textContent || n.querySelector('.xs-name')?.textContent
      if (t && t.includes(e.detail.label)) n.classList.add('is-on')
    })
  }
})

listEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]')
  if (b) select(b.dataset.pick)
})
fEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-g]')
  if (!b) return
  group = b.dataset.g
  fEl.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', x === b))
  paintList()
})
document.querySelector('[data-lab-search]').addEventListener('input', (e) => {
  query = e.target.value
  paintList()
})

let rt
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawXs, 180) })

paintList()
const want = params().get('c')
select(want && c.bySlug[want] ? want : visible()[0].slug, { push: false })
reveal()
