/* page-konstruktor.js — build your own cake and watch it stack in 3D.

   The whole ingredient palette is read out of the catalogue, so you can only pick
   components the workshop actually works with. The cake you assemble is rendered by
   exactly the same two renderers the real cakes use. */
import {
  shell, catalog, money, gram, esc, toast, renderSection, Cake3D, params, reveal,
} from './app.js'
import { SLOTS, SIZES, ingredients, assemble, asItem, neighbours, estimate, encode, decode } from './recipe.js'

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
const shared = decode(params().get('r'), lib)
if (shared) {
  size = SIZES.find((s) => s.key === shared.sizeKey) || size
  if (shared.pick.sponge.length) pick = shared.pick
}

const stageEl = document.querySelector('[data-xs]')
const cv = document.querySelector('[data-cake]')
const readEl = document.querySelector('[data-read]')
const cutBtn = document.querySelector('[data-cut]')
const sizesEl = document.querySelector('[data-sizes]')
const slotsEl = document.querySelector('[data-slots]')
const sumEl = document.querySelector('[data-summary]')
const factsEl = document.querySelector('[data-facts]')

// Each slot offers between six and nineteen components. Showing all of them at once is
// a wall; show the ones the workshop reaches for most and let the rest unfold.
const SHOW = 8
const expanded = new Set()

let cake = null

/* ---------------------------------------------------------------- paint */
const recipeText = () => {
  const lines = SLOTS.map((s) => {
    const chosen = pick[s.kind]
    if (!chosen?.length) return null
    return `${s.label}: ${chosen.map((x) => x.label).join(', ')}`
  }).filter(Boolean)
  return lines
}

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

const paintSummary = () => {
  const layers = assemble(pick, size.layers)
  const est = estimate(c, pick, size)
  const near = neighbours(c, pick, 3)
  const lines = recipeText()

  sumEl.innerHTML = `
    <h3 class="build__h">Ваш торт</h3>
    <ul class="build__recipe">
      ${lines.map((l) => `<li>${esc(l)}</li>`).join('')}
      <li><b>Вес:</b> ${gram(size.grams)} · слоёв в разрезе: <span class="num">${layers.length}</span></li>
    </ul>

    <div class="build__price">
      <span class="meta">Ориентировочно</span>
      <b class="num">${money(est.low)} – ${money(est.high)}</b>
      <span class="meta">${est.fromNeighbours
        ? `по ценам ${est.basedOn} похожих тортов цеха`
        : `по медиане каталога, ${est.perKg} ₽/кг`}</span>
    </div>
    <p class="build__note">Точную цену назовёт цех: торты под заказ готовят 2–3 дня, стоимость зависит от оформления.</p>

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

  const order = `Здравствуйте! Хочу заказать торт по своему составу:\n\n${lines.join('\n')}\nВес: ${gram(size.grams)}\n\nОриентировочно ${money(est.low)} – ${money(est.high)}.\n\nИмя:\nТелефон:\nДата:\nАдрес или самовывоз:`
  sumEl.querySelector('[data-wa]').href = `https://wa.me/79677472114?text=${encodeURIComponent(order)}`
  sumEl.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(order); toast('Состав скопирован') }
    catch { toast('Не вышло скопировать') }
  }
  sumEl.querySelector('[data-share]').onclick = async () => {
    const url = location.origin + location.pathname + '?r=' + encode(pick, size.key)(lib)
    try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована') }
    catch { toast(url) }
  }
  sumEl.querySelector('[data-reset]').onclick = () => {
    pick = { sponge: [lib.sponge[0]], cream: [lib.cream[0]], fill: [], crunch: [], top: [] }
    size = SIZES[1]
    render({ rebuild: true })
  }
}

/* ---------------------------------------------------------------- render */
const render = ({ rebuild = false } = {}) => {
  const layers = assemble(pick, size.layers)
  const item = asItem(pick, size, layers)

  if (!cake || rebuild) {
    cake?.destroy()
    cake = new Cake3D(cv, item, { open: cake ? cake.cutTarget > 0.5 : false })
    cv.addEventListener('cake:layer', onLayer)
  } else {
    // keep the angle and the cut while the recipe changes under the reader's hands
    cake.setItem(item)
  }
  renderSection(stageEl, item)

  paintSizes()
  paintSlots()
  paintSummary()
  history.replaceState(null, '', '?r=' + encode(pick, size.key)(lib))
}

const onLayer = (e) => {
  readEl.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
  readEl.style.opacity = e.detail ? 1 : 0
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
  }
})

cutBtn.addEventListener('click', () => {
  cake.toggleCut()
  const open = cake.cutTarget > 0.5
  cutBtn.setAttribute('aria-pressed', String(open))
  cutBtn.querySelector('span').textContent = open ? 'Собрать обратно' : 'Разрезать'
})
cv.addEventListener('pointerup', () => setTimeout(() => {
  const open = cake.cutTarget > 0.5
  cutBtn.setAttribute('aria-pressed', String(open))
  cutBtn.querySelector('span').textContent = open ? 'Собрать обратно' : 'Разрезать'
}, 0))

let rt
addEventListener('resize', () => {
  clearTimeout(rt)
  rt = setTimeout(() => renderSection(stageEl, asItem(pick, size, assemble(pick, size.layers))), 180)
})

render({ rebuild: true })
reveal()
