// Brings the product photos home. Downloads each product's original photo from
// tortufa.ru once and re-encodes it into two WebP sizes under assets/products/:
// <slug>-600.webp for cards and <slug>-1200.webp for the cake page. sources.json
// remembers which original each pair came from, so a rerun only fetches products that
// are new or whose photo changed, and drops files for products that are gone.
// build-data.mjs reads the same manifest to point the catalogue at these files.
import { readFile, writeFile, mkdir, readdir, rm, access } from 'node:fs/promises'
import sharp from 'sharp'

const DIR = 'assets/products'
const MANIFEST = `${DIR}/sources.json`
const SIZES = { thumb: [600, 900], full: [1200, 1500] } // longest edges: width, height

const products = JSON.parse(await readFile('data/raw-products.json', 'utf8'))
const old = JSON.parse(await readFile(MANIFEST, 'utf8').catch(() => '{}'))
await mkdir(DIR, { recursive: true })

const file = (slug, [w]) => `${DIR}/${slug}-${w}.webp`
const exists = (p) => access(p).then(() => true, () => false)
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const next = {}
let fetched = 0, kept = 0, failed = 0
for (const p of products) {
  const src = p.images?.[0]?.src
  if (!src) continue
  const outs = Object.values(SIZES).map((s) => file(p.slug, s))
  if (old[p.slug]?.src === src && (await Promise.all(outs.map(exists))).every(Boolean)) {
    next[p.slug] = old[p.slug]
    kept++
    continue
  }
  try {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    for (const [w, h] of Object.values(SIZES)) {
      await sharp(buf).rotate()
        .resize({ width: w, height: h, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toFile(file(p.slug, [w]))
    }
    const meta = await sharp(file(p.slug, SIZES.full)).metadata()
    next[p.slug] = { src, w: meta.width, h: meta.height }
    fetched++
    process.stdout.write(`${fetched}. ${p.slug}\n`)
    await pause(150) // one shop, one small server: no need to hurry
  } catch (e) {
    failed++
    console.warn(`! ${p.slug}: ${e.message}`)
    if (old[p.slug]) next[p.slug] = old[p.slug] // keep the last good copy
  }
}

// products that left the catalogue take their photos with them
const keep = new Set(Object.keys(next).flatMap((slug) => Object.values(SIZES).map((s) => file(slug, s).slice(DIR.length + 1))))
let pruned = 0
for (const f of await readdir(DIR)) {
  if (f.endsWith('.webp') && !keep.has(f)) { await rm(`${DIR}/${f}`); pruned++ }
}

const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(MANIFEST, JSON.stringify(sorted, null, 1) + '\n')
console.log(`photos: ${fetched} fetched, ${kept} unchanged, ${pruned} removed, ${failed} failed`)
if (failed) process.exitCode = 1
