/* page-konstruktor.js — build your own cake and watch it stack in 3D.

   The whole ingredient palette is read out of the catalogue, so you can only pick
   components the workshop actually works with. The cake is the lit WebGL one where the
   device can draw it (the flat one otherwise), with the same roses, berries and
   inscription as the app; the address bar uses the app's format, so «open in the app»
   carries the very same cake across. */
import {
  shell, catalog, money, gram, esc, toast, renderSection, Cake3D, params, reveal,
  APP_DISCOUNT, isInstalled, discountActive, markFirstOrder, discountLine,
} from './app.js'
import { SLOTS, SIZES, ingredients, assemble, asItem, neighbours, estimate, encode, decode } from './recipe.js'
import {
  BERRIES, INKS, FONTS, IDEAS, MAX_TEXT, readDecor, writeDecor, decorLines, cakeDecor, paintText, makeCake,
} from './custom.js'

shell('konstruktor')
const c = await catalog()
const lib = ingredients(c)

/* ---------------------------------------------------------------- state */
let size = SIZES[1]
let pick = {
  sponge: [lib.sponge.find((s) => /ванильн/i.test(s.label)) || lib.sponge[0]],
  cream: [lib.cream.find((s) => /из сливок/i.test(s.label)) || lib.cream[0]],
  fill: [lib.fill.find((s) => /клубнич|малин/i.test(s.label)) || lib.fill[0]],
  crunch: [],
  top: [],
}

// a shared recipe in the address bar wins over the default
const q0 = params()
const shared = decode(q0.get('r'), lib)
if (shared) {
  size = SIZES.find((s) => s.key === shared.sizeKey) || size
  if (shared.pick.sponge.length) pick = shared.pick
}
let deco = readDecor(q0, { piping: false })

const stageEl = document.querySelector('[data-xs]')
const cv = document.querySelector('[data-cake]')
const readEl = document.querySelector('[data-read]')
const cutBtn = document.querySelector('[data-cut]')
const sizesEl = document.querySelector('[data-sizes]')
const slotsEl = document.querySelector('[data-slots]')
const decorEl = document.querySelector('[data-decor]')
const sumEl = document.querySelector('[data-summary]')
const factsEl = document.querySelector('[data-facts]')

// Each slot offers between six and nineteen components. Showing all of them at once is
// a wall; show the ones the workshop reaches for most and let the rest unfold.
const SHOW = 8
const expanded = new Set()

const query = () => writeDecor(new URLSearchParams({ r: encode(pick, size.key)(lib) }), deco)
const currentItem = () => asItem(pick, size, assemble(pick, size.layers))

/* ---------------------------------------------------------------- the cake */
const { cake, gl } = await makeCake(cv, currentItem(), { ...cakeDecor(deco), yaw: 0 }, Cake3D)
cv.parentElement.addEventListener('cake:layer', (e) => {
  readEl.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
  readEl.style.opacity = e.detail ? 1 : 0
})
const syncCake = () => {
  if (gl) Object.assign(cake.opts, cakeDecor(deco))
  cake.setItem(currentItem())
  if (gl) paintText(cake, deco)
}

/* ---------------------------------------------------------------- paint */
const recipeText = () => [
  ...SLOTS.map((s) => {
    const chosen = pick[s.kind]
    return chosen?.length ? `${s.label}: ${chosen.map((x) => x.label).join(', ')}` : null
  }).filter(Boolean),
  ...decorLines(deco),
]

const paintSizes = () => {
  sizesEl.innerHTML = SIZES.map((s) => `
    <button class="opt opt--size" data-size="${s.key}" aria-pressed="${s.key === size.key}">
      <b>${s.label}</b>
      <span class="num">${gram(s.grams)}</span>
      <em>${s.note}</em>
    </button>`).join('')
}

const paintSlots = () => {
  slotsEl.innerHTML = SLOTS.map((s) => {
    const chosen = pick[s.kind] || []
    const open = expanded.has(s.kind)
    const rest = lib[s.kind].filter((ing, n) => n >= SHOW && !chosen.some((x) => x.label === ing.label)).length
    return `
    <section class="build__group">
      <h3 class="build__h">
        ${s.label}
        <span class="build__hint">${s.hint}${s.max > 1 ? ` · до ${s.max}` : ''}</span>
      </h3>
      <div class="build__opts" role="group" aria-label="${s.label}">
        ${lib[s.kind].map((ing, n) => {
          const on = chosen.some((x) => x.label === ing.label)
          const hidden = !open && n >= SHOW && !on
          return `<button class="opt" data-kind="${s.kind}" data-label="${esc(ing.label)}" aria-pressed="${on}"${hidden ? ' hidden' : ''}>
            <i style="background:${ing.color}"></i>
            <span>${esc(ing.label)}</span>
          </button>`
        }).join('')}
        ${rest > 0 ? `<button class="opt opt--more" data-more="${s.kind}">${open ? 'Свернуть' : `Ещё ${rest}`}</button>` : ''}
      </div>
    </section>`
  }).join('')
}

