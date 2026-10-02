/* cake-gl.js — the cake as a real object: WebGL, light, shadow, gloss.

   Same recipe, same contract as cake3d.js (constructor, setItem, toggleCut, setFocus,
   destroy, the cake:layer event), so a page can use either. What it adds is what
   makes a cake look like a cake rather than a diagram:

   - the outside is what you would see on the counter. Layers are only visible where
     the cake is cut; the sides wear the frosting (role «обмазка») and the finish
     («покрытие») on top of it, in that order, with their real thickness. A cake with
     no frosting stays naked and shows its layers, as such cakes do.
   - each texture gets a material: sponge is matte and porous, cream is satin, jam and
     glaze are glossy, glaze drips over the rim.
   - decor comes from the recipe (decor[]). Piping, berries and an inscription exist,
     but only when the page asks for them: the catalogue never says a cake has roses,
     so the magazine does not invent them.

   Geometry is built by hand in cake-local coordinates with x = r·sinθ, z = r·cosθ
   (three's own cylinder convention), as two groups: the body and the slice. Cutting
   slides the slice out; the two share their cut faces, so whole, it is seamless. */

import * as T from './vendor/three.min.js'

const TAU = Math.PI * 2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const ease = (t) => 1 - Math.pow(1 - t, 3)
const rng = (seed) => {
  let s = seed >>> 0 || 7
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const R = 1                // cake radius
const BOARD = 0.035        // the cake board it stands on
const COAT_ROLES = new Set(['обмазка', 'покрытие'])
const GLOSSY = new Set(['glaze', 'ganache', 'choco'])
const SATIN = new Set(['cream', 'whipped', 'cheese', 'custard', 'caramel-cream', 'mousse', 'souffle', 'curd'])
const WET = new Set(['jam', 'gel', 'jelly'])
const BAKED = new Set(['sponge', 'velvet', 'honey', 'shortcrust', 'cocoa', 'puff', 'airy'])

/* ------------------------------------------------------------------ textures */
// one small grey noise per kind, used as a bump map: pores for sponge, specks for crumb
const noiseCache = new Map()
function noise(kind) {
  if (noiseCache.has(kind)) return noiseCache.get(kind)
  const n = 256, cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d')
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n)
  const r = rng(kind.length * 97 + 13)
  if (kind === 'streak' || kind === 'tint') {
    // A palette knife leaves long, soft, mostly horizontal strokes on frosting. They are
    // drawn on a 3×3 sheet, every stroke in all nine tiles, and the blur runs over the
    // whole sheet; the middle tile then wraps onto itself with no seam on any edge.
    const big = document.createElement('canvas')
    big.width = big.height = n * 3
    const b = big.getContext('2d')
    b.fillStyle = kind === 'tint' ? '#f4f4f4' : '#808080'; b.fillRect(0, 0, n * 3, n * 3)
    b.filter = 'blur(1.4px)'
    for (let i = 0; i < 160; i++) {
      const y = r() * n, x = r() * n, len = 40 + r() * 180, th = 1 + r() * 5
      const v = kind === 'tint' ? 225 + r() * 30 : 95 + r() * 75
      const w1 = (r() - 0.5) * 6, w2 = (r() - 0.5) * 6, w3 = (r() - 0.5) * 4
      b.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.5})`
      b.lineWidth = th
      for (let tx = 0; tx < 3; tx++) for (let ty = 0; ty < 3; ty++) {
        const ox = x + tx * n, oy = y + ty * n
        b.beginPath(); b.moveTo(ox, oy); b.bezierCurveTo(ox + len / 3, oy + w1, ox + (2 * len) / 3, oy + w2, ox + len, oy + w3)
        b.stroke()
      }
    }
    // strokes are shorter than a tile, so the middle one sees the same neighbours on
    // every side: crop it
    g.drawImage(big, n, n, n, n, 0, 0, n, n)
  }
  const dots = kind === 'pores' ? 2600 : kind === 'crumb' ? 1800 : kind === 'streak' || kind === 'tint' ? 0 : 900
  for (let i = 0; i < dots; i++) {
    const x = r() * n, y = r() * n
    const s = kind === 'pores' ? 0.6 + r() * 2.2 : kind === 'crumb' ? 1 + r() * 3 : 0.5 + r() * 1.2
    const v = kind === 'pores' ? 40 + r() * 60 : 90 + r() * 120
    g.fillStyle = `rgb(${v},${v},${v})`
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill()
  }
  const t = new T.CanvasTexture(cv)
  t.wrapS = t.wrapT = T.RepeatWrapping
  if (kind === 'tint') t.colorSpace = T.SRGBColorSpace
  noiseCache.set(kind, t)
  return t
}

function material(tex, color) {
  const c = new T.Color(color)
  if (GLOSSY.has(tex)) {
    return new T.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, bumpMap: noise('streak'), bumpScale: 0.25 })
  }
  if (WET.has(tex)) return new T.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.2 })
  // fondant is rolled, not spread: smooth, a soft sheen, no knife marks
  if (tex === 'fondant') return new T.MeshPhysicalMaterial({ color: c, roughness: 0.42, sheen: 0.3, sheenRoughness: 0.5, map: noise('tint') })
  if (SATIN.has(tex)) {
    return new T.MeshPhysicalMaterial({
      color: c, map: noise('tint'), roughness: 0.58, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new T.Color('#fff8f0'),
      bumpMap: noise('streak'), bumpScale: 1.1,
    })
  }
  if (BAKED.has(tex)) return new T.MeshStandardMaterial({ color: c, roughness: 0.92, bumpMap: noise('pores'), bumpScale: 3 })
  return new T.MeshStandardMaterial({ color: c, roughness: 0.85, bumpMap: noise('crumb'), bumpScale: 3 })
}

/* ------------------------------------------------------------------ geometry */
const P = (r, y, t) => [r * Math.sin(t), y, r * Math.cos(t)]

function geo(pos, nor, uv, idx) {
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// the outside of a cylinder between angles t0..t1
function wall(r, y0, y1, t0, t1) {
  const seg = Math.max(6, Math.ceil(((t1 - t0) / TAU) * 128))
  const pos = [], nor = [], uv = [], idx = []
  // a whole number of texture repeats around the cake, or the knife marks show a seam
  const reps = Math.round(TAU * r * 1.5)
  for (let i = 0; i <= seg; i++) {
    const t = t0 + ((t1 - t0) * i) / seg
    for (const y of [y0, y1]) {
      pos.push(...P(r, y, t)); nor.push(Math.sin(t), 0, Math.cos(t)); uv.push((t / TAU) * reps, y * 1.5)
    }
    if (i < seg) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  }
  return geo(pos, nor, uv, idx)
}

// a flat ring sector facing up; uv is planar over the whole top so an inscription
// drawn on one texture lines up across the body and the slice
function cap(r0, r1, y, t0, t1) {
  const seg = Math.max(6, Math.ceil(((t1 - t0) / TAU) * 128))
  const pos = [], nor = [], uv = [], idx = []
  for (let i = 0; i <= seg; i++) {
    const t = t0 + ((t1 - t0) * i) / seg
    for (const r of [r0, r1]) {
      const [x, , z] = P(r, y, t)
      pos.push(x, y, z); nor.push(0, 1, 0); uv.push(0.5 + x / (2 * R), 0.5 - z / (2 * R))
    }
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  return geo(pos, nor, uv, idx)
}

// a cut face: the rectangle r0..r1 × y0..y1 standing on the radius at angle t.
// `start` faces close a solid that continues toward larger angles.
function face(t, r0, r1, y0, y1, start) {
  const n = start ? [-Math.cos(t), 0, Math.sin(t)] : [Math.cos(t), 0, -Math.sin(t)]
  const pos = [...P(r0, y0, t), ...P(r1, y0, t), ...P(r1, y1, t), ...P(r0, y1, t)]
  const uv = [r0 * 1.5, y0 * 1.5, r1 * 1.5, y0 * 1.5, r1 * 1.5, y1 * 1.5, r0 * 1.5, y1 * 1.5]
  const idx = start ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
  return geo(pos, [...n, ...n, ...n, ...n], uv, idx)
}

// a piped rosette: a lathe dollop with star-tip ridges twisted into it
function rosetteGeo() {
  const pts = [[0.001, 0], [0.078, 0], [0.085, 0.02], [0.074, 0.05], [0.055, 0.08], [0.03, 0.105], [0.012, 0.125], [0.001, 0.135]]
    .map(([x, y]) => new T.Vector2(x, y))
  const g = new T.LatheGeometry(pts, 48)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const a = Math.atan2(z, x)
    const k = 1 + 0.2 * Math.sin(8 * a + y * 46)
    p.setXYZ(i, x * k, y, z * k)
  }
  g.computeVertexNormals()
  return g
}

function kissGeo() {
  const pts = [[0.001, 0], [0.06, 0], [0.058, 0.03], [0.04, 0.065], [0.018, 0.1], [0.001, 0.13]].map(([x, y]) => new T.Vector2(x, y))
  return new T.LatheGeometry(pts, 24)
}

// one berry, sitting on y = 0, cloned around the cake. The shapes are what makes them
// read at a glance: a strawberry is a seeded cone, a raspberry is bumpy, a cherry has
// its stem, currants come in a little bunch.
function berryModel(b) {
  const g = new T.Group()
  const red = new T.MeshPhysicalMaterial({ color: b.color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25 })
  if (b.shape === 'strawberry') {
    const body = new T.LatheGeometry([[0.001, 0.004], [0.05, 0.012], [0.062, 0.035], [0.055, 0.07], [0.035, 0.105], [0.012, 0.128], [0.001, 0.134]]
      .map(([x, y]) => new T.Vector2(x, y)), 24)
    red.bumpMap = noise('pores'); red.bumpScale = 4
    g.add(new T.Mesh(body, red))
    const leaf = new T.Mesh(new T.CylinderGeometry(0.066, 0.02, 0.012, 7), new T.MeshStandardMaterial({ color: '#5f8a3a', roughness: 0.7 }))
    leaf.position.y = 0.006
    g.add(leaf)
  } else if (b.shape === 'raspberry') {
    red.bumpMap = noise('crumb'); red.bumpScale = 8; red.clearcoat = 0.3; red.roughness = 0.55
    const m = new T.Mesh(new T.SphereGeometry(0.042, 24, 18), red)
    m.scale.set(1, 1.18, 1); m.position.y = 0.046
    g.add(m)
  } else if (b.shape === 'cherry') {
    const m = new T.Mesh(new T.SphereGeometry(0.05, 28, 20), red)
    m.position.y = 0.048
    const stem = new T.Mesh(new T.CylinderGeometry(0.0035, 0.0035, 0.1, 6), new T.MeshStandardMaterial({ color: '#6b5a2e', roughness: 0.8 }))
    stem.position.set(0.012, 0.13, 0); stem.rotation.z = -0.35
    g.add(m, stem)
  } else {
    for (const [x, z, y] of [[0, 0, 0.03], [0.045, 0.01, 0.03], [0.02, 0.04, 0.03], [0.022, 0.017, 0.07]]) {
      const m = new T.Mesh(new T.SphereGeometry(0.028, 18, 12), red)
      m.position.set(x - 0.02, y - 0.002, z - 0.017)
      g.add(m)
    }
  }
  return g
}

/* ------------------------------------------------------------------ the cake */
export class CakeGL {
  constructor(canvas, item, opts = {}) {
    this.cv = canvas
    this.opts = { wedge: 58, autospin: true, cuttable: true, piping: false, berries: null, elev: 0.5, ...opts }
    this.yaw = opts.yaw ?? -0.5
    this.spin = 0
    this.cut = 0
    this.cutTarget = opts.open ? 1 : 0
    this.wedgeAt = 0
    this.hover = -1
    this.focusLabel = null
    this.inscription = opts.inscription || null

    const r = (this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }))
    r.outputColorSpace = T.SRGBColorSpace
    r.toneMapping = T.NeutralToneMapping
    r.toneMappingExposure = 1.05
    r.shadowMap.enabled = true
    r.shadowMap.type = T.PCFShadowMap

    this.scene = new T.Scene()
    const pm = new T.PMREMGenerator(r)
    this.envMap = pm.fromScene(new T.RoomEnvironment(), 0.04).texture
    pm.dispose()
    this.scene.environment = this.envMap
    this.scene.environmentIntensity = 0.45

    const key = new T.DirectionalLight('#fff4e8', 2.7)
    key.position.set(-1.8, 6.2, 2.6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = key.shadow.camera.bottom = -2.2
    key.shadow.camera.right = key.shadow.camera.top = 2.2
    key.shadow.radius = 6
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    this.scene.add(key)
    const rim = new T.DirectionalLight('#ffe1ea', 0.7)
    rim.position.set(3, 2, -3)
    this.scene.add(rim)

    // the shadow on the table, and the board the cake stands on
    const ground = new T.Mesh(new T.PlaneGeometry(9, 9), new T.ShadowMaterial({ opacity: 0.16 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.root = new T.Group()
    this.scene.add(this.root)
    const board = new T.Mesh(
      new T.CylinderGeometry(R * 1.22, R * 1.22, BOARD, 96),
      new T.MeshPhysicalMaterial({ color: '#f4efe9', roughness: 0.35, metalness: 0.0, clearcoat: 0.4 }),
    )
    board.position.y = BOARD / 2
    board.receiveShadow = true
    board.castShadow = true
    this.root.add(board)

    this.camera = new T.PerspectiveCamera(26, 1, 0.1, 40)
    this.ray = new T.Raycaster()
    if (this.cutTarget) this._aim()

    this.setItem(item)
    this._bind()
    this._resize()
    this._ro = new ResizeObserver(() => this._resize())
    this._ro.observe(canvas.parentElement || canvas)
    // spend nothing while nobody can see it
    this.visible = true
    this._io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.dirty = true })
    this._io.observe(canvas)
    this._loop = this._loop.bind(this)
    this._raf = requestAnimationFrame(this._loop)
  }

  /* -------------------------------------------------------------- public */
  setItem(item) {
    this.item = item
    this._build()
  }

  setOptions(o) { Object.assign(this.opts, o); this._build() }

  setInscription(ins) {
    this.inscription = ins && ins.text?.trim() ? ins : null
    this._paintInscription()
    this.dirty = true
  }

  toggleCut() {
    if (!this.opts.cuttable) return
    const opening = this.cutTarget <= 0.5
    this.cutTarget = opening ? 1 : 0
    if (opening) { this._aim(); this._build() }
    this.idle = 0
    this.dirty = true
  }

  // cut where the viewer is looking, a little to the right, so the slice slides out
  // into the light and both cut faces turn toward the camera
  _aim() {
    const span = (this.opts.wedge * Math.PI) / 180
    this.wedgeAt = -this.yaw + 0.35 - span / 2
  }

  setFocus(label) { this.focusLabel = label || null; this._tint() }

  // face the viewer the shortest way round: yaw 0 is the inscription upright
  turnTo(angle = 0) {
    const k = Math.round((this.yaw - angle) / TAU)
    this._turn = angle + k * TAU
    this.spin = 0
    this.dirty = true
  }

  destroy() {
    cancelAnimationFrame(this._raf)
    this._ro?.disconnect(); this._io?.disconnect()
    this._dispose(this.root)
    this._insMat?.dispose(); this._insTex?.dispose()
    this.envMap?.dispose()
    this.renderer.dispose()
  }

  /* -------------------------------------------------------------- building */
  _dispose(obj) {
    obj.traverse((o) => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose()
      if (o.material && !o.userData.shared) [].concat(o.material).forEach((m) => m.dispose())
    })
  }

  _build() {
    if (this.cake) { this._dispose(this.cake); this.root.remove(this.cake) }
    const cake = (this.cake = new T.Group())
    this.root.add(cake)
    this.meshes = []
    const layers = this.item?.layers || []
    if (!layers.length) { this.dirty = true; return }

    // trailing frosting and finish are the coat; everything under them is the core
    let k = layers.length
    while (k > 0 && COAT_ROLES.has(layers[k - 1].role)) k--
    const core = layers.slice(0, k).map((l, i) => ({ ...l, i }))
    const coats = layers.slice(k).map((l, j) => ({ ...l, i: k + j }))
    const total = layers.reduce((s, l) => s + l.h, 0) || 1
    const unit = Math.min(0.22, 1.02 / total)

    // radial thickness of each coat on the side, inner → outer
    const thick = (tex) => (GLOSSY.has(tex) ? 0.022 : tex === 'fondant' ? 0.03 : 0.06)
    // glaze poured over frosting stays on top and runs down in drips; the sides keep
    // the frosting. Only a cake glazed straight onto the sponge is glazed all round.
    const side = coats.map((c, j) => ({
      ...c, top: true,
      t: GLOSSY.has(c.tex) && coats.slice(0, j).some((o) => !GLOSSY.has(o.tex)) ? 0 : thick(c.tex),
    }))
    const crumb = this.item.sideCrumb
    if (crumb && (side.length || core.length)) side.push({ label: crumb.label, color: crumb.color, tex: 'crumb', role: 'обсыпка', i: -2, t: 0.03, top: false })
    const rCore = R - side.reduce((s, c) => s + c.t, 0)

    let y = BOARD
    for (const l of core) { l.y0 = y; y += l.h * unit; l.y1 = y }
    let rr = rCore
    for (const c of side) {
      c.r0 = rr; rr += c.t; c.r1 = rr
      if (c.top) { c.y0 = y; y += c.h * unit; c.y1 = y }
    }
    const yTop = y
    for (const c of side) if (!c.top) { c.y0 = yTop; c.y1 = yTop }
    this.height = yTop
    this.layout = { core, side, rCore, yTop }

    const mats = new Map()
    const mat = (l) => {
      if (!mats.has(l.i)) {
        const m = material(l.tex, l.color)
        m.userData.base = m.color.clone()
        mats.set(l.i, m)
      }
      return mats.get(l.i)
    }
    this.mats = mats
    const add = (group, g, l) => {
      const m = new T.Mesh(g, mat(l))
      m.castShadow = true; m.receiveShadow = true
      m.userData.layer = l
      group.add(m)
      this.meshes.push(m)
      return m
    }

    const span = (this.opts.wedge * Math.PI) / 180
    const a0 = this.wedgeAt, a1 = a0 + span
    const whole = this.cutTarget < 0.5 && this.cut < 0.01
    // whole: one group around the full circle; cut: body and slice
    const ranges = whole ? [{ t0: 0, t1: TAU, faces: false }] : [
      { t0: a1, t1: a0 + TAU, faces: true, body: true },
      { t0: a0, t1: a1, faces: true, slice: true },
    ]
    this.body = null; this.slice = null

    for (const rg of ranges) {
      const grp = new T.Group()
      const { t0, t1 } = rg
      const outer = [...side].reverse().find((c) => c.t > 0)
      const topper = [...side].reverse().find((c) => c.top) || core[core.length - 1]

      // a frosted cake has a soft shoulder, not a blade: the wall stops a little short,
      // the top a little narrow, and a quarter-round of frosting fills the corner
      const bead = outer?.top ? 0.045 : 0

      // outside
      if (!side.length) for (const l of core) add(grp, wall(R, l.y0, l.y1, t0, t1), l)
      else add(grp, wall(R, BOARD, yTop - bead, t0, t1), outer)

      // top: the highest coat that has a top, then rings for side-only coats
      const rTop = (topper.r1 ?? R) - bead
      add(grp, cap(0, rTop, yTop, t0, t1), topper)
      for (const c of side) if (!c.top) add(grp, cap(c.r0, c.r1, yTop, t0, t1), c)

      if (bead) {
        const tor = new T.TorusGeometry(R - bead, bead, 12, Math.max(8, Math.ceil(((t1 - t0) / TAU) * 128)), t1 - t0)
        tor.rotateX(Math.PI / 2)
        tor.rotateY(t1 - Math.PI / 2)
        tor.translate(0, yTop - bead, 0)
        add(grp, tor, topper.t === 0 ? topper : outer)
      }

      // cut faces
      if (rg.faces) {
        for (const [t, start] of [[t0, true], [t1, false]]) {
          for (const l of core) add(grp, face(t, 0, rCore, l.y0, l.y1, start), l)
          for (const c of side) {
            if (c.t) add(grp, face(t, c.r0, c.r1, BOARD, c.top ? c.y1 : yTop, start), c)
            if (c.top) add(grp, face(t, 0, c.r0, c.y0, c.y1, start), c)
          }
        }
      }

      this._decorate(grp, t0, t1, rg.faces)

      if (rg.slice) {
        // pivot the slice around its own middle so it can turn to show its face
        const mid = (t0 + t1) / 2
        const pivot = new T.Group()
        const p = new T.Vector3(...P(R * 0.5, 0, mid))
        pivot.position.copy(p)
        grp.position.copy(p).multiplyScalar(-1)
        pivot.add(grp)
        pivot.userData = { home: p.clone(), dir: new T.Vector3(Math.sin(mid), 0, Math.cos(mid)) }
        cake.add(pivot)
        this.slice = pivot
      } else {
        cake.add(grp)
        if (rg.body) this.body = grp
      }
    }

    this._paintInscription()
    this._tint()
    this._fit()
    this.dirty = true
  }

  // decor that sits on top or hangs off the rim, kept off the cut lines
  _decorate(grp, t0, t1, cut) {
    const { side, yTop } = this.layout
    const inRange = (t, pad = 0.07) => {
      if (!cut) return true
      const d = ((t - t0) % TAU + TAU) % TAU
      return d > pad && d < t1 - t0 - pad
    }
    const rnd = rng((this.item.id || 1) + 7)
    const topper = [...side].reverse().find((c) => c.top)

    // glaze runs down the side in a few fat drips
    if (topper && GLOSSY.has(topper.tex)) {
      const m = material(topper.tex, topper.color)
      for (let i = 0; i < 26; i++) {
        const t = (i / 26) * TAU + rnd() * 0.12
        const len = 0.05 + rnd() * 0.16
        if (!inRange(t) || rnd() < 0.25) continue
        const g = new T.CapsuleGeometry(0.03 + rnd() * 0.015, len, 4, 10)
        const d = new T.Mesh(g, m)
        d.scale.set(1, 1, 0.32)
        d.rotation.y = t
        d.position.set(...P(R - 0.004, yTop - len / 2 - 0.02, t))
        d.castShadow = true
        d.userData.layer = topper
        grp.add(d); this.meshes.push(d)
      }
    }

    // what the recipe puts on top: one shape and one material per decor entry, drawn
    // instanced, so a dusting of a hundred crumbs is one draw call, not a hundred
    const SHAPES = {
      meringue: () => [kissGeo(), 'whipped', 10, 0.6],
      macaron: () => [new T.CylinderGeometry(0.075, 0.075, 0.07, 24), 'cream', 5, 0.6],
      choco: () => [new T.BoxGeometry(0.09, 0.12, 0.012), 'choco', 14, 0.6],
      nuts: () => [new T.DodecahedronGeometry(0.035, 0), 'nuts', 16, 0.6],
      marmalade: () => [new T.BoxGeometry(0.05, 0.05, 0.05), 'jelly', 14, 0.6],
      sprinkle: () => [new T.CapsuleGeometry(0.006, 0.022, 2, 6), 'glaze', 110, 0.82],
      grain: () => [new T.DodecahedronGeometry(0.013, 0), 'crumb', 110, 0.82],
    }
    const o = new T.Object3D()
    ;(this.item.decor || []).forEach((d, n) => {
      const kind = SHAPES[d.tex] ? d.tex : d.tex === 'walnut' ? 'nuts' : 'grain'
      const [g, tex, count, spread] = SHAPES[kind]()
      const spots = []
      for (let i = 0; i < count; i++) {
        const t = rnd() * TAU, r = Math.sqrt(rnd()) * spread * R + (spread < 0.8 ? 0.05 : 0), s = rnd()
        if (inRange(t, 0.1)) spots.push({ t, r, s })
      }
      if (!spots.length) { g.dispose(); return }
      const mesh = new T.InstancedMesh(g, material(tex, d.color), spots.length)
      spots.forEach(({ t, r, s }, i) => {
        o.position.set(...P(r, yTop + 0.012, t))
        o.rotation.set(0, s * 6, 0); o.scale.setScalar(1)
        if (kind === 'meringue') o.scale.setScalar(0.8 + s * 0.4)
        else if (kind === 'macaron') o.rotation.set(0, 0, 0.25 + s * 0.4)
        else if (kind === 'choco') o.rotation.set(-0.3 + s * 0.6, s * 6, 0.2)
        else if (kind === 'nuts') { o.scale.set(1.1, 0.7, 0.9); o.rotation.set(s * 3, s * 5, s * 2) }
        else if (kind === 'sprinkle' || kind === 'grain') o.rotation.set(Math.PI / 2, s * 6, 0)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
      })
      mesh.castShadow = true
      mesh.userData.layer = { label: d.label, role: 'декор', color: d.color, i: -10 - n }
      grp.add(mesh); this.meshes.push(mesh)
    })
    const shapes = {}

    // piping and berries: only when the page asks (the app does, the catalogue never)
    const cream = side.find((c) => SATIN.has(c.tex)) || topper
    if (this.opts.piping && cream) {
      const g = shapes.rose ||= rosetteGeo()
      const m = material('whipped', this.opts.piping === true ? cream.color : this.opts.piping)
      const n = 18
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU
        if (!inRange(t, 0.08)) continue
        const ro = new T.Mesh(g, m)
        ro.position.set(...P(R * 0.86, yTop - 0.004, t))
        ro.rotation.y = t * 3
        ro.castShadow = true
        ro.userData.layer = { label: 'Розочки из крема', role: 'декор', color: cream.color, i: -3 }
        grp.add(ro); this.meshes.push(ro)
      }
    }
    if (this.opts.berries) {
      const b = this.opts.berries
      const berry = berryModel(b)
      const n = this.opts.piping ? 18 : 12
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n) * TAU
        if (!inRange(t, 0.08)) continue
        // on a rosette when there is piping, straight on the cream when there is not
        const be = berry.clone()
        be.position.set(...P(this.opts.piping ? R * 0.86 : R * 0.8, yTop + (this.opts.piping ? 0.1 : 0), t))
        be.rotation.y = t * 2.3
        be.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.layer = { label: b.label, role: 'декор', color: b.color, i: -4 }; this.meshes.push(o) } })
        grp.add(be)
      }
    }
  }

  /* -------------------------------------------------------------- inscription */
  _paintInscription() {
    // drop the old overlay, if any
    for (const o of this._ins || []) { o.parent?.remove(o); o.geometry.dispose() }
    this._ins = []
    if (!this.cake || !this.layout) return
    const ins = this.inscription
    if (!ins) return

    if (!this._insCanvas) {
      this._insCanvas = document.createElement('canvas')
      this._insCanvas.width = this._insCanvas.height = 1024
      this._insTex = new T.CanvasTexture(this._insCanvas)
      this._insTex.colorSpace = T.SRGBColorSpace
      this._insTex.anisotropy = 4
      this._insMat = new T.MeshPhysicalMaterial({
        map: this._insTex, transparent: true, roughness: 0.3, clearcoat: 0.5,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      })
    }
    const g = this._insCanvas.getContext('2d')
    g.clearRect(0, 0, 1024, 1024)
    const lines = ins.text.trim().split(/\n/).slice(0, 3)
    const font = ins.font || '"Marck Script", cursive'
    // fit the longest line into the middle of the top, inside any piping
    const room = this.opts.piping ? 700 : 820
    let size = 230
    g.font = `${ins.style || ''} ${size}px ${font}`
    const widest = Math.max(...lines.map((l) => g.measureText(l).width))
    if (widest > room) size = Math.floor(size * room / widest)
    size = Math.min(size, Math.floor((room * 0.9) / lines.length))
    g.font = `${ins.style || ''} ${size}px ${font}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = ins.color || '#4a2a1c'
    g.shadowColor = 'rgba(0,0,0,.18)'
    g.shadowBlur = size * 0.04
    g.shadowOffsetY = size * 0.02
    const lh = size * 1.05
    // piped gel has body: the letters are drawn and then traced, so they read as lines of icing
    g.lineWidth = size * 0.05
    g.lineJoin = 'round'
    g.strokeStyle = g.fillStyle
    lines.forEach((l, i) => {
      const y = 512 + (i - (lines.length - 1) / 2) * lh
      g.fillText(l, 512, y); g.strokeText(l, 512, y)
    })
    this._insTex.needsUpdate = true

    // one overlay per group, the same planar uv, so a cut splits the words cleanly
    const { yTop } = this.layout
    const groups = this.slice ? [[this.body, true], [this.slice.children[0], false]] : [[this.cake.children[0], true]]
    const span = (this.opts.wedge * Math.PI) / 180
    for (const [grp, isBody] of groups) {
      if (!grp) continue
      const a0 = this.wedgeAt, a1 = a0 + span
      const geom = !this.slice ? cap(0, R * 0.97, yTop + 0.002, 0, TAU)
        : isBody ? cap(0, R * 0.97, yTop + 0.002, a1, a0 + TAU) : cap(0, R * 0.97, yTop + 0.002, a0, a1)
      const m = new T.Mesh(geom, this._insMat)
      m.userData.shared = true   // the material outlives rebuilds; geometry is freed above
      m.renderOrder = 2
      grp.add(m)
      this._ins.push(m)
    }
  }

  /* -------------------------------------------------------------- highlight */
  _tint() {
    if (!this.mats) return
    for (const [i, m] of this.mats) {
      const l = this.meshes.find((x) => x.material === m)?.userData.layer
      const on = this.focusLabel ? l?.label === this.focusLabel : this.hover === i
      const off = this.focusLabel ? l?.label !== this.focusLabel : false
      m.color.copy(m.userData.base)
      if (on) m.color.multiplyScalar(1.12)
      if (off) m.color.lerp(new T.Color('#ffffff'), 0.35)
    }
    this.dirty = true
  }

  /* -------------------------------------------------------------- camera */
  _fit() {
    const aspect = this.w && this.h ? this.w / this.h : 1
    const tan = Math.tan((this.camera.fov * Math.PI) / 360)
    const open = this.cutTarget > 0.5
    const elev = this.opts.elev
    const H = this.height || 1
    // what the camera has to hold: the board and the slice across, and up and down the
    // cake's height foreshortened plus the board's ellipse, which grows as the camera
    // climbs
    const halfW = open ? 2.1 : 1.6
    const halfH = 0.5 * (H * Math.cos(elev) + 2.5 * Math.sin(elev)) + 0.34
    const d = Math.max(halfW / (tan * aspect), halfH / tan) * 1.12
    const ty = H * 0.32
    this._camTarget = { d, elev, ty }
    if (!this._cam) this._cam = { ...this._camTarget }
  }

  /* -------------------------------------------------------------- input */
  _bind() {
    const c = this.cv
    let px = 0, moved = 0
    this.idle = 0
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true; px = e.clientX; moved = 0; this._turn = null
      c.setPointerCapture?.(e.pointerId); this.idle = 0
    })
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect()
      this._pointer = [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]
      if (this.dragging) {
        const dx = e.clientX - px
        px = e.clientX
        moved += Math.abs(dx)
        this.yaw += dx * 0.011
        this.spin = dx * 0.011
        this.idle = 0
        this.dirty = true
      } else this._hit()
    })
    const up = () => { if (!this.dragging) return; this.dragging = false; if (moved < 5) this.toggleCut() }
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', () => { this.dragging = false })
    c.addEventListener('pointerleave', () => {
      this._pointer = null
      if (this.hover !== -1) { this.hover = -1; this._tint(); this._emit(null) }
    })
    c.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.yaw -= 0.22
      else if (e.key === 'ArrowRight') this.yaw += 0.22
      else if (e.key === 'Enter' || e.key === ' ') this.toggleCut()
      else return
      e.preventDefault(); this.idle = 0; this.dirty = true
    })
    c.tabIndex = 0
  }

  _emit(l) {
    this.cv.dispatchEvent(new CustomEvent('cake:layer', {
      detail: l ? { label: l.label, role: l.role, color: l.color, i: l.i } : null, bubbles: true,
    }))
  }

  _hit() {
    if (!this._pointer || !this.meshes?.length) return
    this.ray.setFromCamera(new T.Vector2(...this._pointer), this.camera)
    const hit = this.ray.intersectObjects(this.meshes, false)[0]
    const l = hit?.object.userData.layer || null
    const idx = l ? l.i : -1
    if (idx !== this.hover) { this.hover = idx; this._tint(); this._emit(l) }
  }

  /* -------------------------------------------------------------- sizing */
  _resize() {
    const box = this.cv.parentElement?.getBoundingClientRect() || this.cv.getBoundingClientRect()
    const w = Math.max(220, Math.floor(box.width))
    const h = Math.max(200, Math.floor(box.height || w * 0.85))
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(w, h, false)
    this.cv.style.width = w + 'px'
    this.cv.style.height = h + 'px'
    this.w = w; this.h = h
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this._fit()
    this.dirty = true
  }

  /* -------------------------------------------------------------- loop */
  _loop(t) {
    const dt = Math.min(48, t - (this._t || t)); this._t = t
    this._raf = requestAnimationFrame(this._loop)
    if (!this.visible || document.hidden) return

    if (Math.abs(this.cutTarget - this.cut) > 0.001) {
      this.cut = still() ? this.cutTarget : this.cut + (this.cutTarget - this.cut) * Math.min(1, dt / 210)
      if (this.cutTarget < 0.5 && this.cut < 0.01) { this.cut = 0; this._build() } // closed: seamless again
      this._fit()
      this.dirty = true
    }
    if (!this.dragging && this._turn != null) {
      // turning to a requested angle overrides the idle spin until it lands
      const d = this._turn - this.yaw
      this.yaw += still() ? d : d * Math.min(1, dt / 220)
      if (Math.abs(d) < 0.002) { this.yaw = this._turn; this._turn = null }
      this.dirty = true
    } else if (!this.dragging) {
      if (Math.abs(this.spin) > 0.0002) { this.yaw += this.spin; this.spin *= 0.93; this.dirty = true }
      else {
        this.idle = (this.idle || 0) + dt
        if (this.opts.autospin && this.idle > 1200 && !still()) { this.yaw += dt * 0.00032; this.dirty = true }
      }
    }
    // ease the camera toward its framing
    const c = this._cam, g = this._camTarget
    for (const k of ['d', 'elev', 'ty']) {
      if (Math.abs(c[k] - g[k]) > 1e-4) { c[k] += (g[k] - c[k]) * Math.min(1, dt / 160); this.dirty = true }
    }
    if (!this.dirty) return
    this.dirty = false

    const cut = ease(clamp(this.cut, 0, 1))
    this.root.rotation.y = this.yaw
    this.root.position.x = -0.42 * cut
    if (this.slice) {
      const { home, dir } = this.slice.userData
      this.slice.position.copy(home).addScaledVector(dir, 1.0 * cut)
      this.slice.rotation.y = 1.65 * cut
    }
    this.camera.position.set(0, c.ty + Math.sin(c.elev) * c.d, Math.cos(c.elev) * c.d)
    this.camera.lookAt(0, c.ty, 0)
    this.renderer.render(this.scene, this.camera)
    if (!this._painted) { this._painted = true; this.cv.dispatchEvent(new CustomEvent('cake:ready', { bubbles: true })) }
  }
}

/* A cake for this canvas: the WebGL one where the device can, the flat one otherwise. */
export function webglOK() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export default CakeGL
