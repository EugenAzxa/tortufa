/* page-tort.js — one product: photo, 3D, cross-section, spec, taste profile, neighbours. */
import {
  shell, catalog, hasInside, isCake, money, gram, esc, basket, toast,
  renderSection, Cake3D, cardHTML, wireCards, params, reveal, ICON,
} from './app.js'

shell('tort')
const c = await catalog()
const slug = params().get('c')
const i = c.bySlug[slug]
const root = document.querySelector('[data-prod]')

if (!i) {
  root.innerHTML = `<div class="empty"><p>Такой позиции нет.</p><p style="padding-top:1rem"><a class="btn btn--ghost" href="catalog.html">Вернуться в витрину</a></p></div>`
} else {
  document.title = `${i.name} · Тортуфа`
  document.querySelector('meta[name=description]')?.setAttribute('content', i.short || '')

  const clean = (i.short || '').replace(/^Вес:?\s*[\d\s.,]*(?:кг|гр|грамм)?\.?\s*/i, '')
  const inside = hasInside(i)
  const sale = i.onSale && i.regular && i.regular > i.price

  root.innerHTML = `
  <nav class="crumbs">
    <a href="index.html">Журнал</a><span>·</span>
    <a href="catalog.html">Витрина</a><span>·</span>
    ${i.cat ? `<a href="catalog.html?cat=${i.cat.slug}">${esc(i.cat.name)}</a><span>·</span>` : ''}
    <b>${esc(i.title || i.name)}</b>
  </nav>

  <div class="prod">
    <div style="display:grid;gap:1rem">
      <div class="prod__shot">
        ${i.img ? `<img src="${i.img.full}" alt="${esc(i.name)}" fetchpriority="high">` : '<div class="card__noshot" style="aspect-ratio:1/1"></div>'}
      </div>
      ${inside ? `<div class="prod__3d"><div class="cake3d">
        <canvas data-cake aria-label="Трёхмерный торт: потяните, чтобы повернуть, нажмите, чтобы разрезать"></canvas>
        <p class="cake3d__hint">Потяните — повернётся · Нажмите — разрежется</p>
        <p class="cake3d__read" data-read></p>
      </div></div>` : ''}
    </div>

    <div class="prod__side">
      <div>
        <p class="kicker">${esc(i.cat?.name || 'Каталог')}</p>
        <h1>${esc(i.title || i.name)}</h1>
      </div>
      <div class="spec__tags">${i.tags.map((t) => `<span class="tag tag--${t.key}">${t.label}</span>`).join('')}</div>
      <p class="lede">${esc(clean)}</p>

      <div class="prod__price">
        <b class="num">${money(i.price)}</b>
        ${sale ? `<s class="num">${money(i.regular)}</s>` : ''}
        ${i.perKg ? `<span class="meta">${money(i.perKg)} за кг</span>` : ''}
      </div>

      <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
        <div class="qty">
          <button data-minus aria-label="Меньше">−</button><span data-qty>1</span><button data-plus aria-label="Больше">+</button>
        </div>
        <button class="btn btn--berry" data-buy>В корзину</button>
        ${inside ? `<button class="btn btn--ghost" data-cut>Разрезать</button>` : ''}
      </div>

      <dl class="spec">
        ${i.grams ? `<div><dt>Вес</dt><dd class="num">${gram(i.grams)}</dd></div>` : ''}
        ${i.shelf ? `<div><dt>Срок хранения</dt><dd>${i.shelf} при +4 ±2 °C</dd></div>` : ''}
        ${inside ? `<div><dt>Слоёв в разрезе</dt><dd class="num">${i.layers.length}</dd></div>` : ''}
        <div><dt>Наличие</dt><dd>${i.inStock ? 'Есть в цехе' : 'Под заказ'}</dd></div>
        <div><dt>Самовывоз</dt><dd>Гагарина 25/1</dd></div>
      </dl>

      ${inside ? `<div>
        <p class="kicker" style="padding-bottom:.6rem">Профиль вкуса</p>
        <div class="profile" data-profile></div>
      </div>` : ''}

      <p class="meta">Состав и вес — по карточке товара на <a href="${i.url}" target="_blank" rel="noopener" style="border-bottom:1px solid currentColor">tortufa.ru</a></p>
    </div>
  </div>

  ${inside ? `
  <section>
    <div class="sec-head">
      <div><p class="kicker">Разрез</p><h2>Что внутри</h2></div>
      <p>Каждая полоса — то, что кондитер реально кладёт в этот торт. Наведите на слой.</p>
    </div>
    <div class="cut-feature__xs" data-xs></div>
  </section>` : ''}

  <section>
    <div class="sec-head">
      <div><p class="kicker">Рядом</p><h2>Похожее</h2></div>
    </div>
    <div class="grid grid--wide" data-near></div>
  </section>`

  /* ---------------- profile ---------------- */
  if (inside) {
    const rows = [
      ['choco', 'Шоколад', '#57351f'], ['fruit', 'Фрукты', '#c21e45'],
      ['cream', 'Кремовость', '#c9862f'], ['crunch', 'Хруст', '#8a6a4f'],
      ['sweet', 'Сладость', '#a81236'], ['airy', 'Воздушность', '#7f9c45'],
    ]
    document.querySelector('[data-profile]').innerHTML = rows.map(([k, l, tone]) =>
      `<div class="profile__row"><span>${l}</span><i><b style="width:${i.profile[k]}%;background:${tone}"></b></i></div>`).join('')
  }

  /* ---------------- 3D + cross-section ---------------- */
  let cake
  if (inside) {
    const cv = document.querySelector('[data-cake]')
    cake = new Cake3D(cv, i, { open: false })
    const read = document.querySelector('[data-read]')
    cv.addEventListener('cake:layer', (e) => {
      read.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
      read.style.opacity = e.detail ? 1 : 0
    })
    document.querySelector('[data-cut]')?.addEventListener('click', () => {
      cake.toggleCut()
      document.querySelector('.prod__3d')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const xs = document.querySelector('[data-xs]')
    const draw = () => renderSection(xs, i)
    draw()
    let rt
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 180) })
  }

  /* ---------------- buy ---------------- */
  let qty = 1
  const qtyEl = document.querySelector('[data-qty]')
  document.querySelector('[data-minus]').onclick = () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty }
  document.querySelector('[data-plus]').onclick = () => { qty = Math.min(99, qty + 1); qtyEl.textContent = qty }
  document.querySelector('[data-buy]').onclick = () => {
    basket.add(i.slug, qty)
    toast(`${i.title || i.name} — ${qty} шт. в корзине`)
  }

  /* ---------------- neighbours ---------------- */
  const score = (o) => {
    if (o.slug === i.slug) return -1
    let s = 0
    for (const t of i.tags) if (o.tags.some((x) => x.key === t.key)) s += 3
    if (o.cat?.slug === i.cat?.slug) s += 4
    if (isCake(o) === isCake(i)) s += 1
    if (o.img) s += 1
    if (i.grams && o.grams) s += Math.max(0, 2 - Math.abs(o.grams - i.grams) / 600)
    return s
  }
  const near = c.items.map((o) => [score(o), o]).filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, o]) => o)
  const nearEl = document.querySelector('[data-near]')
  nearEl.innerHTML = near.map((o) => cardHTML(o)).join('')
  wireCards(nearEl)
}

reveal()
