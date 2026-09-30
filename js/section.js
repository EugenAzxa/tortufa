/* section.js — the annotated cross-section.
   Draws a real slice of a specific cake from its parsed layer stack: crumb-textured
   sponges, squashed jam bands, wobbling cream, glaze dripping over the crust — plus
   magazine-style leader lines to every component. Pure SVG, no dependencies. */

const NS = 'http://www.w3.org/2000/svg'
const el = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name)
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k])
  return n
}

// deterministic per-cake randomness, so a cake always looks like itself
const rng = (seed) => {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)))))
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('')
}
const isDark = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 150
}

/* ------------------------------------------------------------------ edges */
// a wavy horizontal edge — how jam and cream actually sit between two sponges
const waveEdge = (x0, x1, y, amp, n, rnd, dir = 1) => {
  const pts = []
  const steps = Math.max(3, n)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = x0 + (x1 - x0) * t
    const bulge = Math.sin(t * Math.PI) // squeezed out more in the middle
    pts.push([x, y + dir * amp * bulge * (0.45 + rnd() * 0.75)])
  }
  let d = `L${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i]
    d += `Q${((px + cx) / 2).toFixed(1)} ${py.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`
  }
  return d
}

/* ------------------------------------------------------------------ defs */
let defsDone = false
const ensureDefs = (svg) => {
  const defs = el('defs')
  // crumb: fine grain for sponge
  const f = el('filter', { id: 'xs-crumb', x: '-6%', y: '-6%', width: '112%', height: '112%' })
  f.append(
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '3', seed: '7', result: 'n' }),
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '2.2', xChannelSelector: 'R', yChannelSelector: 'G' }),
  )
  // softer wobble for cream
  const f2 = el('filter', { id: 'xs-soft', x: '-8%', y: '-8%', width: '116%', height: '116%' })
  f2.append(
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: '3', result: 'n' }),
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '5', xChannelSelector: 'R', yChannelSelector: 'G' }),
  )
  const grain = el('filter', { id: 'xs-grain' })
  grain.append(
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.8', numOctaves: '4', result: 'n' }),
    el('feColorMatrix', { in: 'n', type: 'saturate', values: '0' }),
  )
  defs.append(f, f2, grain)
  svg.append(defs)
}

/* ------------------------------------------------------------------ render */
/**
 * @param {HTMLElement} host   container; gets .xs markup written into it
 * @param {object} item        a catalogue item with .layers / .decor / .sideCrumb
 * @param {object} [opts]      { annotate:boolean, animate:boolean }
 */
export function renderSection(host, item, opts = {}) {
  const layers = (item.layers || []).slice()
  if (!layers.length) { host.innerHTML = ''; return null }

  const annotate = opts.annotate !== false && host.clientWidth >= 720
  const rnd = rng(item.id || 1)

  // ---- geometry ----
  const PAD = 16
  const CAKE_W = 250                     // from the cake's centre (left) to the crust (right)
  const ANN_W = annotate ? 300 : 0
  const W = PAD * 2 + CAKE_W + ANN_W
  const total = layers.reduce((s, l) => s + l.h, 0)
  const unit = Math.max(22, Math.min(48, 400 / total))   // px per height unit
  const bodyH = total * unit
  const TOP_PAD = 34                     // room for the dome and the decor
  const H = TOP_PAD + bodyH + 46         // + plate

  const x0 = PAD
  const x1 = PAD + CAKE_W
  const svg = el('svg', {
    viewBox: `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`,
    class: 'xs__svg',
    role: 'img',
    'aria-label': `Разрез: ${item.name}. ${layers.map((l) => l.label).join(', ')}`,
  })
  ensureDefs(svg)

  const gPlate = el('g', { class: 'xs-plate' })
  const gCake = el('g', { class: 'xs-cake' })
  const gAnn = el('g', { class: 'xs-ann' })
  svg.append(gPlate, gCake, gAnn)

  // ---- plate ----
  const baseY = TOP_PAD + bodyH
  gPlate.append(
    el('ellipse', { cx: (x0 + x1) / 2 + 6, cy: baseY + 16, rx: CAKE_W * 0.6, ry: 13, class: 'xs-shadow' }),
    el('path', {
      d: `M${x0 - 14} ${baseY + 4}Q${(x0 + x1) / 2} ${baseY + 30} ${x1 + 14} ${baseY + 4}`,
      class: 'xs-plateline',
    }),
  )

  // ---- bands, bottom (last in list) to top ----
  // the stack is stored bottom-first, and SVG y grows downward, so walk it in reverse
  const bands = []
  let y = TOP_PAD
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    const h = l.h * unit
    bands.push({ ...l, idx: i, y, h, mid: y + h / 2 })
    y += h
  }

  const cut = 3 // the cut face is nudged so the crust reads as a rounded edge
  bands.forEach((b, order) => {
    const g = el('g', { class: 'xs-band', 'data-i': b.idx, tabindex: '0', role: 'button' })
    g.append(el('title', {}))
    g.lastChild.textContent = `${b.role}: ${b.label}`

    const top = b.y
    const bot = b.y + b.h
    const soft = ['cream', 'cheese', 'whipped', 'mousse', 'souffle', 'curd', 'custard', 'caramel-cream'].includes(b.tex)
    const gooey = ['jam', 'gel', 'jelly'].includes(b.tex)
    const crunchy = ['nuts', 'crumb', 'meringue', 'sprinkle', 'macaron', 'marmalade', 'choco'].includes(b.tex)
    const isTopMost = order === bands.length - 1 ? false : order === 0
    const roundR = isTopMost ? Math.min(16, b.h) : 0

    // outer crust curve: the right side of the slice bulges like a real cake wall
    const bulge = gooey ? 7 : soft ? 4 : 2
    let d = `M${x0} ${top}`
    if (gooey) d += waveEdge(x0, x1 - 2, top, 2.4, 7, rnd, 1)
    else if (soft) d += waveEdge(x0, x1 - 2, top, 1.6, 5, rnd, 1)
    else d += `L${x1 - 2} ${top}`
    // right wall
    d += `Q${x1 + bulge} ${(top + bot) / 2} ${x1 - 2} ${bot}`
    // bottom edge back to the centre
    if (gooey) d += waveEdge(x1 - 2, x0, bot, 2.2, 7, rnd, -1)
    else if (soft) d += waveEdge(x1 - 2, x0, bot, 1.4, 5, rnd, -1)
    else d += `L${x0} ${bot}`
    d += 'Z'

    const fill = el('path', { d, fill: b.color, class: 'xs-fill' })
    if (b.tex === 'sponge' || b.tex === 'cocoa' || b.tex === 'honey' || b.tex === 'velvet' || b.tex === 'airy' || b.tex === 'shortcrust' || b.tex === 'puff') {
      fill.setAttribute('filter', 'url(#xs-crumb)')
    } else if (soft) {
      fill.setAttribute('filter', 'url(#xs-soft)')
    }
    g.append(fill)

    // a tone break so bands read as separate slabs
    g.append(el('path', {
      d: `M${x0} ${top}L${x1 - 2} ${top}`, stroke: shade(b.color, isDark(b.color) ? 0.22 : -0.16),
      'stroke-width': 0.9, fill: 'none', opacity: 0.55,
    }))

    // ---------- texture detail ----------
    const inside = (n, fn) => { for (let k = 0; k < n; k++) fn(x0 + 8 + rnd() * (CAKE_W - 18), top + 2.5 + rnd() * Math.max(1, b.h - 5)) }

    if (['sponge', 'cocoa', 'honey', 'velvet', 'airy'].includes(b.tex)) {
      // air pockets
      inside(Math.round(b.h * 1.5), (cx, cy) =>
        g.append(el('ellipse', { cx: cx.toFixed(1), cy: cy.toFixed(1), rx: (0.7 + rnd() * 2.1).toFixed(1), ry: (0.6 + rnd() * 1.7).toFixed(1), fill: shade(b.color, isDark(b.color) ? 0.18 : -0.13), opacity: (0.3 + rnd() * 0.4).toFixed(2) })))
    }
    if (b.tex === 'poppy' || b.tex === 'raisin' || b.tex === 'walnut' || b.tex === 'apricot-bits') {
      const bits = { poppy: '#3a3340', raisin: '#5c3b2e', walnut: '#a9763f', 'apricot-bits': '#e0902f' }[b.tex]
      inside(Math.round(b.h * (b.tex === 'poppy' ? 5 : 1.4)), (cx, cy) =>
        g.append(el('ellipse', { cx: cx.toFixed(1), cy: cy.toFixed(1), rx: (b.tex === 'poppy' ? 0.7 : 1.7 + rnd() * 1.6).toFixed(1), ry: (b.tex === 'poppy' ? 0.6 : 1.3 + rnd() * 1.2).toFixed(1), fill: bits, opacity: 0.8 })))
    }
    if (b.tex === 'shortcrust' || b.tex === 'puff') {
      // flaky striations
      for (let k = 1; k < 4; k++) {
        const yy = top + (b.h * k) / 4
        g.append(el('path', { d: `M${x0 + 2} ${yy.toFixed(1)}${waveEdge(x0 + 2, x1 - 4, yy, 0.9, 6, rnd)}`, stroke: shade(b.color, -0.18), 'stroke-width': 0.8, fill: 'none', opacity: 0.6 }))
      }
    }
    if (b.tex === 'cheese' || b.tex === 'whipped' || b.tex === 'mousse' || b.tex === 'souffle') {
      inside(Math.round(b.h * 1.1), (cx, cy) =>
        g.append(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (0.8 + rnd() * 1.6).toFixed(1), fill: '#fff', opacity: (0.4 + rnd() * 0.4).toFixed(2) })))
    }
    if (crunchy) {
      const n = Math.max(4, Math.round(CAKE_W / 22))
      for (let k = 0; k < n; k++) {
        const cx = x0 + 10 + (k + rnd() * 0.7) * ((CAKE_W - 20) / n)
        const cy = top + b.h / 2 + (rnd() - 0.5) * Math.max(1, b.h - 3)
        const r = 1.6 + rnd() * 2.4
        if (b.tex === 'nuts') {
          g.append(el('path', { d: `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}q${r.toFixed(1)} ${(-r * 1.3).toFixed(1)} ${(r * 2).toFixed(1)} 0q${(-r).toFixed(1)} ${(r * 1.25).toFixed(1)} ${(-r * 2).toFixed(1)} 0Z`, fill: shade(b.color, -0.14), opacity: 0.95 }))
        } else if (b.tex === 'meringue') {
          g.append(el('path', { d: `M${(cx - r).toFixed(1)} ${(cy + r * 0.8).toFixed(1)}L${cx.toFixed(1)} ${(cy - r).toFixed(1)}L${(cx + r).toFixed(1)} ${(cy + r * 0.8).toFixed(1)}Z`, fill: '#fff', opacity: 0.9, stroke: '#e8d9bd', 'stroke-width': 0.5 }))
        } else {
          g.append(el('rect', { x: (cx - r).toFixed(1), y: (cy - r * 0.7).toFixed(1), width: (r * 2).toFixed(1), height: (r * 1.4).toFixed(1), rx: 1, fill: shade(b.color, -0.1), opacity: 0.9, transform: `rotate(${(rnd() * 60 - 30).toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})` }))
        }
      }
    }
    // fruit pieces suspended in the jam
    if (gooey && item.fruits?.length) {
      const n = Math.min(5, Math.max(2, Math.round(b.h / 3)))
      for (let k = 0; k < n; k++) {
        const fr = item.fruits[(k + b.idx) % item.fruits.length]
        const cx = x0 + 18 + k * ((CAKE_W - 34) / Math.max(1, n - 1 || 1))
        const cy = top + b.h / 2 + (rnd() - 0.5) * 1.6
        g.append(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: Math.min(3.4, b.h / 2.4).toFixed(1), fill: fr.color, opacity: 0.92 }))
      }
    }

    gCake.append(g)
    b.node = g
  })

  // ---- glaze / frosting over the crust and a domed top ----
  const topBand = bands[0]
  const topIsCoat = ['glaze', 'ganache', 'fondant'].includes(topBand.tex) || topBand.role === 'покрытие'
  const coat = topIsCoat ? topBand : null
  if (coat) {
    // one fat drip rolling over the crust, the way glaze actually behaves on a cut cake
    const drips = el('g', { class: 'xs-drips' })
    const yTopCoat = topBand.y
    const yBotCoat = topBand.y + topBand.h
    const len = 11 + rnd() * 19
    const w = 7 + rnd() * 4
    drips.append(el('path', {
      d: `M${(x1 - w).toFixed(1)} ${yTopCoat.toFixed(1)}`
        + `L${(x1 + 3).toFixed(1)} ${yTopCoat.toFixed(1)}`
        + `Q${(x1 + 5).toFixed(1)} ${(yBotCoat + len * 0.55).toFixed(1)} ${(x1 - w * 0.35).toFixed(1)} ${(yBotCoat + len).toFixed(1)}`
        + `Q${(x1 - w * 1.05).toFixed(1)} ${(yBotCoat + len * 0.5).toFixed(1)} ${(x1 - w).toFixed(1)} ${yBotCoat.toFixed(1)}Z`,
      fill: coat.color, opacity: 0.97,
    }))
    // a second, shorter one a little further in
    const len2 = 7 + rnd() * 12
    const x2 = x1 - w - 14 - rnd() * 26
    drips.append(el('path', {
      d: `M${x2.toFixed(1)} ${yBotCoat.toFixed(1)}`
        + `q${(6).toFixed(1)} ${(len2 * 1.1).toFixed(1)} ${(11).toFixed(1)} 0Z`,
      fill: coat.color, opacity: 0.92,
    }))
    gCake.append(drips)
  }

  // side crumb coating on the crust
  if (item.sideCrumb) {
    const g = el('g', { class: 'xs-sidecrumb' })
    for (let k = 0; k < 46; k++) {
      const t = rnd()
      const yy = TOP_PAD + 4 + t * (bodyH - 8)
      g.append(el('circle', { cx: (x1 - 1 + rnd() * 5).toFixed(1), cy: yy.toFixed(1), r: (0.9 + rnd() * 1.5).toFixed(1), fill: item.sideCrumb.color, opacity: (0.6 + rnd() * 0.4).toFixed(2) }))
    }
    gCake.append(g)
  }

  // decor sitting on top
  if (item.decor?.length) {
    const g = el('g', { class: 'xs-decor' })
    const n = Math.min(7, 3 + item.decor.length)
    for (let k = 0; k < n; k++) {
      const dec = item.decor[k % item.decor.length]
      const cx = x0 + 26 + k * ((CAKE_W - 50) / Math.max(1, n - 1))
      const r = 3.4 + rnd() * 3
      const cy = TOP_PAD - r + 1.5
      if (dec.tex === 'meringue') {
        g.append(el('path', { d: `M${(cx - r).toFixed(1)} ${(cy + r).toFixed(1)}Q${cx.toFixed(1)} ${(cy - r * 2.1).toFixed(1)} ${(cx + r).toFixed(1)} ${(cy + r).toFixed(1)}Z`, fill: '#fffdf6', stroke: '#eadbbe', 'stroke-width': 0.6 }))
      } else if (dec.tex === 'macaron') {
        g.append(el('rect', { x: (cx - r * 1.2).toFixed(1), y: (cy - r * 0.7).toFixed(1), width: (r * 2.4).toFixed(1), height: (r * 1.5).toFixed(1), rx: r * 0.7, fill: dec.color }))
      } else {
        g.append(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: r.toFixed(1), fill: dec.color }))
      }
    }
    gCake.append(g)
  }

  // ---- the cut line: this is a *cut* through a cake, say so ----
  gCake.append(el('path', {
    d: `M${x0} ${TOP_PAD - 6}L${x0} ${baseY + 3}`, class: 'xs-axis',
  }))

  // ---------------------------------------------------------- annotation
  const labelRows = []
  if (annotate) {
    // one label per distinct component, anchored to its topmost band
    const seen = new Map()
    for (const b of bands) if (!seen.has(b.label)) seen.set(b.label, b)
    const targets = [...seen.values()].sort((a, b) => a.mid - b.mid)

    const LH = 32
    let ys = targets.map((t) => t.mid)
    // push apart so no two labels collide, then keep them inside the frame
    for (let pass = 0; pass < 60; pass++) {
      let moved = false
      for (let i = 1; i < ys.length; i++) {
        const gap = ys[i] - ys[i - 1]
        if (gap < LH) { const d = (LH - gap) / 2; ys[i - 1] -= d; ys[i] += d; moved = true }
      }
      ys[0] = Math.max(TOP_PAD - 8, ys[0])
      ys[ys.length - 1] = Math.min(H - 26, ys[ys.length - 1])
      if (!moved) break
    }

    const lx = x1 + 64
    targets.forEach((t, i) => {
      const yy = ys[i]
      const g = el('g', { class: 'xs-label', 'data-i': t.idx, tabindex: '0' })
      g.append(el('path', {
        d: `M${x1 + 4} ${t.mid.toFixed(1)}L${(x1 + 30).toFixed(1)} ${t.mid.toFixed(1)}L${(lx - 10).toFixed(1)} ${yy.toFixed(1)}L${lx.toFixed(1)} ${yy.toFixed(1)}`,
        class: 'xs-leader',
      }))
      g.append(el('circle', { cx: x1 + 4, cy: t.mid.toFixed(1), r: 2.6, class: 'xs-dot', fill: t.color }))
      const role = el('text', { x: lx + 6, y: (yy - 6).toFixed(1), class: 'xs-role' })
      role.textContent = t.role
      const name = el('text', { x: lx + 6, y: (yy + 10).toFixed(1), class: 'xs-name' })
      name.textContent = t.label
      g.append(role, name)
      gAnn.append(g)
      labelRows.push({ node: g, idx: t.idx, label: t.label })
    })
  }

  // ---------------------------------------------------------- mount + wiring
  host.innerHTML = ''
  const frame = document.createElement('div')
  frame.className = 'xs'
  frame.append(svg)
  host.append(frame)

  if (!annotate) {
    // small screens get a tappable legend instead of leader lines
    const seen = new Map()
    for (const b of bands) if (!seen.has(b.label)) seen.set(b.label, b)
    const ul = document.createElement('ul')
    ul.className = 'xs__legend'
    for (const b of [...seen.values()].sort((a, b) => a.mid - b.mid)) {
      const li = document.createElement('li')
      li.dataset.i = b.idx
      li.innerHTML = `<i style="background:${b.color}"></i><span><em>${b.role}</em>${b.label}</span>`
      ul.append(li)
      labelRows.push({ node: li, idx: b.idx, label: b.label })
    }
    frame.append(ul)
  }

  const byLabel = (label) => bands.filter((b) => b.label === label)
  const focus = (label) => {
    frame.dataset.focus = label ? '1' : ''
    for (const b of bands) b.node.classList.toggle('is-on', !!label && b.label === label)
    for (const r of labelRows) r.node.classList.toggle('is-on', !!label && r.label === label)
  }
  const bind = (node, label) => {
    node.addEventListener('pointerenter', () => focus(label))
    node.addEventListener('pointerleave', () => focus(null))
    node.addEventListener('focus', () => focus(label))
    node.addEventListener('blur', () => focus(null))
    node.addEventListener('click', () => focus(frame.dataset.focus && node.classList.contains('is-on') ? null : label))
  }
  for (const b of bands) bind(b.node, b.label)
  for (const r of labelRows) bind(r.node, r.label)

  if (opts.animate !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Staged reveal through the Web Animations API rather than a CSS class: the
    // element's own style stays visible, so if the animation is throttled, frozen or
    // unsupported the layers are simply there. The timer below is the belt-and-braces.
    const anims = []
    const play = (node, delay) => {
      if (!node.animate) return
      anims.push(node.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' },
      ))
    }
    bands.forEach((b, i) => play(b.node, i * 50))
    labelRows.forEach((r, i) => play(r.node, 260 + i * 45))
    setTimeout(() => {
      for (const a of anims) if (a.playState !== 'finished') a.cancel()
    }, 1800)
  }

  return { svg, bands, focus, layerCount: layers.length }
}

/* A tiny standalone "chip" version for cards: just the coloured stack, no labels. */
export function renderStackChip(host, item, { h = 40 } = {}) {
  const layers = item.layers || []
  if (!layers.length) { host.innerHTML = ''; return }
  const total = layers.reduce((s, l) => s + l.h, 0)
  host.innerHTML = ''
  host.className = (host.className + ' stackchip').trim()
  host.style.setProperty('--h', h + 'px')
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    const d = document.createElement('i')
    d.style.background = l.color
    d.style.flex = `${l.h / total}`
    d.title = `${l.role}: ${l.label}`
    host.append(d)
  }
}
