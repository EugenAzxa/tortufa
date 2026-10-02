/* page-app.js — «Свой торт», the installable app page.

   A cake is built in steps: size, the five recipe slots the constructor already has,
   then decoration and an inscription. The palette is the workshop's own (recipe.js
   reads it out of the catalogue); roses, berries and the inscription are the only
   things here the catalogue does not list, and they are the customer's choice, so the
   order says so and leaves their price to the workshop.

   State lives in the address bar, so a built cake is a link; a draft is also kept on
   the device so closing the app does not lose it. */
import { catalog, money, gram, esc, toast } from './app.js'
import { SLOTS, SIZES, ingredients, assemble, asItem, estimate, encode, decode } from './recipe.js'
import { Cake3D } from './cake3d.js'

document.documentElement.classList.add('js')
try { const t = localStorage.getItem('tortufa.theme'); if (t) document.documentElement.dataset.theme = t } catch {}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})

const c = await catalog()
const lib = ingredients(c)

// berries the workshop bakes with (colours from its own catalogue lexicon)
const BERRIES = [
  { key: 'strawberry', label: 'Клубника', color: '#D9304A', shape: 'strawberry' },
  { key: 'raspberry', label: 'Малина', color: '#C21E45', shape: 'raspberry' },
  { key: 'cherry', label: 'Вишня', color: '#8E1B2C', shape: 'cherry' },
  { key: 'currant', label: 'Смородина', color: '#4A1E3D', shape: 'currant' },
]
const INKS = [
  { key: 'choco', label: 'Шоколад', color: '#4a2a1c' },
  { key: 'berry', label: 'Малиновый', color: '#b0123f' },
  { key: 'white', label: 'Белый', color: '#fffaf2' },
  { key: 'gold', label: 'Золотой', color: '#c79a3b' },
]
const FONTS = [
  { key: 'script', label: 'Прописью', css: '"Marck Script", cursive', style: '' },
  { key: 'hand', label: 'От руки', css: '"Caveat", cursive', style: '600' },
  { key: 'serif', label: 'Строго', css: '"Playfair Display", serif', style: 'italic 700' },
]
const IDEAS = ['С днём рождения!', 'Любимой маме', 'С юбилеем!', 'Поздравляем!', 'Спасибо!', 'С 8 Марта']
const MAX_TEXT = 40

/* ---------------------------------------------------------------- state */
const SAVE = 'tortufa.app.v1'
const fresh = () => ({
  size: 'classic',
  pick: {
    sponge: [lib.sponge.find((s) => /ванильн/i.test(s.label)) || lib.sponge[0]],
    cream: [lib.cream.find((s) => /из сливок/i.test(s.label)) || lib.cream[0]],
    fill: [lib.fill.find((s) => /клубнич|малин/i.test(s.label)) || lib.fill[0]].filter(Boolean),
    crunch: [],
    top: [],
  },
  piping: true,
  berry: 'strawberry',
  text: '',
  ink: 'choco',
  font: 'script',
})

const fromQuery = (q) => {
  const r = decode(q.get('r'), lib)
  if (!r || !r.pick.sponge.length) return null
  return {
    size: SIZES.some((s) => s.key === r.sizeKey) ? r.sizeKey : 'classic',
    pick: r.pick,
    piping: q.get('p') !== '0',
    berry: BERRIES.some((b) => b.key === q.get('b')) ? q.get('b') : null,
    text: (q.get('t') || '').slice(0, MAX_TEXT),
    ink: INKS.some((i) => i.key === q.get('i')) ? q.get('i') : 'choco',
    font: FONTS.some((f) => f.key === q.get('f')) ? q.get('f') : 'script',
  }
}
const toQuery = (s) => {
  const q = new URLSearchParams({ r: encode(s.pick, s.size)(lib), p: s.piping ? '1' : '0', i: s.ink, f: s.font })
  if (s.berry) q.set('b', s.berry)
  if (s.text) q.set('t', s.text)
  return q
}

let st = fromQuery(new URLSearchParams(location.search))
if (!st) { try { st = fromQuery(new URLSearchParams(localStorage.getItem(SAVE) || '')) } catch {} }
if (!st) st = fresh()

const save = () => {
  const q = toQuery(st).toString()
  history.replaceState(null, '', '?' + q)
  try { localStorage.setItem(SAVE, q) } catch {}
}

