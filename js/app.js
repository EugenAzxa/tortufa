/* app.js — the shell every page shares: data, header/footer, drawer, theme,
   basket, cards, and the "click a cake to look inside" reveal. */

import { renderSection, renderStackChip } from './section.js'
import { Cake3D } from './cake3d.js'

/* ------------------------------------------------------------------ data */
const BASE = new URL('.', import.meta.url).href.replace(/js\/$/, '')
let _catalog = null
let _map = null

export const catalog = async () => {
  if (!_catalog) {
    const res = await fetch(BASE + 'data/catalog.json')
    _catalog = await res.json()
    _catalog.bySlug = Object.fromEntries(_catalog.items.map((i) => [i.slug, i]))
  }
  return _catalog
}
export const ufa = async () => {
  if (!_map) _map = await (await fetch(BASE + 'data/ufa.json')).json()
  return _map
}

export const CAKE_CATS = ['torty', 'biskvitnye-torti', 'torty-medovye', 'torty-pesochnye', 'torty-sloenye', 'torty-s-sufle', 'torty-nizkokalorijnye']
export const isCake = (i) => i.cats.some((c) => CAKE_CATS.includes(c.slug))
export const hasInside = (i) => i.layers?.length >= 3

/* ------------------------------------------------------------------ format */
export const money = (n) => (n == null ? '—' : new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽')
export const gram = (g) => (g == null ? '' : g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 2).replace('.', ',')} кг` : `${g} г`)
export const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/* ------------------------------------------------------------------ basket */
const KEY = 'tortufa.basket.v1'
const readBasket = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const writeBasket = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)) } catch {} ; paintBasket() }

export const basket = {
  all: readBasket,
  count: () => Object.values(readBasket()).reduce((s, n) => s + n, 0),
  add(slug, n = 1) { const b = readBasket(); b[slug] = (b[slug] || 0) + n; writeBasket(b) },
  set(slug, n) { const b = readBasket(); if (n <= 0) delete b[slug]; else b[slug] = n; writeBasket(b) },
  clear() { writeBasket({}) },
  async lines() {
    const c = await catalog()
    return Object.entries(readBasket())
      .map(([slug, n]) => ({ item: c.bySlug[slug], n }))
      .filter((l) => l.item)
  },
  async total() { return (await this.lines()).reduce((s, l) => s + (l.item.price || 0) * l.n, 0) },
}

const paintBasket = () => {
  const n = basket.count()
  document.querySelectorAll('[data-basket-count]').forEach((el) => {
    el.dataset.n = n
    el.setAttribute('aria-label', `Корзина, ${n} шт.`)
  })
  document.dispatchEvent(new CustomEvent('basket:change'))
}

/* ------------------------------------------------------------------ shell */
const NAV = [
  { href: 'index.html', label: 'Журнал', num: '01' },
  { href: 'razrez.html', label: 'Разрез', num: '02' },
  { href: 'catalog.html', label: 'Витрина', num: '03' },
  { href: 'karta.html', label: 'Доставка', num: '04' },
  { href: 'about.html', label: 'Цех', num: '05' },
]

const ICON = {
  basket: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1.2 11a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z"/><path d="M9.5 8V6.2a2.5 2.5 0 0 1 5 0V8"/></svg>',
  burger: '<svg viewBox="0 0 24 24"><path d="M4 8h16M4 16h16"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  knife: '<svg viewBox="0 0 24 24"><path d="M3 17 14 6l4 4L7 21l-4-4Z"/><path d="M14 6l2-3 5 5-3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
}
export { ICON }

export function shell(page) {
  document.documentElement.classList.add('js')
  const here = location.pathname.split('/').pop() || 'index.html'
  const links = (cls) => NAV.map((n) => {
    const cur = n.href === here || (here === '' && n.href === 'index.html') ? ' aria-current="page"' : ''
    return cls === 'drawer'
      ? `<a href="${n.href}"${cur}><span>${n.num}</span>${n.label}</a>`
      : `<a href="${n.href}"${cur}>${n.label}</a>`
  }).join('')

  document.body.insertAdjacentHTML('afterbegin', `
<a class="skip" href="#main">К содержанию</a>
<header class="site-head">
  <div class="wrap site-head__in">
    <a class="logo" href="index.html" aria-label="Тортуфа — сладкий журнал">
      <b>Тортуфа</b><i>журнал</i>
    </a>
    <nav class="nav">${links('nav')}</nav>
    <div class="head-actions">
      <button class="icon-btn" data-theme-toggle title="Сменить тему" aria-label="Сменить тему">${ICON.moon}</button>
      <a class="icon-btn" href="basket.html" data-basket-count data-n="0" title="Корзина">${ICON.basket}</a>
      <button class="icon-btn burger" data-drawer-open aria-label="Меню">${ICON.burger}</button>
    </div>
  </div>
