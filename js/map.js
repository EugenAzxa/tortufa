/* map.js — the delivery map.
   Real administrative outlines of Ufa and its seven districts (OpenStreetMap, baked
   into data/ufa.json at build time) drawn as plain SVG, with HTML pins on top so the
   labels stay crisp and tappable at every screen size. No tiles, no map library. */

const NS = 'http://www.w3.org/2000/svg'
const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); return e }

export function renderMap(host, data, opts = {}) {
  const { interactive = true, pins = true, labels = true } = opts
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
    const t = el('title'); t.textContent = z ? `${d.name} район — курьер ${z.price} ₽` : `${d.name} район`
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
        b.setAttribute('aria-label', `${p.name} — доставка ${z.price} ₽`)
        place(b, p.xy)
        layer.append(b)
      }
    }
  }

  // the workshop
  const shop = document.createElement('div')
  shop.className = 'umap__shop'
  shop.innerHTML = `<i></i><span><b>Цех</b><em>Гагарина 25/1</em></span>`
  place(shop, data.shop.xy)
  layer.append(shop)

  // ------------------------------------------------------ interaction
  const api = { svg, layer, nodes, select: () => {} }
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