const size = () => SIZES.find((s) => s.key === st.size) || SIZES[1]
const currentItem = () => asItem(st.pick, size(), assemble(st.pick, size().layers))
const berry = () => BERRIES.find((b) => b.key === st.berry) || null
const ink = () => INKS.find((i) => i.key === st.ink) || INKS[0]
const font = () => FONTS.find((f) => f.key === st.font) || FONTS[0]

/* ---------------------------------------------------------------- the cake */
const cv = document.querySelector('[data-cake]')
const readEl = document.querySelector('[data-read]')
const flatEl = document.querySelector('[data-flat]')
const cutBtn = document.querySelector('[data-cut]')
let cake = null
let gl = false

const cakeOpts = () => ({ piping: st.piping, berries: berry() })

try {
  const { CakeGL, webglOK } = await import('./cake-gl.js')
  if (webglOK()) {
    cake = new CakeGL(cv, currentItem(), { ...cakeOpts(), elev: 0.66, yaw: 0, autospin: true })
    gl = true
  }
} catch (e) { console.warn('WebGL cake unavailable, drawing the flat one', e) }
if (!cake) cake = new Cake3D(cv, currentItem(), { open: false })

const paintInscription = async () => {
  if (!gl) { flatEl.hidden = !st.text; flatEl.textContent = st.text; return }
  const f = font()
  // the canvas cannot wait for a webfont by itself; ask for the glyphs first
  try { await document.fonts.load(`${f.style} 64px ${f.css}`, st.text || 'А') } catch {}
  cake.setInscription({ text: st.text, color: ink().color, font: f.css, style: f.style })
}

const refresh = () => {
  if (gl) Object.assign(cake.opts, cakeOpts())
  cake.setItem(currentItem())
  paintInscription()
  paintFacts()
  save()
}

cv.parentElement.addEventListener('cake:layer', (e) => {
  readEl.textContent = e.detail ? `${e.detail.role}: ${e.detail.label}` : ''
  readEl.style.opacity = e.detail ? 1 : 0
})
const paintCut = () => {
  const open = cake.cutTarget > 0.5
  cutBtn.setAttribute('aria-pressed', String(open))
  cutBtn.querySelector('span').textContent = open ? 'Собрать' : 'Разрезать'
}
cutBtn.addEventListener('click', () => { cake.toggleCut(); paintCut() })
cv.addEventListener('pointerup', () => setTimeout(paintCut, 0))

/* ---------------------------------------------------------------- steps */
const STEPS = [
  { key: 'size', label: 'Размер' },
  ...SLOTS.map((s) => ({ key: s.kind, label: s.label, slot: s })),
  { key: 'decor', label: 'Украшение' },
  { key: 'text', label: 'Надпись' },
  { key: 'done', label: 'Готово' },
]
let step = 0
const expanded = new Set()
const SHOW = 12

const stepsEl = document.querySelector('[data-steps]')
const panelEl = document.querySelector('[data-panel]')
const prevBtn = document.querySelector('[data-prev]')
const nextBtn = document.querySelector('[data-next]')
const factsEl = document.querySelector('[data-facts]')

const paintFacts = () => {
  const est = estimate(c, st.pick, size())
  factsEl.textContent = `${size().label} · ${gram(size().grams)} · ${money(est.low)} – ${money(est.high)}`
}

const paintSteps = () => {
  stepsEl.innerHTML = STEPS.map((s, i) => `
    <button class="tapp__step" role="tab" data-step="${i}" aria-selected="${i === step}" data-done="${i < step ? 1 : 0}">
      <i>${i + 1}</i>${s.label}
    </button>`).join('')
  stepsEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
}

const head = (title, note = '') => `<div class="tapp__h"><h2>${title}</h2><span>${note}</span></div>`

const slotHTML = (slot) => {
  const chosen = st.pick[slot.kind] || []
  const open = expanded.has(slot.kind)
  const all = lib[slot.kind]
  const rest = all.filter((ing, n) => n >= SHOW && !chosen.some((x) => x.label === ing.label)).length
  const note = `${slot.hint}${slot.max > 1 ? ` · до ${slot.max}` : ''}${slot.min ? '' : ' · можно без'}`
  return head(slot.label, note) + `<div class="a-opts" role="group" aria-label="${slot.label}">
    ${all.map((ing, n) => {
      const on = chosen.some((x) => x.label === ing.label)
      const hidden = !open && n >= SHOW && !on
      return `<button class="a-opt" data-kind="${slot.kind}" data-label="${esc(ing.label)}" aria-pressed="${on}"${hidden ? ' hidden' : ''}>
        <i style="background:${ing.color}"></i><span>${esc(ing.label)}</span></button>`
    }).join('')}
    ${rest > 0 ? `<button class="a-opt a-opt--more" data-more="${slot.kind}">${open ? 'Свернуть' : `Ещё ${rest}`}</button>` : ''}
  </div>`
}

