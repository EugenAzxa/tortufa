/* recipe.js — the rules for assembling a cake out of components.

   This mirrors buildStack() in tools/build-data.mjs on purpose: the constructor has to
   stack a cake the same way the catalogue parser does, or a cake you build yourself
   would look nothing like the same cake read off a product description. If the
   assembly rules change in one place, change them in the other. */

// role → the slot a component fills. The catalogue stores roles, not kinds.
export const ROLE_KIND = {
  'корж': 'sponge',
  'прослойка': 'cream',
  'обмазка': 'cream',
  'начинка': 'fill',
  'хруст': 'crunch',
  'покрытие': 'top',
}

export const SLOTS = [
  { kind: 'sponge', label: 'Коржи', hint: 'основа торта', min: 1, max: 3 },
  { kind: 'cream', label: 'Крем', hint: 'прослойка и обмазка', min: 1, max: 2 },
  { kind: 'fill', label: 'Начинка', hint: 'конфитюр, гель, желе', min: 0, max: 2 },
  { kind: 'crunch', label: 'Хруст', hint: 'орех, меренга, крошка', min: 0, max: 2 },
  { kind: 'top', label: 'Покрытие', hint: 'глазурь, ганаш, помадка', min: 0, max: 1 },
]

export const SIZES = [
  { key: 'bento', label: 'Бенто', grams: 500, layers: 2, note: 'на двоих' },
  { key: 'classic', label: 'Классический', grams: 900, layers: 3, note: 'на 6–8 человек' },
  { key: 'big', label: 'Большой', grams: 1300, layers: 3, note: 'на 10–12 человек' },
  { key: 'feast', label: 'Праздничный', grams: 1800, layers: 4, note: 'на компанию' },
]

const H = { sponge: 1, cream: 0.5, fill: 0.3, crunch: 0.2, top: 0.16, frosting: 0.44 }

/** Every distinct component the workshop actually uses, grouped by slot. */
export function ingredients(catalog) {
  const seen = new Map()
  for (const item of catalog.items) {
    for (const l of item.layers || []) {
      const kind = ROLE_KIND[l.role]
      if (!kind) continue
      const key = kind + '|' + l.label
      if (!seen.has(key)) seen.set(key, { kind, label: l.label, color: l.color, tex: l.tex, n: 0, lenten: true })
      const rec = seen.get(key)
      rec.n++
      // a component counts as lenten only if every cake carrying it is
      if (!item.tags.some((t) => t.key === 'lenten')) rec.lenten = false
    }
  }
  const out = {}
  for (const s of SLOTS) {
    out[s.kind] = [...seen.values()]
      .filter((c) => c.kind === s.kind)
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'ru'))
  }
  return out
}

/** Stack the chosen components into the same layer shape the catalogue uses. */
export function assemble(pick, layerCount) {
  const { sponge = [], cream = [], fill = [], crunch = [], top = [] } = pick
  if (!sponge.length) return []
  const n = Math.max(2, layerCount, sponge.length)
  const gaps = n - 1
  const stack = []

  for (let i = 0; i < n; i++) {
    stack.push({ ...sponge[i % sponge.length], h: H.sponge, role: 'корж' })
    if (i < gaps) {
      if (cream.length) stack.push({ ...cream[i % cream.length], h: H.cream, role: 'прослойка' })
      const f = fill[i] || (fill.length && gaps > fill.length && i === Math.floor(gaps / 2) ? fill[0] : null)
      if (f) stack.push({ ...f, h: H.fill, role: 'начинка' })
      if (crunch[i]) stack.push({ ...crunch[i], h: H.crunch, role: 'хруст' })
    }
  }
  const frost = cream.find((c) => ['whipped', 'cream', 'cheese', 'mousse', 'souffle'].includes(c.tex)) || cream[0]
  if (frost) stack.push({ ...frost, h: H.frosting, role: 'обмазка' })
  for (const t of top) stack.push({ ...t, h: H.top, role: 'покрытие' })
  return stack.map((l) => ({ label: l.label, color: l.color, tex: l.tex, h: l.h, role: l.role }))
}

/** An item shaped like a catalogue entry, so the 3D cake and the cross-section
    can render a made-up cake with no special cases. */
export function asItem(pick, size, layers) {
  const crunch = pick.crunch || []
  return {
    id: 990000 + layers.length * 17 + (layers[0]?.label.length || 0),
    slug: '__custom',
    name: 'Ваш торт',
    title: 'Ваш торт',
    grams: size.grams,
    layers,
    decor: crunch.map((c) => ({ label: c.label, color: c.color, tex: c.tex })),
    sideCrumb: crunch.find((c) => c.tex === 'crumb') || null,
    fruits: [],
    tags: [],
  }
}

/** How close is this recipe to something the workshop already bakes? */
export function neighbours(catalog, pick, limit = 3) {
  const mine = new Set(Object.values(pick).flat().map((c) => c.label))
  if (!mine.size) return []
  const scored = []
  for (const item of catalog.items) {
    if (!item.layers?.length) continue
    const theirs = new Set(item.layers.map((l) => l.label))
    let shared = 0
    for (const l of mine) if (theirs.has(l)) shared++
    if (!shared) continue
    const union = new Set([...mine, ...theirs]).size
    scored.push({ item, shared, score: shared / union })
  }
  return scored.sort((a, b) => b.score - a.score || b.shared - a.shared).slice(0, limit)
}

/** A price range, derived from what comparable cakes actually cost per kilo.
    Deliberately a range and deliberately labelled as an estimate — the workshop
    quotes the real price. */
export function estimate(catalog, pick, size) {
  const near = neighbours(catalog, pick, 8).filter((n) => n.item.perKg)
  const pool = (near.length >= 3 ? near.map((n) => n.item.perKg) : null)
    || catalog.items.filter((i) => i.perKg && i.layers?.length >= 3).map((i) => i.perKg)
  const sorted = pool.slice().sort((a, b) => a - b)
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
  const kg = size.grams / 1000
  const round = (v) => Math.round(v / 10) * 10
  return {
    low: round(at(0.25) * kg),
    mid: round(at(0.5) * kg),
    high: round(at(0.75) * kg),
    perKg: Math.round(at(0.5)),
    basedOn: near.length >= 3 ? near.length : sorted.length,
    fromNeighbours: near.length >= 3,
  }
}

/* ---------------------------------------------------------------- sharing */
export function encode(pick, sizeKey) {
  const ix = (arr, lib) => (arr || []).map((c) => lib.findIndex((l) => l.label === c.label)).filter((i) => i >= 0).join('.')
  return (lib) => [sizeKey, ix(pick.sponge, lib.sponge), ix(pick.cream, lib.cream),
    ix(pick.fill, lib.fill), ix(pick.crunch, lib.crunch), ix(pick.top, lib.top)].join('-')
}

export function decode(str, lib) {
  if (!str) return null
  const [sizeKey, s, c, f, k, t] = str.split('-')
  const pull = (spec, arr) => (spec || '').split('.').filter(Boolean)
    .map((i) => arr[+i]).filter(Boolean)
  return {
    sizeKey,
    pick: { sponge: pull(s, lib.sponge), cream: pull(c, lib.cream), fill: pull(f, lib.fill),
      crunch: pull(k, lib.crunch), top: pull(t, lib.top) },
  }
}
