/* cake3d.js — a spinnable, cuttable cake built from the real recipe.

   No WebGL and no libraries: the cake is painted as a stack of cylinders in an
   axonometric projection. Every angular strip is shaded by its own surface normal,
   which is what makes a flat canvas read as a round cake. Cutting the wedge out
   exposes two radial faces showing the actual layer stack, and the removed slice
   lands on the plate beside it. Drag to spin, click to cut. */

const TAU = Math.PI * 2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const ease = (t) => 1 - Math.pow(1 - t, 3)

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lit = (hex, k) => {
  const [r, g, b] = rgb(hex)
  const f = (v) => clamp(Math.round(v * k), 0, 255)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}
const rng = (seed) => {
  let s = seed >>> 0 || 7
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

// light from the upper left, slightly toward the viewer
const LX = -0.52, LZ = 0.62
const faceLight = (ang) => 0.62 + 0.46 * Math.max(0, Math.cos(ang) * LX + Math.sin(ang) * LZ)

export class Cake3D {
  constructor(canvas, item, opts = {}) {
    this.cv = canvas
    this.ctx = canvas.getContext('2d')
    this.opts = { squash: 0.34, wedge: 58, autospin: true, spinDelay: 1400, spinSpeed: 0.00016, ...opts }
    this.yaw = -0.5
    this.spin = 0
    this.wedgeAt = 0        // where the wedge sits on the cake, in cake-local radians
    this.cut = 0            // 0 = whole, 1 = wedge fully removed
    this.cutTarget = opts.open ? 1 : 0
    if (opts.open) this.wedgeAt = Math.PI / 2 - ((this.opts.wedge * Math.PI) / 180) / 2 - this.yaw
    this.hover = -1         // index into item.layers
    this.focusLabel = null
    this.dragging = false
    this.idle = 0
    this.setItem(item)
    this._bind()
    this._resize()
    this._ro = new ResizeObserver(() => this._resize())
    this._ro.observe(canvas.parentElement || canvas)
    this._loop = this._loop.bind(this)
    this._raf = requestAnimationFrame(this._loop)
  }

  setItem(item) {
    this.item = item
    const layers = (item?.layers || [])
    // bottom-first, with cumulative heights
    let acc = 0
    this.stack = layers.map((l, i) => {
      const o = { ...l, i, y0: acc, y1: acc + l.h }
      acc += l.h
      return o
    })
    this.total = acc || 1
    this.rnd = rng(item?.id || 1)
    this.crumbs = Array.from({ length: 18 }, () => ({
      a: this.rnd() * TAU, r: 0.72 + this.rnd() * 0.5, s: 1 + this.rnd() * 2.2, c: this.rnd(),
    }))
    this.dirty = true
  }

  destroy() { cancelAnimationFrame(this._raf); this._ro?.disconnect() }

  toggleCut() {
    const opening = this.cutTarget <= 0.5
    if (opening) {
      // cut where the viewer is looking, so the interior is never revealed out of sight
      const span = (this.opts.wedge * Math.PI) / 180
      this.wedgeAt = Math.PI / 2 - span / 2 - this.yaw
    }
    this.cutTarget = opening ? 1 : 0
    this.idle = 0
    this.dirty = true
  }
  setFocus(label) { this.focusLabel = label || null; this.dirty = true }

  /* ------------------------------------------------------------ input */
  _bind() {
    const c = this.cv
    let px = 0, moved = 0
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true; px = e.clientX; moved = 0
      c.setPointerCapture?.(e.pointerId); this.idle = 0
    })
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect()
      this._pointer = [e.clientX - r.left, e.clientY - r.top]
      if (this.dragging) {
        const dx = e.clientX - px
        px = e.clientX
        moved += Math.abs(dx)
        this.yaw += dx * 0.011
        this.spin = dx * 0.011
        this.idle = 0
        this.dirty = true
      } else {
        this._hit()
      }
    })
    const up = () => { this.dragging = false; if (moved < 5) this.toggleCut() }
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', () => { this.dragging = false })
    c.addEventListener('pointerleave', () => {
      this._pointer = null
      if (this.hover !== -1) { this.hover = -1; this.dirty = true; this._emit(null) }
    })
    c.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { this.yaw -= 0.22; this.idle = 0; this.dirty = true }
      else if (e.key === 'ArrowRight') { this.yaw += 0.22; this.idle = 0; this.dirty = true }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggleCut() }
      else return
      e.preventDefault()
    })
    c.tabIndex = 0
  }

  _emit(layer) {
    this.cv.dispatchEvent(new CustomEvent('cake:layer', { detail: layer, bubbles: true }))
  }

  // which layer is the pointer over? approximate but reads as exact
  _hit() {
    if (!this._pointer || !this.geo) return
    const [mx, my] = this._pointer
    const { cx, baseY, R, unit, k } = this.geo
    const dx = (mx - cx) / R
    if (Math.abs(dx) > 1.05) { if (this.hover !== -1) { this.hover = -1; this.dirty = true; this._emit(null) } return }
    const yTop = baseY - this.total * unit
    if (my < yTop - R * k - 8 || my > baseY + R * k + 8) {
      if (this.hover !== -1) { this.hover = -1; this.dirty = true; this._emit(null) }
      return
    }
    const hUnits = (baseY - my) / unit
    const hit = this.stack.find((l) => hUnits >= l.y0 && hUnits < l.y1)
    const idx = hit ? hit.i : -1
    if (idx !== this.hover) {
      this.hover = idx
      this.dirty = true
      this._emit(hit ? { label: hit.label, role: hit.role, color: hit.color, i: idx } : null)
    }
  }

  /* ------------------------------------------------------------ sizing */
  _resize() {
    const box = this.cv.parentElement?.getBoundingClientRect() || this.cv.getBoundingClientRect()
    const w = Math.max(220, Math.floor(box.width))
    const h = Math.max(200, Math.floor(box.height || w * 0.85))
    const dpr = Math.min(2.5, window.devicePixelRatio || 1)
    this.cv.width = Math.floor(w * dpr)
    this.cv.height = Math.floor(h * dpr)
    this.cv.style.width = w + 'px'
    this.cv.style.height = h + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.w = w; this.h = h
    this.dirty = true
  }

  /* ------------------------------------------------------------ loop */
  _loop(t) {
    const dt = Math.min(48, t - (this._t || t)); this._t = t
    if (Math.abs(this.cutTarget - this.cut) > 0.001) {
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      this.cut = still ? this.cutTarget : this.cut + (this.cutTarget - this.cut) * Math.min(1, dt / 190)
      this.dirty = true
    }
    if (this.dragging) { /* user drives */ }
    else {
      if (Math.abs(this.spin) > 0.0002) { this.yaw += this.spin; this.spin *= 0.93; this.dirty = true }
      else {
        this.idle += dt
        if (this.opts.autospin && this.idle >= this.opts.spinDelay && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.yaw += dt * this.opts.spinSpeed
          this.dirty = true
        }
      }
    }
    if (this.dirty) { this.draw(); this.dirty = false }
    this._raf = requestAnimationFrame(this._loop)
  }

  /* ------------------------------------------------------------ paint */
  draw() {
    const ctx = this.ctx
    const { w, h } = this
    ctx.clearRect(0, 0, w, h)
    if (!this.stack.length) return

    const k = this.opts.squash
    const wedgeSpan = (this.opts.wedge * Math.PI) / 180
    const cutOut = ease(clamp(this.cut, 0, 1))

    // fit the cake (plus the slice on the plate) into the frame
    const R = Math.min(w * 0.3, h / (2 * k + 1.45) * 0.82)
    const unit = Math.min(R * 0.235, (h * 0.52) / this.total)
    const bodyH = this.total * unit
    const cx = w * (cutOut > 0.02 ? 0.42 : 0.5)
    const baseY = h * 0.5 + bodyH * 0.34 + R * k * 0.2
    this.geo = { cx, baseY, R, unit, k }

    // ---------------- plate ----------------
    ctx.save()
    ctx.translate(cx, baseY + 6)
    ctx.scale(1, k)
    const pr = R * 1.42
    const gl = ctx.createRadialGradient(0, 0, pr * 0.2, 0, 0, pr)
    gl.addColorStop(0, 'rgba(63,35,23,.20)')
    gl.addColorStop(1, 'rgba(63,35,23,0)')
    ctx.fillStyle = gl
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.fill()
    ctx.restore()

    // ---------------- the cake body ----------------
    const a0 = this.yaw + this.wedgeAt           // wedge boundary A
    const a1 = a0 + wedgeSpan                    // wedge boundary B
    const open = cutOut > 0.02
    const notchMid = a0 + wedgeSpan / 2
    // when the notch has spun to the back you simply see the outer wall — no faces
    const notchFront = Math.sin(notchMid) > -0.12

    const inNotch = (ang) => {
      if (!open || !notchFront) return false
      let d = ((ang - a0) % TAU + TAU) % TAU
      return d < wedgeSpan
    }

    const N = 108
    const step = TAU / N
    // front-facing strips only, painted far → near
    const strips = []
    for (let i = 0; i < N; i++) {
      const ang = i * step
      const mid = ang + step / 2
      if (Math.sin(mid) <= 0) continue
      if (inNotch(mid)) continue
      strips.push({ ang, mid, depth: Math.sin(mid) })
    }
    strips.sort((a, b) => a.depth - b.depth)

    const dim = (l) => {
      if (this.focusLabel) return l.label === this.focusLabel ? 1.1 : 0.55
      if (this.hover >= 0) return l.i === this.hover ? 1.12 : 0.72
      return 1
    }

    // interior radial faces, drawn before the wall so the notch has depth
    if (open && notchFront) {
      // Each cut face looks into the empty wedge. At a0 the cake material lies at
      // smaller angles, so that face points along +angle (normal a0 + 90°); at a1 it
      // points the other way. A face is visible when its normal leans toward the viewer,
      // i.e. when sin(normal) > 0 — which reduces to cos(a0) > 0 and cos(a1) < 0.
      const faces = [
        { ang: a0, vis: Math.cos(a0) > 0, n: a0 + Math.PI / 2 },
        { ang: a1, vis: Math.cos(a1) < 0, n: a1 - Math.PI / 2 },
      ].filter((f) => f.vis)
      // far face first
      faces.sort((f, g) => Math.sin(f.n) - Math.sin(g.n))
      for (const f of faces) {
        const ca = Math.cos(f.ang), sa = Math.sin(f.ang)
        const brightness = 0.72 + 0.4 * Math.max(0, Math.cos(f.n) * LX + Math.sin(f.n) * LZ)
        for (const l of this.stack) {
          const yb = baseY - l.y0 * unit
          const yt = baseY - l.y1 * unit
          // axis point (r = 0) and rim point (r = R)
          const axX = cx, axYb = yb, axYt = yt
          const rimX = cx + R * ca, rimYb = yb + R * k * sa, rimYt = yt + R * k * sa
          ctx.beginPath()
          ctx.moveTo(axX, axYt); ctx.lineTo(rimX, rimYt)
          ctx.lineTo(rimX, rimYb); ctx.lineTo(axX, axYb)
          ctx.closePath()
          ctx.fillStyle = lit(l.color, brightness * dim(l))
          ctx.fill()
        }
        // the cut edge catches the light
        ctx.beginPath()
        ctx.moveTo(cx, baseY - this.total * unit)
        ctx.lineTo(cx + R * ca, baseY - this.total * unit + R * k * sa)
        ctx.strokeStyle = 'rgba(255,255,255,.28)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // the outer wall. Strips overlap by a quarter step: butt-joined quads leave
    // hairline seams where the canvas antialiases each edge separately.
    const over = step * 1.3
    for (const s of strips) {
      const b = faceLight(s.mid)
      const c0 = Math.cos(s.ang), s0 = Math.sin(s.ang)
      const c1 = Math.cos(s.ang + over), s1 = Math.sin(s.ang + over)
      for (const l of this.stack) {
        const yb = baseY - l.y0 * unit
        const yt = baseY - l.y1 * unit
        ctx.beginPath()
        ctx.moveTo(cx + R * c0, yt + R * k * s0)
        ctx.lineTo(cx + R * c1, yt + R * k * s1)
        ctx.lineTo(cx + R * c1, yb + R * k * s1)
        ctx.lineTo(cx + R * c0, yb + R * k * s0)
        ctx.closePath()
        ctx.fillStyle = lit(l.color, b * dim(l))
        ctx.fill()
      }
    }

    // ---------------- top surface (pie with the notch taken out) ----------------
    const topL = this.stack[this.stack.length - 1]
    const yTop = baseY - this.total * unit
    ctx.beginPath()
    if (open && notchFront) {
      ctx.moveTo(cx, yTop)
      const from = a1, to = a0 + TAU
      const segs = Math.max(8, Math.round(((to - from) / TAU) * N))
      for (let i = 0; i <= segs; i++) {
        const ang = from + ((to - from) * i) / segs
        ctx.lineTo(cx + R * Math.cos(ang), yTop + R * k * Math.sin(ang))
      }
      ctx.closePath()
    } else {
      ctx.ellipse(cx, yTop, R, R * k, 0, 0, TAU)
    }
    const tg = ctx.createLinearGradient(cx - R, yTop - R * k, cx + R, yTop + R * k)
    tg.addColorStop(0, lit(topL.color, 1.16 * dim(topL)))
    tg.addColorStop(1, lit(topL.color, 0.86 * dim(topL)))
    ctx.fillStyle = tg
    ctx.fill()

    // decor on top
    const decor = this.item.decor || []
    if (decor.length) {
      for (let i = 0; i < this.crumbs.length; i++) {
        const cr = this.crumbs[i]
        const ang = cr.a + this.yaw
        const rr = cr.r * R * 0.52
        const x = cx + rr * Math.cos(ang)
        const yy = yTop + rr * k * Math.sin(ang) - cr.s * 0.7
        if (rr > R * 0.92) continue
        const d = decor[i % decor.length]
        ctx.beginPath()
        ctx.ellipse(x, yy, cr.s * 1.5, cr.s * 1.5 * (0.55 + k * 0.5), 0, 0, TAU)
        ctx.fillStyle = lit(d.color, 1.02)
        ctx.fill()
      }
    }

    // glaze dripping over the rim, if the cake is finished with one
    if (['glaze', 'ganache', 'fondant'].includes(topL.tex)) {
      const yb = baseY - this.stack[this.stack.length - 1].y0 * unit
      // a handful of wide, rounded drips — not a comb of spikes
      for (const s of strips) {
        const seed = Math.abs(Math.sin(Math.round(s.ang / step) * 12.9898 + (this.item.id || 1)))
        if (seed < 0.86) continue
        const len = (0.5 + seed * 0.9) * unit * 1.6
        const w = R * 0.085 * (0.8 + seed * 0.6)
        const x = cx + R * Math.cos(s.mid)
        const yy = yb + R * k * Math.sin(s.mid)
        ctx.beginPath()
        ctx.moveTo(x - w, yy - 1)
        ctx.bezierCurveTo(x - w, yy + len, x + w, yy + len, x + w, yy - 1)
        ctx.closePath()
        ctx.fillStyle = lit(topL.color, faceLight(s.mid) * 0.98)
        ctx.fill()
      }
    }

    // ---------------- the removed slice, on the plate ----------------
    if (open) {
      const sx = cx + R * (1.15 + 0.55 * cutOut)
      const sy = baseY + 2 - (1 - cutOut) * 26
      this._wedge(ctx, sx, sy, R * 0.92, unit, k, wedgeSpan, cutOut)
    }

    // ---------------- the "cut me" affordance ----------------
    if (!open && this.opts.hint !== false) {
      ctx.save()
      ctx.globalAlpha = 0.5 + 0.22 * Math.sin(this._t / 420)
      ctx.strokeStyle = 'rgba(168,18,54,.9)'
      ctx.setLineDash([5, 5])
      ctx.lineWidth = 1.4
      const ha = this.yaw + this.wedgeAt + wedgeSpan / 2
      ctx.beginPath()
      ctx.moveTo(cx, yTop)
      ctx.lineTo(cx + R * Math.cos(ha), yTop + R * k * Math.sin(ha))
      ctx.stroke()
      ctx.restore()
    }
  }

  // the slice standing on its side next to the cake, cut faces toward the viewer
  _wedge(ctx, x, y, R, unit, k, span, t) {
    const a = -0.55, b = a + span * 1.25
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b)
    ctx.save()
    ctx.globalAlpha = clamp(t * 1.6, 0, 1)
    ctx.translate(0, (1 - t) * 10)

    // shadow under the slice
    ctx.save()
    ctx.translate(x + R * 0.32, y + 4); ctx.scale(1, k)
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.7)
    g.addColorStop(0, 'rgba(63,35,23,.24)'); g.addColorStop(1, 'rgba(63,35,23,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.fill()
    ctx.restore()

    for (const l of this.stack) {
      const yb = y - l.y0 * unit
      const yt = y - l.y1 * unit
      const dimf = this.focusLabel ? (l.label === this.focusLabel ? 1.12 : 0.58)
        : this.hover === l.i ? 1.12 : 1
      // the big flat cut face — this is the part people want to look at
      ctx.beginPath()
      ctx.moveTo(x, yt)
      ctx.lineTo(x + R * ca, yt + R * k * sa)
      ctx.lineTo(x + R * ca, yb + R * k * sa)
      ctx.lineTo(x, yb)
      ctx.closePath()
      ctx.fillStyle = lit(l.color, 1.06 * dimf)
      ctx.fill()
      // the curved crust of the slice
      const segs = 10
      ctx.beginPath()
      ctx.moveTo(x + R * ca, yt + R * k * sa)
      for (let i = 1; i <= segs; i++) {
        const ang = a + ((b - a) * i) / segs
        ctx.lineTo(x + R * Math.cos(ang), yt + R * k * Math.sin(ang))
      }
      for (let i = segs; i >= 0; i--) {
        const ang = a + ((b - a) * i) / segs
        ctx.lineTo(x + R * Math.cos(ang), yb + R * k * Math.sin(ang))
      }
      ctx.closePath()
      ctx.fillStyle = lit(l.color, 0.78 * dimf)
      ctx.fill()
      // second cut face, in shade
      ctx.beginPath()
      ctx.moveTo(x, yt); ctx.lineTo(x + R * cb, yt + R * k * sb)
      ctx.lineTo(x + R * cb, yb + R * k * sb); ctx.lineTo(x, yb)
      ctx.closePath()
      ctx.fillStyle = lit(l.color, 0.66 * dimf)
      ctx.fill()
    }

    // the slice's top
    const topL = this.stack[this.stack.length - 1]
    const yTop = y - this.total * unit
    ctx.beginPath()
    ctx.moveTo(x, yTop)
    for (let i = 0; i <= 12; i++) {
      const ang = a + ((b - a) * i) / 12
      ctx.lineTo(x + R * Math.cos(ang), yTop + R * k * Math.sin(ang))
    }
    ctx.closePath()
    ctx.fillStyle = lit(topL.color, 1.2)
    ctx.fill()
    ctx.restore()
  }
}

export default Cake3D