// roses, berries and the inscription; the textarea is painted once and then left alone,
// so typing never loses the caret to a repaint
const paintDecor = () => {
  const fontCss = (f) => `font-family:${esc(f.css)};font-style:${f.style.includes('italic') ? 'italic' : 'normal'}`
  const f = FONTS.find((x) => x.key === deco.font)
  decorEl.innerHTML = `
    <section class="build__group">
      <h3 class="build__h">Украшение <span class="build__hint">видно сверху · цена у цеха</span></h3>
      <div class="build__opts">
        <button class="opt" data-piping="1" aria-pressed="${deco.piping}">Розочки по краю</button>
        <button class="opt" data-piping="0" aria-pressed="${!deco.piping}">Без розочек</button>
      </div>
      <div class="build__opts">
        <button class="opt" data-berry="" aria-pressed="${!deco.berry}">Без ягод</button>
        ${BERRIES.map((b) => `<button class="opt" data-berry="${b.key}" aria-pressed="${deco.berry === b.key}"><i style="background:${b.color};border-radius:999px"></i><span>${b.label}</span></button>`).join('')}
      </div>
    </section>
    <section class="build__group">
      <h3 class="build__h">Надпись <span class="build__hint">до ${MAX_TEXT} знаков, две строки${gl ? '' : ' · в 3D видна на телефоне с WebGL'}</span></h3>
      <textarea class="build__text" data-text rows="2" maxlength="${MAX_TEXT}" placeholder="С днём рождения!" style="${fontCss(f)}" aria-label="Надпись на торте">${esc(deco.text)}</textarea>
      <div class="build__opts">${IDEAS.map((t) => `<button class="opt" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="build__opts">
        ${INKS.map((i) => `<button class="opt" data-ink="${i.key}" aria-pressed="${deco.ink === i.key}"><i style="background:${i.color};border-radius:999px"></i><span>${i.label}</span></button>`).join('')}
      </div>
      <div class="build__opts">
        ${FONTS.map((x) => `<button class="opt build__font" data-font="${x.key}" aria-pressed="${deco.font === x.key}" style="${fontCss(x)}">${x.label}</button>`).join('')}
      </div>
    </section>`
}

const promoHTML = () => {
  const appUrl = 'app.html?' + query().toString()
  if (discountActive()) {
    return `<div class="build__promo is-on"><b>−${APP_DISCOUNT.percent}% на этот заказ</b>
      <span>Первый заказ из приложения: код ${APP_DISCOUNT.code} уже в сообщении.</span></div>`
  }
  if (isInstalled()) return ''
  const desk = matchMedia('(min-width: 900px) and (pointer: fine)').matches
  return `<div class="build__promo">
    <div>
      <b>Установите приложение – первый заказ на ${APP_DISCOUNT.percent}% дешевле</b>
      <span>${desk ? 'Наведите камеру телефона на код: приложение откроется там, его можно поставить на главный экран.' : 'Откройте этот торт в приложении и поставьте его на главный экран.'}</span>
      <a class="btn btn--sm btn--ghost" href="${appUrl}">Открыть этот торт в приложении</a>
    </div>
    ${desk ? '<img src="assets/app-qr.svg" width="116" height="116" alt="QR-код: приложение Тортуфы на телефоне">' : ''}
  </div>`
}

const paintSummary = () => {
  const layers = assemble(pick, size.layers)
  const est = estimate(c, pick, size)
  const near = neighbours(c, pick, 3)
  const lines = recipeText()
  const extra = deco.piping || deco.berry || deco.text

  sumEl.innerHTML = `
    <h3 class="build__h">Ваш торт</h3>
    <ul class="build__recipe">
      ${lines.map((l) => `<li>${esc(l)}</li>`).join('')}
      <li><b>Вес:</b> ${gram(size.grams)} · слоёв в разрезе: <span class="num">${layers.length}</span></li>
    </ul>

    <div class="build__price">
      <span class="meta">Ориентировочно${extra ? ', без украшения и надписи' : ''}</span>
      <b class="num">${money(est.low)} – ${money(est.high)}</b>
      <span class="meta">${est.fromNeighbours
        ? `по ценам ${est.basedOn} похожих тортов цеха`
        : `по медиане каталога, ${est.perKg} ₽/кг`}</span>
    </div>
    <p class="build__note">Точную цену назовёт цех: торты под заказ готовят 2–3 дня, стоимость зависит от оформления.</p>

    ${promoHTML()}

    ${near.length ? `
    <div class="build__near">
      <p class="kicker">Похоже на то, что уже пекут</p>
      <ul>
        ${near.map((n) => `<li>
          <a href="tort.html?c=${encodeURIComponent(n.item.slug)}">
            <span>${esc(n.item.title || n.item.name)}</span>
            <b class="num">${money(n.item.price)}</b>
          </a>
          <em>${n.shared} ${n.shared === 1 ? 'общий компонент' : n.shared < 5 ? 'общих компонента' : 'общих компонентов'}</em>
        </li>`).join('')}
      </ul>
    </div>` : ''}

    <div class="build__acts">
      <a class="btn btn--berry btn--wide" data-wa target="_blank" rel="noopener">Отправить состав в WhatsApp</a>
      <button class="btn btn--ghost btn--wide" data-copy>Скопировать состав</button>
      <button class="btn btn--ghost btn--wide" data-share>Скопировать ссылку на торт</button>
      <button class="btn btn--ghost btn--wide" data-reset>Собрать заново</button>
    </div>`

  factsEl.innerHTML = `<b class="num">${gram(size.grams)}</b> · слоёв <b class="num">${layers.length}</b> · <b class="num">${money(est.low)} – ${money(est.high)}</b> <span>ориентировочно</span>`

  const link = location.origin + location.pathname + '?' + query().toString()
  const order = `Здравствуйте! Хочу заказать торт по своему составу:\n\n${lines.join('\n')}\nВес: ${gram(size.grams)}\n\nОриентировочно ${money(est.low)} – ${money(est.high)}${extra ? ' без учёта украшения и надписи' : ''}.${discountLine()}\nСсылка на торт: ${link}\n\nИмя:\nТелефон:\nДата:\nАдрес или самовывоз:`
  const wa = sumEl.querySelector('[data-wa]')
  wa.href = `https://wa.me/79677472114?text=${encodeURIComponent(order)}`
  wa.onclick = () => { if (discountActive()) markFirstOrder() }
  sumEl.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(order); toast('Состав скопирован') }
    catch { toast('Не вышло скопировать') }
  }
  sumEl.querySelector('[data-share]').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована') }
    catch { toast(link) }
  }
  sumEl.querySelector('[data-reset]').onclick = () => {
    pick = { sponge: [lib.sponge[0]], cream: [lib.cream[0]], fill: [], crunch: [], top: [] }
    size = SIZES[1]
    deco = readDecor(new URLSearchParams(), { piping: false })
    render()
    paintDecor()
  }
}

