// Turns the scraped tortufa.ru catalogue into the dataset the magazine renders:
// an ordered, colour-coded layer stack per product (drives the 2D cross-section AND
// the 3D cake), a taste profile, tags, weight and price-per-kilo.
import { readFile, writeFile } from 'node:fs/promises'
import { LEX, FRUITS } from './lexicon.mjs'

const products = JSON.parse(await readFile('data/raw-products.json', 'utf8'))
const categories = JSON.parse(await readFile('data/raw-categories.json', 'utf8'))

const decode = (s = '') =>
  s.replace(/&#171;|&laquo;/g, '«').replace(/&#187;|&raquo;/g, '»')
   .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&amp;/g, '&')
   .replace(/&quot;|&#34;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
   .replace(/\s+/g, ' ').trim()

// ---------- weight ----------
const weight = (text) => {
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s*кг/i)
  if (kg) {
    const n = parseFloat(kg[1].replace(',', '.'))
    return Math.round(n * 1000)
  }
  const g = text.match(/(\d[\d\s.,]*)\s*(?:гр|грамм|г\b)/i)
  if (g) {
    const raw = g[1].replace(/\s/g, '')
    // "1,300 гр" is one thousand three hundred, not 1.3 grams
    const n = /[.,]\d{3}$/.test(raw) ? parseFloat(raw.replace(/[.,]/g, '')) : parseFloat(raw.replace(',', '.'))
    return Math.round(n)
  }
  return null
}

// JS `\w` and `\b` are ASCII-only, so they silently fail on Cyrillic. Rewrite both into
// Cyrillic-aware equivalents before compiling any lexicon pattern.
const L = 'а-яёa-z0-9'
const cyr = (source) =>
  source
    .replace(/\\w/g, `[${L}]`)
    .replace(/\\b/g, `(?:\\b|(?<![${L}])(?=[${L}])|(?<=[${L}])(?![${L}]))`)

// ---------- ordered, non-overlapping lexicon matches ----------
const readLayers = (text) => {
  const hits = []
  LEX.forEach((entry, rank) => {
    const rx = new RegExp(cyr(entry.re.source), 'gi')
    let m
    while ((m = rx.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, rank, entry, raw: m[0] })
      if (m.index === rx.lastIndex) rx.lastIndex++
    }
  })
  hits.sort((a, b) => a.start - b.start || a.rank - b.rank || (b.end - b.start) - (a.end - a.start))
  const taken = []
  for (const h of hits) {
    if (taken.some((t) => h.start < t.end && h.end > t.start)) continue
    taken.push(h)
  }
  // collapse immediate repeats of the same component
  const out = []
  for (const t of taken) {
    if (out.length && out[out.length - 1].entry.label === t.entry.label) continue
    out.push(t)
  }
  return out.map((t) => ({ ...t.entry, raw: t.raw }))
}

const fruitsIn = (text) => {
  const seen = new Set()
  const out = []
  for (const f of FRUITS) {
    if (new RegExp(cyr(f.re.source),'i').test(text) && !seen.has(f.label)) { seen.add(f.label); out.push({ label: f.label, color: f.color }) }
  }
  return out
}

const H = { sponge: 1, cream: 0.5, fill: 0.3, crunch: 0.2, top: 0.16, frosting: 0.44 }

// ---------- assemble a believable stack from the parsed components ----------
const buildStack = (comps, text, grams) => {
  const uniq = (arr) => {
    const s = new Set(); return arr.filter((c) => !s.has(c.label) && s.add(c.label))
  }
  const sponges = uniq(comps.filter((c) => c.kind === 'sponge'))
  const creams = uniq(comps.filter((c) => c.kind === 'cream'))
  const fills = uniq(comps.filter((c) => c.kind === 'fill'))
  const tops = uniq(comps.filter((c) => c.kind === 'top'))
  const crunch = uniq(comps.filter((c) => c.kind === 'crunch'))
  if (!sponges.length) return null

  const inner = crunch.filter((c) => ['nuts', 'crumb', 'meringue', 'choco'].includes(c.tex))
  const decor = crunch.filter((c) => !inner.includes(c)).concat(inner.slice(0, 1))

  // how many cake layers? honour an explicit count, otherwise scale with weight
  let n
  const said = text.match(/(\d+|три|четыре|два)\s*(?:вида бисквита|слоя|слоёв|слоев)/i)
  if (said) n = { 'два': 2, 'три': 3, 'четыре': 4 }[said[1].toLowerCase()] || parseInt(said[1], 10)
  else if (!grams) n = 3
  else n = grams <= 520 ? 2 : grams <= 780 ? 3 : grams <= 1250 ? 3 : 4
  n = Math.max(n, sponges.length, 2)

  const stack = []
  const gaps = n - 1
  for (let i = 0; i < n; i++) {
    const sp = sponges[i % sponges.length]
    stack.push({ ...sp, h: H.sponge, role: 'корж' })
    if (i < gaps) {
      const c = creams.length ? creams[i % creams.length] : null
      if (c) stack.push({ ...c, h: H.cream, role: 'прослойка' })
      const f = fills[i] || (fills.length && gaps > fills.length && i === Math.floor(gaps / 2) ? fills[0] : null)
      if (f) stack.push({ ...f, h: H.fill, role: 'начинка' })
      const cr = inner[i]
      if (cr) stack.push({ ...cr, h: H.crunch, role: 'хруст' })
    }
  }
  // frosting + glaze on top
  const frost = creams.find((c) => ['whipped', 'cream', 'cheese', 'mousse', 'souffle'].includes(c.tex)) || creams[0]
  if (frost) stack.push({ ...frost, h: H.frosting, role: 'обмазка' })
  for (const t of tops) stack.push({ ...t, h: H.top, role: 'покрытие' })

  const sideCrumb = crunch.find((c) => c.tex === 'crumb' && /обсып|покрыт|оформлен/i.test(text))
  return { stack, decor, sideCrumb: sideCrumb || null, sponges, creams, fills, tops, crunch }
}

