// Pulls the live Ufa Dessert (tortufa.ru) catalog via the public WooCommerce Store API
// and writes a normalised dataset the magazine front-end consumes.
import { writeFile } from 'node:fs/promises'

const BASE = 'https://tortufa.ru/wp-json/wc/store/v1'

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { 'accept': 'application/json' } })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

const strip = (html = '') =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
      .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&hellip;/g, '…')
      .replace(/\s+/g, ' ').trim()

const products = []
for (let page = 1; page <= 20; page++) {
  const batch = await get(`/products?per_page=100&page=${page}`)
  if (!batch.length) break
  products.push(...batch)
  process.stdout.write(`page ${page}: ${batch.length}\n`)
  if (batch.length < 100) break
}

const categories = await get('/products/categories?per_page=100')

const clean = products.map((p) => ({
  id: p.id,
  name: strip(p.name),
  slug: p.slug,
  url: p.permalink,
  price: p.prices?.price ? Number(p.prices.price) / 10 ** (p.prices.currency_minor_unit ?? 2) : null,
  regular: p.prices?.regular_price ? Number(p.prices.regular_price) / 10 ** (p.prices.currency_minor_unit ?? 2) : null,
  onSale: !!p.on_sale,
  short: strip(p.short_description),
  desc: strip(p.description),
  inStock: p.is_in_stock,
  images: (p.images || []).map((i) => ({ src: i.src, thumb: i.thumbnail, srcset: i.srcset, alt: strip(i.alt || "") })),
  cats: (p.categories || []).map((c) => ({ id: c.id, name: strip(c.name), slug: c.slug })),
  tags: (p.tags || []).map((t) => strip(t.name)),
}))

await writeFile('data/raw-products.json', JSON.stringify(clean, null, 1))
await writeFile('data/raw-categories.json', JSON.stringify(
  categories.map((c) => ({ id: c.id, name: strip(c.name), slug: c.slug, parent: c.parent, count: c.count, desc: strip(c.description), image: c.image?.src || null })), null, 1))

console.log(`\nproducts: ${clean.length}`)
console.log(`categories: ${categories.length}`)
const byCat = {}
for (const p of clean) for (const c of p.cats) byCat[c.name] = (byCat[c.name] || 0) + 1
console.log(Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}\t${k}`).join('\n'))