</header>
<div class="drawer" data-drawer hidden>
  <div class="wrap drawer__top">
    <a class="logo" href="index.html"><b>Тортуфа</b><i>журнал</i></a>
    <button class="icon-btn" data-drawer-close style="margin-left:auto" aria-label="Закрыть">${ICON.close}</button>
  </div>
  <nav>${links('drawer')}</nav>
  <div class="drawer__foot">
    <a href="tel:+79677472114">+7 (967) 747-21-14</a>
    <span>г. Уфа, ул. Гагарина 25/1 · 8:00–20:00</span>
  </div>
</div>`)

  document.body.insertAdjacentHTML('beforeend', `
<footer class="site-foot">
  <div class="wrap">
    <div class="site-foot__grid">
      <div>
        <p class="foot-mark">Тортуфа</p>
        <p class="foot-note">Сладкий журнал кондитерского цеха «Уфа&nbsp;Десерт». Мы печём в Уфе с полного цикла: от бисквита до глазури, без глубокой заморозки.</p>
      </div>
      <div>
        <p class="kicker kicker--plain">Разделы</p>
        <ul class="foot-list">${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}</ul>
      </div>
      <div>
        <p class="kicker kicker--plain">Связаться</p>
        <ul class="foot-list">
          <li><a href="tel:+79677472114">+7 (967) 747-21-14</a></li>
          <li><a href="tel:+79279605143">+7 (927) 960-51-43</a></li>
          <li><a href="mailto:info@tortufa.ru">info@tortufa.ru</a></li>
          <li><a href="https://tortufa.ru" target="_blank" rel="noopener">tortufa.ru</a></li>
        </ul>
      </div>
      <div>
        <p class="kicker kicker--plain">Цех</p>
        <ul class="foot-list">
          <li>г. Уфа, ул. Гагарина 25/1</li>
          <li>Ежедневно 8:00 — 20:00</li>
          <li>ООО «Компания Дионис»</li>
        </ul>
      </div>
    </div>
    <div class="site-foot__bar">
      <span>© ${new Date().getFullYear()} Уфа Десерт</span>
      <span>Состав и цены — по данным каталога tortufa.ru</span>
    </div>
  </div>
</footer>`)

  // drawer
  const drawer = document.querySelector('[data-drawer]')
  const setDrawer = (on) => {
    if (on) drawer.hidden = false
    drawer.dataset.open = on ? '1' : ''
    document.documentElement.style.overflow = on ? 'hidden' : ''
    if (!on) setTimeout(() => { if (!drawer.dataset.open) drawer.hidden = true }, 450)
  }
  document.querySelector('[data-drawer-open]').onclick = () => setDrawer(true)
  document.querySelector('[data-drawer-close]').onclick = () => setDrawer(false)
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setDrawer(false)))
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false) })

  // theme
  const themeBtn = document.querySelector('[data-theme-toggle]')
  const stored = localStorage.getItem('tortufa.theme')
  if (stored) document.documentElement.dataset.theme = stored
  const paintTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
    themeBtn.innerHTML = dark ? ICON.sun : ICON.moon
  }
  themeBtn.onclick = () => {
    const dark = document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'light' : 'dark'
    localStorage.setItem('tortufa.theme', dark ? 'light' : 'dark')
    paintTheme()
  }
  paintTheme()
  paintBasket()
  reveal()
}

/* ------------------------------------------------------------------ reveal */
export function reveal(root = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.querySelectorAll('[data-rise]').forEach((el) => el.classList.add('is-in'))
    return
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
  root.querySelectorAll('[data-rise]:not(.is-in)').forEach((el) => io.observe(el))
  // if the observer never gets a chance to fire, show everything anyway
  setTimeout(() => root.querySelectorAll('[data-rise]:not(.is-in)').forEach((el) => el.classList.add('is-in')), 4000)
}

/* ------------------------------------------------------------------ card */
export function cardHTML(item, { size = 'md' } = {}) {
  const inside = hasInside(item)
  const tags = (item.tags || []).slice(0, 2)
  const sale = item.onSale && item.regular && item.regular > item.price
  return `
<article class="card card--${size}" data-slug="${item.slug}" data-rise>
  <a class="card__shot" href="tort.html?c=${encodeURIComponent(item.slug)}">
    ${item.img
      ? `<img src="${item.img.thumb}" alt="${esc(item.name)}" loading="lazy" decoding="async">`
      : '<div class="card__noshot"></div>'}
    ${inside ? `<span class="card__cut">${ICON.knife}<b>Разрез</b></span>` : ''}
    ${sale ? '<span class="tag tag--sale card__sale">Акция</span>' : ''}
  </a>
  <div class="card__body">
    <div class="card__tags">${tags.map((t) => `<span class="tag tag--${t.key}">${t.label}</span>`).join('')}</div>
    <h3 class="card__name"><a href="tort.html?c=${encodeURIComponent(item.slug)}">${esc(item.title || item.name)}</a></h3>
    ${inside ? `<div class="card__stack" data-stack></div>` : ''}
    <p class="card__short">${esc((item.short || '').replace(/^Вес:?\s*[\d\s.,]*(?:кг|гр|грамм)?\.?\s*/i, ''))}</p>
    <div class="card__foot">
      <div class="card__price">
        <b class="num">${money(item.price)}</b>
        ${item.grams ? `<span class="num">${gram(item.grams)}${item.perKg ? ` · ${money(item.perKg)}/кг` : ''}</span>` : ''}
      </div>
      <div class="card__acts">
        ${inside ? `<button class="chip" data-inside="${item.slug}">Внутри</button>` : ''}
        <button class="chip chip--buy" data-add="${item.slug}" aria-label="В корзину">+</button>
      </div>
    </div>
  </div>
