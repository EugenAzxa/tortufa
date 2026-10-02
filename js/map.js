/* map.js — the delivery map.
   Real administrative outlines of Ufa and its seven districts (OpenStreetMap, baked
   into data/ufa.json at build time) drawn as plain SVG, with HTML pins on top so the
   labels stay crisp and tappable at every screen size. No tiles, no map library. */

const NS = 'http://www.w3.org/2000/svg'
const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); return e }

export function renderMap(host, data, opts = {}) {
  const { interactive = true, pins = true, labels = true, shop: withShop = true } = opts
  const [VX, VY, W, H] = data.viewBox.split(' ').map(Number)
  const zoneByKey = Object.fromEntries(data.delivery.zones.map((z) => [z.key, z]))

  host.innerHTML = ''
  host.classList.add('umap')
  const svg = el('svg', { viewBox: data.viewBox, class: 'umap__svg', role: 'img', 'aria-label': 'Карта доставки по районам Уфы' })

  // soft water/ground wash so the city silhouette reads as a place, not a blob
  const defs = el('defs')
  const grad = el('linearGradient', { id: 'umap-g', x1: '0', y1: '0', x2: '0.4', y2: '1' })
  grad.append(
    el('stop', { offset: '0', 'stop-color': 'var(--paper-2)' }),
    el('stop', { offset: '1', 'stop-color': 'var(--paper-3)' }),
  )
  defs.append(grad)
  svg.append(defs)

  if (data.city) {
    svg.append(el('path', { d: data.city.d, class: 'umap__city-sh' }))
    svg.append(el('path', { d: data.city.d, class: 'umap__city' }))
  }

  const gD = el('g', { class: 'umap__districts' })
  const nodes = {}
  for (const d of data.districts) {
    const zk = data.districtZone[d.slug]
    const z = zoneByKey[zk]
    const p = el('path', {
      d: d.d, class: 'umap__d', 'data-slug': d.slug,
      style: `--tone:${z ? z.tone : 'var(--ink-3)'}`,
      tabindex: interactive ? '0' : null,
      role: interactive ? 'button' : null,
      'aria-label': z ? `${d.name} район, доставка ${z.price} ₽` : `${d.name} район`,
    })
    const t = el('title'); t.textContent = z ? `${d.name} район – курьер ${z.price} ₽` : `${d.name} район`
    p.append(t)
    gD.append(p)
    nodes[d.slug] = p
  }
  svg.append(gD)
  host.append(svg)

  // ------------------------------------------------------ HTML overlay
  const layer = document.createElement('div')
  layer.className = 'umap__pins'
  host.append(layer)
  // keep a label that sits on the very edge of a district from leaving the frame
  const clampPct = (v) => Math.max(5, Math.min(95, v)) + '%'
  const place = (node, xy) => {
    node.style.left = clampPct(((xy[0] - VX) / W) * 100)
    node.style.top = clampPct(((xy[1] - VY) / H) * 100)
  }

  if (labels) {
    for (const d of data.districts) {
      const s = document.createElement('span')
      s.className = 'umap__dlabel'
      s.textContent = d.name
      s.dataset.slug = d.slug
      place(s, d.label)
      layer.append(s)
    }
  }

  if (pins) {
    for (const z of data.delivery.zones) {
      for (const p of z.places) {
        const b = document.createElement('button')
        b.className = 'umap__pin'
        b.type = 'button'
        b.dataset.zone = z.key
        b.style.setProperty('--tone', z.tone)
        b.innerHTML = `<i></i><span><b>${p.name}</b><em>${z.price} ₽</em></span>`
        b.setAttribute('aria-label', `${p.name} – доставка ${z.price} ₽`)
        place(b, p.xy)
        layer.append(b)
      }
    }
  }

  // the workshop (a page with its own markers, like «Где купить», leaves it out)
  if (withShop) {
    const shop = document.createElement('div')
    shop.className = 'umap__shop'
    shop.innerHTML = `<i></i><span><b>Цех</b><em>Гагарина 25/1</em></span>`
    place(shop, data.shop.xy)
    layer.append(shop)
  }

  // ------------------------------------------------------ pin labels
  // The dot sits exactly on the place; its label can go on any side of it. On a phone
  // the city shrinks to ~300px and neighbours (Сипайлово and Пр. Октября, Центр and
  // Нижегородка) would sit on top of each other. Each label takes the cheapest side:
  // touching another label or dot costs, leaving the frame costs more, covering a
  // district name costs a little. Greedy first, then a few passes where every label
  // reconsiders with all the others in place, which untangles the 320px squeeze.
  // Eight spots hug the dot; the same eight a step further out are a fallback for when
  // the city is too tight, and cost a little so they are never picked for nothing.
  const SIDES = ['r', 'l', 'b', 't', 'tr', 'br', 'tl', 'bl']
  const SPOTS = [...SIDES.map((side) => ({ side })), ...SIDES.map((side) => ({ side, far: true }))]
  const setSpot = (m, s) => { m.dataset.side = s.side; m.toggleAttribute('data-far', !!s.far) }
  const overlap = (a, b, pad = 2) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + pad) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + pad)
  const layoutPins = () => {
    const marks = [...layer.querySelectorAll('.umap__pin, .umap__shop')]
    if (!marks.length) return
    const frame = host.getBoundingClientRect()
    const dots = marks.map((m) => m.querySelector('i').getBoundingClientRect())
    // district names give way to pins later, but a pin that can spare one should
    const names = [...layer.querySelectorAll('.umap__dlabel')].map((n) => {
      n.style.marginTop = n.style.marginLeft = ''; n.hidden = false
      return n.getBoundingClientRect()
    })
    // where the label would land on each side, measured once
    const boxes = marks.map((m) => {
      const label = m.querySelector('span')
      return SPOTS.map((s) => { setSpot(m, s); return label.getBoundingClientRect() })
    })
    const cost = (i, k, chosen) => {
      const r = boxes[i][k]
      let c = 0
      chosen.forEach((kj, j) => { if (j !== i && kj != null) c += overlap(r, boxes[j][kj]) })
      dots.forEach((d, j) => { if (j !== i) c += overlap(r, d) })
      names.forEach((n) => { c += overlap(r, n, 0) * 0.25 })
      const out = Math.max(0, frame.left - r.left) + Math.max(0, r.right - frame.right) +
        Math.max(0, frame.top - r.top) + Math.max(0, r.bottom - frame.bottom)
      return c + out * r.height * 4 + (SPOTS[k].far ? 8 : 0)
    }
    const pick = (i, chosen) => {
      let best = 0, bestCost = Infinity
      for (let k = 0; k < SPOTS.length; k++) {
        const c = cost(i, k, chosen)
        if (c < bestCost) { best = k; bestCost = c }
        if (!c) break
      }
      return best
    }
    // the shop and the crowded ones choose first, while there is still room around them
    const near = (i) => dots.filter((d, j) => j !== i && Math.hypot(d.x - dots[i].x, d.y - dots[i].y) < 90).length
    const order = marks.map((m, i) => i).sort((a, b) =>
      (marks[b].classList.contains('umap__shop') - marks[a].classList.contains('umap__shop')) || near(b) - near(a))
    const chosen = marks.map(() => null)
    for (const i of order) chosen[i] = pick(i, chosen)
    for (let pass = 0; pass < 4; pass++) {
      let moved = false
      for (const i of order) {
        const k = pick(i, chosen)
        if (cost(i, k, chosen) < cost(i, chosen[i], chosen)) { chosen[i] = k; moved = true }
      }
      if (!moved) break
    }
    marks.forEach((m, i) => setSpot(m, SPOTS[chosen[i]]))
  }

  // ------------------------------------------------------ declutter
  // District names and neighbourhood pins are laid out from two different sources and
  // happily land on top of each other (Дёмский vs the Дёма pin). Pins carry the prices,
  // so they win: nudge each district name clear, nearest spot first, as long as it stays
  // inside its own district (a name hanging off the edge of the city is worse than none),
  // and drop it if there is no such spot.
  const NUDGES = []
  for (let dx = -90; dx <= 90; dx += 10)
    for (let dy = -90; dy <= 90; dy += 6) if (Math.hypot(dx, dy) <= 90) NUDGES.push([dx, dy])
  NUDGES.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
  const declutter = () => {
    const taken = [...layer.querySelectorAll(':is(.umap__pin, .umap__shop) > *')].map((n) => n.getBoundingClientRect())
    if (!taken.length) return
    const frame = host.getBoundingClientRect()
    const toMap = svg.getScreenCTM()?.inverse()
    const hits = (r) => r.left < frame.left || r.right > frame.right || taken.some((p) =>
      r.left < p.right + 4 && r.right > p.left - 4 && r.top < p.bottom + 2 && r.bottom > p.top - 2)
    const inside = (slug, r) => !toMap ||
      nodes[slug].isPointInFill(new DOMPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2).matrixTransform(toMap))
    for (const label of layer.querySelectorAll('.umap__dlabel')) {
      label.style.marginLeft = label.style.marginTop = ''
      label.hidden = false
      // measured once; every nudge is the same box shifted, so trying ~500 of them is free
      const r0 = label.getBoundingClientRect()
      const shift = ([dx, dy]) => ({ left: r0.left + dx, right: r0.right + dx, top: r0.top + dy, bottom: r0.bottom + dy })
      const spot = NUDGES.find((d) => { const r = shift(d); return !hits(r) && (d === NUDGES[0] || inside(label.dataset.slug, r)) })
      if (!spot) { label.hidden = true; continue }
      label.style.marginLeft = spot[0] ? spot[0] + 'px' : ''
      label.style.marginTop = spot[1] ? spot[1] + 'px' : ''
      taken.push(shift(spot))
    }
  }
  // The first pass runs right away: on the cover the main thread is busy for a second
  // and a deferred one would leave labels piled up until it frees. Labels change size
  // with the breakpoint and once the webfont lands, so both passes run again then.
  const layout = () => { layoutPins(); if (labels && pins) declutter() }
  layout()
  new ResizeObserver(() => requestAnimationFrame(layout)).observe(host)
  document.fonts?.ready.then(() => requestAnimationFrame(layout))

  // ------------------------------------------------------ interaction
  const api = { svg, layer, nodes, place, select: () => {} }
  if (!interactive) return api

  let current = null
  const select = (slug) => {
    current = slug
    host.dataset.sel = slug || ''
    for (const s in nodes) nodes[s].classList.toggle('is-on', s === slug)
    layer.querySelectorAll('.umap__dlabel').forEach((n) => n.classList.toggle('is-on', n.dataset.slug === slug))
    const d = data.districts.find((x) => x.slug === slug)
    const z = d ? zoneByKey[data.districtZone[d.slug]] : null
    host.dispatchEvent(new CustomEvent('map:select', { detail: d ? { district: d, zone: z } : null, bubbles: true }))
  }
  api.select = select

  gD.addEventListener('pointerover', (e) => {
    const p = e.target.closest('.umap__d')
    if (p) host.dataset.hover = p.dataset.slug
  })
  gD.addEventListener('pointerout', () => { host.dataset.hover = '' })
  gD.addEventListener('click', (e) => {
    const p = e.target.closest('.umap__d')
    if (p) select(p.dataset.slug === current ? null : p.dataset.slug)
  })
  gD.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const p = e.target.closest('.umap__d')
    if (p) { e.preventDefault(); select(p.dataset.slug === current ? null : p.dataset.slug) }
  })
  layer.addEventListener('click', (e) => {
    const pin = e.target.closest('.umap__pin')
    if (!pin) return
    const zone = pin.dataset.zone
    const slug = Object.entries(data.districtZone).find(([, z]) => z === zone)?.[0]
    host.dispatchEvent(new CustomEvent('map:place', {
      detail: { zone: zoneByKey[zone], place: pin.querySelector('b').textContent }, bubbles: true,
    }))
    if (slug) select(slug)
  })
  layer.addEventListener('pointerover', (e) => {
    const l = e.target.closest('.umap__dlabel')
    if (l) host.dataset.hover = l.dataset.slug
  })

  return api
}

/* Zone legend, shared by the teaser and the full map page. */
export function zoneListHTML(data, { withFree = true } = {}) {
  const rows = data.delivery.zones.map((z) => `
    <li data-zone="${z.key}" style="--tone:${z.tone}">
      <i></i>
      <span>${z.places.map((p) => p.name).join(', ')}</span>
      <b class="num">${z.price} ₽</b>
    </li>`).join('')
  const sub = data.delivery.suburb
  return rows + `
    <li data-zone="suburb" style="--tone:${sub.tone}"><i></i><span>${sub.label}</span><b class="num">${sub.price} ₽</b></li>
    ${withFree ? `<li class="zone-list__free"><i></i><span>Самовывоз и заказ от ${data.delivery.freeFrom} ₽</span><b>0 ₽</b></li>` : ''}`
}