const recipeLines = () => {
  const lines = SLOTS.map((s) => {
    const chosen = st.pick[s.kind]
    return chosen?.length ? `${s.label}: ${chosen.map((x) => x.label).join(', ')}` : null
  }).filter(Boolean)
  const decor = [st.piping && 'розочки из крема', berry() && berry().label.toLowerCase()].filter(Boolean)
  if (decor.length) lines.push(`Украшение: ${decor.join(', ')}`)
  if (st.text) lines.push(`Надпись: «${st.text.replace(/\n/g, ' / ')}» (${ink().label.toLowerCase()}, ${font().label.toLowerCase()})`)
  return lines
}

const orderText = () => {
  const est = estimate(c, st.pick, size())
  return `Здравствуйте! Хочу заказать торт, собранный в приложении Тортуфы:\n\n${recipeLines().join('\n')}\nВес: ${gram(size().grams)}\n\nОриентировочно ${money(est.low)} – ${money(est.high)} без учёта украшения и надписи.\nСсылка на торт: ${location.href}\n\nИмя:\nТелефон:\nДата:\nАдрес или самовывоз:`
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone

const paintPanel = () => {
  const s = STEPS[step]
  if (s.key === 'size') {
    panelEl.innerHTML = head('Размер', 'вес и сколько коржей') + `<div class="a-sizes">
      ${SIZES.map((z) => `<button class="a-size" data-size="${z.key}" aria-pressed="${z.key === st.size}">
        <b>${z.label}</b><span class="num">${gram(z.grams)} · коржей ${z.layers}</span><em>${z.note}</em></button>`).join('')}
    </div>`
  } else if (s.slot) {
    panelEl.innerHTML = slotHTML(s.slot)
  } else if (s.key === 'decor') {
    panelEl.innerHTML = head('Украшение', 'то, что видно сверху') + `
      <div class="a-group"><p>Розочки из крема</p><div class="a-opts">
        <button class="a-opt" data-piping="1" aria-pressed="${st.piping}">По краю</button>
        <button class="a-opt" data-piping="0" aria-pressed="${!st.piping}">Без розочек</button>
      </div></div>
      <div class="a-group"><p>Ягоды</p><div class="a-opts">
        <button class="a-opt" data-berry="" aria-pressed="${!st.berry}">Без ягод</button>
        ${BERRIES.map((b) => `<button class="a-opt" data-berry="${b.key}" aria-pressed="${st.berry === b.key}">
          <i style="background:${b.color};border-radius:999px"></i>${b.label}</button>`).join('')}
      </div></div>`
  } else if (s.key === 'text') {
    panelEl.innerHTML = head('Надпись', `до ${MAX_TEXT} знаков, две строки`) + `
      <div class="a-group">
        <textarea class="a-text" data-text rows="2" maxlength="${MAX_TEXT}" placeholder="С днём рождения!"
          style="font-family:${esc(font().css)};font-weight:${font().style.includes('700') ? 700 : font().style || 400};font-style:${font().style.includes('italic') ? 'italic' : 'normal'}"
          aria-label="Надпись на торте">${esc(st.text)}</textarea>
        <p class="a-count" data-count>${st.text.length} / ${MAX_TEXT}</p>
        <div class="a-ideas">${IDEAS.map((t) => `<button data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      </div>
      <div class="a-group"><p>Цвет</p><div class="a-opts">
        ${INKS.map((i) => `<button class="a-swatch" data-ink="${i.key}" aria-pressed="${st.ink === i.key}" aria-label="${i.label}" title="${i.label}">
          <span style="background:${i.color}"></span></button>`).join('')}
      </div></div>
      <div class="a-group"><p>Почерк</p><div class="a-opts">
        ${FONTS.map((f) => `<button class="a-opt a-font" data-font="${f.key}" aria-pressed="${st.font === f.key}"
          style="font-family:${esc(f.css)};font-style:${f.style.includes('italic') ? 'italic' : 'normal'}">${f.label}</button>`).join('')}
      </div></div>`
  } else {
    const est = estimate(c, st.pick, size())
    panelEl.innerHTML = head('Ваш торт', gram(size().grams)) + `<div class="a-sum">
      <ul>${recipeLines().map((l) => { const [k, ...v] = l.split(': '); return `<li><b>${esc(k)}:</b> ${esc(v.join(': '))}</li>` }).join('')}</ul>
      <div class="a-price">
        <span>Ориентировочно, без украшения и надписи</span>
        <b class="num">${money(est.low)} – ${money(est.high)}</b>
        <span>${est.fromNeighbours ? `по ценам ${est.basedOn} похожих тортов цеха` : `по медиане каталога, ${est.perKg} ₽/кг`}</span>
      </div>
      <p class="a-note">Точную цену назовёт цех. Торты под заказ готовят 2–3 дня.</p>
      <div class="a-acts">
        <a class="btn btn--berry" data-wa target="_blank" rel="noopener">Заказать в WhatsApp</a>
        <button class="btn btn--ghost" data-share>${navigator.share ? 'Поделиться тортом' : 'Скопировать ссылку'}</button>
        <button class="btn btn--ghost" data-reset>Собрать заново</button>
      </div>
      ${isIOS ? '<p class="a-note">Чтобы приложение было под рукой: «Поделиться» → «На экран „Домой“».</p>' : ''}
    </div>`
    panelEl.querySelector('[data-wa]').href = `https://wa.me/79677472114?text=${encodeURIComponent(orderText())}`
  }

  prevBtn.disabled = step === 0
  nextBtn.textContent = step === STEPS.length - 1 ? 'Заказать в WhatsApp' : step === STEPS.length - 2 ? 'Посмотреть итог' : 'Дальше'
  panelEl.scrollTop = 0

  // while the inscription is being written the cake holds still, words toward you
  if (gl) {
    cake.opts.autospin = s.key !== 'text'
    if (s.key === 'text' || s.key === 'decor') cake.turnTo(0)
  }
}

const go = (i) => {
  step = Math.max(0, Math.min(STEPS.length - 1, i))
  paintSteps()
  paintPanel()
}

/* ---------------------------------------------------------------- input */
const toggle = (kind, label) => {
  const slot = SLOTS.find((s) => s.kind === kind)
  const arr = st.pick[kind] || (st.pick[kind] = [])
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
  refresh()
  paintPanel()
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a')
  if (!t) return
  const d = t.dataset
  if (d.step != null) return go(+d.step)
  if (d.more) { expanded.has(d.more) ? expanded.delete(d.more) : expanded.add(d.more); return paintPanel() }
  if (d.kind) return toggle(d.kind, d.label)
  if (d.size) { st.size = d.size; refresh(); return paintPanel() }
  if (d.piping != null) { st.piping = d.piping === '1'; refresh(); return paintPanel() }
  if (d.berry != null) { st.berry = d.berry || null; refresh(); return paintPanel() }
  if (d.ink) { st.ink = d.ink; paintInscription(); save(); return paintPanel() }
  if (d.font) { st.font = d.font; paintInscription(); save(); return paintPanel() }
  if (d.idea) {
    st.text = d.idea
    paintInscription(); save(); paintPanel()
    return
  }
  if (t.hasAttribute('data-share')) {
    try {
      if (navigator.share) await navigator.share({ title: 'Мой торт · Тортуфа', text: 'Смотри, какой торт я собрал', url: location.href })
      else { await navigator.clipboard.writeText(location.href); toast('Ссылка скопирована') }
    } catch {}
    return
  }
  if (t.hasAttribute('data-reset')) { st = fresh(); refresh(); return go(0) }
})

panelEl.addEventListener('input', (e) => {
  if (!e.target.matches('[data-text]')) return
  // two lines at most; a third line break is dropped as it is typed
  const v = e.target.value.split('\n').slice(0, 2).join('\n').slice(0, MAX_TEXT)
  if (v !== e.target.value) e.target.value = v
  st.text = v
  panelEl.querySelector('[data-count]').textContent = `${v.length} / ${MAX_TEXT}`
  paintInscription()
  save()
})

prevBtn.addEventListener('click', () => go(step - 1))
nextBtn.addEventListener('click', () => {
  if (step === STEPS.length - 1) { window.open(`https://wa.me/79677472114?text=${encodeURIComponent(orderText())}`, '_blank', 'noopener'); return }
  go(step + 1)
})

/* ---------------------------------------------------------------- install */
const installBtn = document.querySelector('[data-install]')
let deferred = null
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; installBtn.hidden = false })
installBtn.addEventListener('click', async () => {
  if (!deferred) return
  deferred.prompt()
  await deferred.userChoice.catch(() => {})
  deferred = null
  installBtn.hidden = true
})
addEventListener('appinstalled', () => { installBtn.hidden = true; toast('Тортуфа на главном экране') })

paintFacts()
paintInscription()
save()
go(0)