// ---------- taste profile ----------
const profile = (built, text) => {
  const has = (rx) => new RegExp(cyr(rx.source),'i').test(text)
  const all = built ? built.stack.map((l) => l.label).join(' ') + ' ' + text : text
  const score = (rx, w) => (new RegExp(cyr(rx), 'i').test(all) ? w : 0)
  const choco = Math.min(100, score('шоколад|какао|ганаш|трюфель|цюрих', 55) + score('шокодел|шоколадн\\w+ крем', 25) + score('бел\\w+ шоколад', 10))
  const fruit = Math.min(100, score('конфитюр|желе|гель|повидло|ягод|малин|смородин|клубник|лимон|персик|апельсин|вишн|абрикос|киви', 60) + score('мармелад|фруктов', 20))
  const cream = Math.min(100, 35 + score('крем|сливк|мусс|суфле|чиз|творог', 45) + score('взбит|нежн|воздушн', 15))
  const crunch = Math.min(100, score('меренг|орех|арахис|пралине|крошк|посыпк|хрустящ|макарун', 60) + score('песочн|сло[её]н', 25))
  const sweet = Math.min(100, 45 + score('сгущ|карамель|помадк|мёд|медов|глазур', 35) + score('сахарн', 10))
  const airy = Math.min(100, score('воздушн|мусс|суфле|меренг|бисквит', 40) + score('нежн|лёгк|легк', 20) + (has(/песочн|сло[её]н/i) ? 0 : 20))
  return { choco, fruit, cream, crunch, sweet, airy }
}

const TAGS = [
  { key: 'lenten', label: 'Постный', re: /постн|без яиц|без содержания продуктов животного/i },
  { key: 'choco', label: 'Шоколадный', re: /шоколад|какао|ганаш|трюфель/i },
  { key: 'fruit', label: 'Фруктовый', re: /конфитюр|желе|гель|ягод|малин|смородин|клубник|лимон|персик|апельсин|вишн|фрукт/i },
  { key: 'honey', label: 'Медовый', re: /медов/i },
  { key: 'nut', label: 'С орехом', re: /орех|арахис|пралине|фисташк/i },
  { key: 'cheese', label: 'Крем-чиз', re: /чиз|сырн\w+ крем|творог/i },
  { key: 'classic', label: 'Классика', re: /классич|наполеон|рыжик|сметанн|птичье/i },
]

const ART = (p) => {
  const t = []
  const text = `${p.name} ${p.short}`
  for (const tag of TAGS) if (new RegExp(cyr(tag.re.source),'i').test(text)) t.push(tag)
  if (/бенто/i.test(text)) t.push({ key: 'bento', label: 'Бенто' })
  if (/детск/i.test(text)) t.push({ key: 'kids', label: 'Детский' })
  return t
}

// A cross-section only makes sense for a layered dessert. Savoury bakes, dough and
// semi-finished goods share vocabulary with cakes ("песочное тесто", "картошка"), so
// they have to be excluded explicitly or a вак-беляш ends up with a cream diagram.
const NO_CUT_CATS = new Set(['pirogi-pirozhki', 'hlebobulochnye-izdeliya', 'polufabrikaty', 'kulichi-hlebobulochnye-izdeliya'])
const SAVOURY = /фарш|мясн|говядин|курин|картофел|картошк\w* (?:и|с)|капуст|\bлук\b|шпинат|гриб|сосиск|колбас|\bрыб|сыр\w* и зелен|солён\w+ творог/i
const NOT_DESSERT_NAME = /беляш|самс|эчпочмак|учпочмак|кыстыбы|лапша|тесто|хлеб|багет|лаваш|плюшк|булочк|пирожок|пирог\b|чебурек|ватрушк\w* с карто/i