/* ---------------------------------------------------------------- render */
const render = () => {
  syncCake()
  renderSection(stageEl, currentItem())
  paintSizes()
  paintSlots()
  paintSummary()
  history.replaceState(null, '', '?' + query().toString())
}

/* ---------------------------------------------------------------- input */
const toggle = (kind, label) => {
  const slot = SLOTS.find((s) => s.kind === kind)
  const arr = pick[kind] || (pick[kind] = [])
  const at = arr.findIndex((x) => x.label === label)
  if (at >= 0) {
    if (arr.length <= slot.min) { toast(`Нужен хотя бы один: ${slot.label.toLowerCase()}`); return }
    arr.splice(at, 1)
  } else {
    const ing = lib[kind].find((x) => x.label === label)
    if (!ing) return
    if (arr.length >= slot.max) arr.shift()   // the oldest choice makes way
    arr.push(ing)
  }
  render()
}

// decoration changes repaint the cake and the summary, never the textarea being typed in
const decoChanged = ({ repaint = true } = {}) => {
  syncCake()
  paintSummary()
  history.replaceState(null, '', '?' + query().toString())
  if (repaint) paintDecor()
  if (gl && cake.turnTo) cake.turnTo(0)
}

document.addEventListener('click', (e) => {
  const more = e.target.closest('[data-more]')
  if (more) {
    const k = more.dataset.more
    expanded.has(k) ? expanded.delete(k) : expanded.add(k)
    paintSlots()
    return
  }
  const opt = e.target.closest('[data-kind]')
  if (opt) { toggle(opt.dataset.kind, opt.dataset.label); return }
  const sz = e.target.closest('[data-size]')
  if (sz) {
    size = SIZES.find((s) => s.key === sz.dataset.size) || size
    render()
    return
  }
  const d = e.target.closest('[data-piping], [data-berry], [data-ink], [data-font], [data-idea]')
  if (!d) return
  if (d.dataset.piping != null) deco.piping = d.dataset.piping === '1'
  else if (d.dataset.berry != null) deco.berry = d.dataset.berry || null
  else if (d.dataset.ink) deco.ink = d.dataset.ink
  else if (d.dataset.font) deco.font = d.dataset.font
  else if (d.dataset.idea) deco.text = d.dataset.idea
  decoChanged()
})

decorEl.addEventListener('input', (e) => {
  if (!e.target.matches('[data-text]')) return
  const v = e.target.value.split('\n').slice(0, 2).join('\n').slice(0, MAX_TEXT)
  if (v !== e.target.value) e.target.value = v
  deco.text = v
  decoChanged({ repaint: false })
})

const paintCut = () => {
  const open = cake.cutTarget > 0.5
  cutBtn.setAttribute('aria-pressed', String(open))
  cutBtn.querySelector('span').textContent = open ? 'Собрать обратно' : 'Разрезать'
}
cutBtn.addEventListener('click', () => { cake.toggleCut(); paintCut() })
cv.addEventListener('pointerup', () => setTimeout(paintCut, 0))

let rt
addEventListener('resize', () => {
  clearTimeout(rt)
  rt = setTimeout(() => renderSection(stageEl, currentItem()), 180)
})

render()
paintDecor()
reveal()
