/* page-shops.js — «Где купить»: every shop of the workshop, numbered on the district map
   and listed with its hours, phone and a route.

   Seventeen shops on a 330px map cannot all carry a label, so the map shows numbers and
   the list carries the words. Shops closer on screen than a marker is wide merge into
   one marker with a count; that is redone on every resize, so a phone sees clusters
   where a desktop sees every number. */
import { shell, ufa, esc, reveal } from './app.js'
import { renderMap } from './map.js'

shell('gde-kupit')
const [m, data] = await Promise.all([ufa(), fetch('data/shops.json').then((r) => r.json())])

// the workshop's own shop first, then the city, then the towns around it
const shops = [...data.shops]
  .sort((a, b) => (b.main - a.main) || ((a.town === 'Уфа' ? 0 : 1) - (b.town === 'Уфа' ? 0 : 1)))
  .map((s, i) => ({ ...s, n: i + 1, inUfa: s.town === 'Уфа' }))

document.querySelector('[data-lede]').textContent =
  `${shops.length} магазинов цеха: ${shops.filter((s) => s.inUfa).length} в Уфе и ${shops.filter((s) => !s.inUfa).length} в посёлках и городах вокруг. Торты, пирожные, печенье и чак-чак – из одного цеха на Гагарина 25/1.`

/* ---------------------------------------------------------------- time */
// the shops keep Ufa time (UTC+5) wherever the reader is
const ufaMinutes = () => {
  const d = new Date()
  return ((d.getUTCHours() + 5) % 24) * 60 + d.getUTCMinutes()
}
const span = (h) => {
  const m2 = (h || '').match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/)
  return m2 ? [+m2[1] * 60 + +m2[2], +m2[3] * 60 + +m2[4]] : null
}
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const status = (s) => {
  const sp = span(s.hours)
  if (!sp) return null
  const now = ufaMinutes()
  return now >= sp[0] && now < sp[1]
    ? { open: true, text: `Открыто до ${hhmm(sp[1])}` }
    : { open: false, text: `Закрыто, откроется в ${hhmm(sp[0])}` }
}

/* ---------------------------------------------------------------- list */
const tel = (p) => {
  if (!p) return null
  let d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1)
  if (d.length !== 11) return null
  return { href: '+' + d, text: `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` }
}
const route = (s) => `https://yandex.ru/maps/?rtext=~${s.lonlat[1]},${s.lonlat[0]}&rtt=auto`
const onMap = (s) => `https://yandex.ru/maps/?pt=${s.lonlat[0]},${s.lonlat[1]}&z=17&l=map`

const listEl = document.querySelector('[data-list]')
const paintList = () => {
  listEl.innerHTML = shops.map((s) => {
    const st = status(s)
    const t = tel(s.phone)
    return `<li class="shop" data-id="${s.n}" data-ufa="${s.inUfa ? 1 : 0}" data-open="${st?.open ? 1 : 0}">
      <b class="shop__n">${s.n}</b>
      <div class="shop__body">
        <h3>${esc(s.name)}</h3>
        <p class="shop__addr">${esc(s.addr)}</p>
        ${s.main ? '<p class="shop__note">При цехе: здесь же самовывоз заказных тортов</p>' : ''}
        <p class="shop__time">${st ? `<span class="shop__st" data-open="${st.open ? 1 : 0}">${st.text}</span> · ` : ''}${esc(s.hours)}</p>
        <div class="shop__acts">
          ${t ? `<a class="btn btn--sm btn--ghost" href="tel:${t.href}">${t.text}</a>` : ''}
          ${s.lonlat ? `<a class="btn btn--sm btn--ghost" href="${route(s)}" target="_blank" rel="noopener">Маршрут</a>
          <a class="shop__map" href="${onMap(s)}" target="_blank" rel="noopener">на Яндекс Картах</a>` : ''}
        </div>
      </div>
    </li>`
  }).join('')
}
paintList()

/* ---------------------------------------------------------------- map */
const host = document.querySelector('[data-map]')
const api = renderMap(host, m, { interactive: false, pins: false, labels: true, shop: false })
const [VX, VY, W, H] = m.viewBox.split(' ').map(Number)
const placed = shops.filter((s) => s.xy)

const layoutMarks = () => {
  api.layer.querySelectorAll('.smark').forEach((n) => n.remove())
  const r = host.getBoundingClientRect()
  if (!r.width) return
  // greedy clustering in screen pixels: anything within a marker's width joins
  const MIN = 26
  const groups = []
  for (const s of placed) {
    const x = ((s.xy[0] - VX) / W) * r.width
    const y = ((s.xy[1] - VY) / H) * r.height
    const g = groups.find((g) => Math.hypot(g.x - x, g.y - y) < MIN)
    if (g) { g.items.push(s); g.x = (g.x * (g.items.length - 1) + x) / g.items.length; g.y = (g.y * (g.items.length - 1) + y) / g.items.length }
    else groups.push({ x, y, items: [s] })
  }
  for (const g of groups) {
    const b = document.createElement('button')
    b.type = 'button'
    const ids = g.items.map((s) => s.n)
    b.className = 'smark' + (ids.length > 1 ? ' smark--many' : '') + (g.items.some((s) => s.main) ? ' smark--main' : '')
    b.dataset.ids = ids.join(',')
    // a merged marker lists its numbers: a bare count would read as one more shop number
    b.textContent = ids.length > 3 ? `${ids[0]}…${ids[ids.length - 1]}` : ids.join('·')
    b.setAttribute('aria-label', g.items.map((s) => `${s.n}. ${s.name}`).join('; '))
    b.title = g.items.map((s) => `${s.n}. ${s.name}`).join('\n')
    b.style.left = (g.x / r.width) * 100 + '%'
    b.style.top = (g.y / r.height) * 100 + '%'
    api.layer.append(b)
  }
  // district names give way to the markers
  const marks = [...api.layer.querySelectorAll('.smark')].map((n) => n.getBoundingClientRect())
  for (const l of api.layer.querySelectorAll('.umap__dlabel')) {
    l.hidden = false
    const a = l.getBoundingClientRect()
    l.hidden = marks.some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
  }
}
layoutMarks()
new ResizeObserver(() => requestAnimationFrame(layoutMarks)).observe(host)

/* ---------------------------------------------------------------- linking */
const highlight = (ids, scroll) => {
  listEl.querySelectorAll('.shop').forEach((li) => li.classList.toggle('is-on', ids.includes(+li.dataset.id)))
  api.layer.querySelectorAll('.smark').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.ids.split(',').some((i) => ids.includes(+i))))
  if (scroll) listEl.querySelector(`[data-id="${ids[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
api.layer.addEventListener('click', (e) => {
  const b = e.target.closest('.smark')
  if (b) highlight(b.dataset.ids.split(',').map(Number), true)
})
listEl.addEventListener('pointerover', (e) => {
  const li = e.target.closest('.shop')
  if (li) highlight([+li.dataset.id], false)
})

const filterEl = document.querySelector('.shops__filter')
filterEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-town]')
  if (!b) return
  filterEl.querySelectorAll('[data-town]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
  const f = b.dataset.town
  listEl.querySelectorAll('.shop').forEach((li) => {
    li.hidden = f === 'ufa' ? li.dataset.ufa !== '1' : f === 'out' ? li.dataset.ufa !== '0' : f === 'open' ? li.dataset.open !== '1' : false
  })
})

// open/closed changes while the page is open
setInterval(() => {
  const keep = filterEl.querySelector('[aria-pressed="true"]')
  paintList()
  keep?.click()
}, 60_000)

reveal()