const cuttable = (name, short, cats) => {
  if (cats.some((c) => NO_CUT_CATS.has(c.slug))) return false
  if (new RegExp(cyr(NOT_DESSERT_NAME.source), 'i').test(name)) return false
  if (new RegExp(cyr(SAVOURY.source), 'i').test(`${name} ${short}`)) return false
  return true
}

const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]))
const pickImage = (img) => {
  if (!img) return null
  // prefer the ~1024px WordPress variant so the magazine stays fast
  const set = (img.srcset || '').split(',').map((s) => s.trim().split(' ')).filter((a) => a.length === 2)
      .map(([url, w]) => ({ url, w: parseInt(w, 10) })).sort((a, b) => a.w - b.w)
  const best = set.find((s) => s.w >= 900) || set[set.length - 1]
  return { full: best?.url || img.src, thumb: set.find((s) => s.w >= 500)?.url || img.thumb || img.src, orig: img.src }
}

const items = products.map((p) => {
  const name = decode(p.name)
  const short = decode(p.short)
  const desc = decode(p.desc)
  const text = `${short} ${desc}`
  const grams = weight(short) || weight(name) || weight(desc)
  const canCut = cuttable(name, short, p.cats)
  const comps = canCut ? readLayers(short.replace(/^Вес:?[^,.]*?(?=[А-ЯЁа-яё])/i, '')) : []
  const built = canCut ? buildStack(comps, text, grams) : null
  const shelf = (() => {
    const m = text.match(/(\d+)\s*(час|сут)/i)
    if (!m) return null
    return m[2].toLowerCase().startsWith('час') ? `${m[1]} ч` : `${m[1]} сут`
  })()
  const img = pickImage(p.images?.[0])
  const primary = p.cats[0]
  return {
    id: p.id,
    slug: p.slug,
    name,
    title: name.replace(/^Торт\s+/i, '').replace(/\s*\d+[.,]?\d*\s*(?:кг|гр|грамм)\.?$/i, '').trim(),
    kind: /^торт/i.test(name) ? 'торт' : /пирожное|пирожные/i.test(name) ? 'пирожное' : null,
    price: p.price,
    regular: p.regular,
    onSale: p.onSale,
    grams,
    perKg: p.price && grams ? Math.round((p.price / grams) * 1000) : null,
    short,
    shelf,
    inStock: p.inStock,
    url: p.url,
    img,
    cats: p.cats.map((c) => ({ name: decode(c.name), slug: c.slug })),
    cat: primary ? { name: decode(primary.name), slug: primary.slug } : null,
    tags: ART({ name, short }),
    fruits: fruitsIn(text),
    layers: built ? built.stack.map((l) => ({ label: l.label, color: l.color, tex: l.tex, h: l.h, role: l.role })) : [],
    decor: built ? built.decor.map((l) => ({ label: l.label, color: l.color, tex: l.tex })) : [],
    sideCrumb: built?.sideCrumb ? { label: built.sideCrumb.label, color: built.sideCrumb.color } : null,
    profile: profile(built, text),
  }
})

const withSection = items.filter((i) => i.layers.length >= 3)
const cakes = items.filter((i) => i.cats.some((c) => c.slug === 'torty') && i.layers.length >= 3)

await writeFile('data/catalog.json', JSON.stringify({
  brand: {
    name: 'Уфа Десерт',
    legal: 'Кондитерский цех «Дионис»',
    city: 'Уфа',
    address: 'г. Уфа, ул. Гагарина 25/1',
    hours: '8:00 — 20:00',
    phones: ['+7 (967) 747-21-14', '+7 (927) 960-51-43'],
    email: 'info@tortufa.ru',
    site: 'https://tortufa.ru',
    freeFrom: 1000,
    discount: { from: 3000, percent: 5 },
  },
  categories: categories.map((c) => ({ ...c, name: decode(c.name), desc: decode(c.desc) })),
  items,
}, null, 0))

await writeFile('data/cakes.json', JSON.stringify(cakes, null, 0))

console.log(`items: ${items.length}`)
console.log(`with a readable interior: ${withSection.length}`)
console.log(`cakes with interior: ${cakes.length}`)
console.log(`no weight: ${items.filter((i) => !i.grams).length}`)
console.log('\n— sample —')
for (const c of cakes.slice(0, 5)) {
  console.log(`\n${c.name}  ${c.price}₽  ${c.grams}г  (${c.perKg}₽/кг)  [${c.tags.map((t) => t.label).join(', ')}]`)
  console.log(c.layers.map((l, i) => `  ${String(i).padStart(2)} ${l.role.padEnd(10)} ${l.label}  ${l.color}`).join('\n'))
  console.log('  profile', JSON.stringify(c.profile))
}
const noLayers = items.filter((i) => i.layers.length < 3 && /торт/i.test(i.name))
console.log('\ncakes WITHOUT a stack:', noLayers.map((i) => i.name).join(' | ') || 'none')