</article>`
}

export function wireCards(root = document) {
  root.querySelectorAll('[data-stack]').forEach(async (host) => {
    const slug = host.closest('[data-slug]')?.dataset.slug
    const c = await catalog()
    const item = c.bySlug[slug]
    if (item) renderStackChip(host, item, { h: 30 })
  })
  root.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]')
    if (add) {
      basket.add(add.dataset.add)
      add.classList.add('is-hit')
      setTimeout(() => add.classList.remove('is-hit'), 500)
      toast('Добавили в корзину')
      return
    }
    const ins = e.target.closest('[data-inside]')
    if (ins) { e.preventDefault(); openInside(ins.dataset.inside) }
  })
  reveal(root)
}

/* ------------------------------------------------------------------ toast */
let toastT
export function toast(msg) {
  let t = document.querySelector('.toast')
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t) }
  t.textContent = msg
  t.dataset.on = '1'
  clearTimeout(toastT)
  toastT = setTimeout(() => { t.dataset.on = '' }, 2200)
}

/* ------------------------------------------------ the "look inside" reveal */
let sheet, cake3d
export async function openInside(slug) {
  const c = await catalog()
  const item = c.bySlug[slug]
  if (!item) return
  if (!sheet) {
    sheet = document.createElement('div')
    sheet.className = 'inside'
    sheet.innerHTML = `
      <div class="inside__scrim" data-close></div>
      <div class="inside__panel" role="dialog" aria-modal="true" aria-label="Разрез торта">
        <button class="icon-btn inside__x" data-close aria-label="Закрыть">${ICON.close}</button>
        <div class="inside__body"></div>
      </div>`
    document.body.append(sheet)
    sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeInside() })
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.dataset.on) closeInside() })
  }
  const body = sheet.querySelector('.inside__body')
  body.innerHTML = `
    <div class="inside__head">
      <p class="kicker">Разрез · ${esc(item.cat?.name || '')}</p>
      <h2>${esc(item.title || item.name)}</h2>
      <p class="inside__meta num">${money(item.price)} · ${gram(item.grams)}${item.shelf ? ` · хранение ${item.shelf}` : ''}</p>
    </div>
    <div class="inside__stage">
      <div class="cake3d"><canvas data-cake aria-label="Трёхмерный торт: потяните, чтобы повернуть, нажмите, чтобы разрезать"></canvas>
        <p class="cake3d__hint">Потяните — повернётся. Нажмите — разрежется.</p>
        <p class="cake3d__read" data-read></p>
      </div>
      <div class="inside__xs" data-xs></div>
    </div>
    <div class="inside__foot">
      <a class="btn btn--ghost btn--sm" href="tort.html?c=${encodeURIComponent(item.slug)}">Всё о торте ${ICON.arrow}</a>
      <button class="btn btn--berry btn--sm" data-add="${item.slug}">В корзину · ${money(item.price)}</button>
    </div>`
  sheet.dataset.on = '1'
  document.documentElement.style.overflow = 'hidden'

  const cv = body.querySelector('[data-cake]')
  cake3d?.destroy()
  cake3d = new Cake3D(cv, item, { open: false })
  const read = body.querySelector('[data-read]')
  cv.addEventListener('cake:layer', (e) => {
    read.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
    read.style.opacity = e.detail ? 1 : 0
  })
  const xs = body.querySelector('[data-xs]')
  const draw = () => renderSection(xs, item)
  draw()
  let rt
  sheet._onResize = () => { clearTimeout(rt); rt = setTimeout(draw, 160) }
  addEventListener('resize', sheet._onResize)
  body.querySelector('[data-add]').onclick = () => { basket.add(item.slug); toast('Добавили в корзину') }
  setTimeout(() => body.querySelector('.inside__x')?.focus(), 60)
}

export function closeInside() {
  if (!sheet) return
  sheet.dataset.on = ''
  document.documentElement.style.overflow = ''
  removeEventListener('resize', sheet._onResize)
  setTimeout(() => { cake3d?.destroy(); cake3d = null }, 320)
}

/* ------------------------------------------------------------------ misc */
export const params = () => new URLSearchParams(location.search)

export function orderText(lines, total) {
  const rows = lines.map((l) => `• ${l.item.name} — ${l.n} шт. × ${money(l.item.price)}`).join('\n')
  return `Здравствуйте! Хочу заказать:\n${rows}\n\nИтого: ${money(total)}\n\nИмя:\nТелефон:\nАдрес / самовывоз:\nДата и время:`
}

export { renderSection, renderStackChip, Cake3D }
