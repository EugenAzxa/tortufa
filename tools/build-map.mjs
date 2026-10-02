// Builds data/ufa.json — the geometry behind the delivery map.
// Real administrative outlines of Ufa and its seven city districts come from
// OpenStreetMap via Nominatim (polygon_geojson), then get simplified and projected
// into flat SVG space. No tile server, no map library, no API key at runtime.
import { writeFile } from 'node:fs/promises'

const UA = 'tortufa-magazine/1.0 (delivery map build; info@tortufa.ru)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TARGETS = [
  { q: 'Уфа, Республика Башкортостан, Россия', name: 'Уфа', level: 'city' },
  { q: 'Демский район, Уфа, Россия', name: 'Дёмский', level: 'district' },
  { q: 'Калининский район, Уфа, Россия', name: 'Калининский', level: 'district' },
  { q: 'Кировский район, Уфа, Россия', name: 'Кировский', level: 'district' },
  { q: 'Ленинский район, Уфа, Россия', name: 'Ленинский', level: 'district' },
  { q: 'Октябрьский район, Уфа, Россия', name: 'Октябрьский', level: 'district' },
  { q: 'Орджоникидзевский район, Уфа, Россия', name: 'Орджоникидзевский', level: 'district' },
  { q: 'Советский район, Уфа, Россия', name: 'Советский', level: 'district' },
]

const lookup = async (q) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&polygon_geojson=1&limit=1&accept-language=ru`
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status}`)
  const arr = await res.json()
  return arr[0] || null
}

// Ramer–Douglas–Peucker, so the SVG paths stay small but keep their character
const rdp = (pts, eps) => {
  if (pts.length < 3) return pts
  const d2 = (p, a, b) => {
    const [x, y] = p, [x1, y1] = a, [x2, y2] = b
    const dx = x2 - x1, dy = y2 - y1
    if (!dx && !dy) return (x - x1) ** 2 + (y - y1) ** 2
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return (x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2
  }
  let idx = 0, max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = d2(pts[i], pts[0], pts[pts.length - 1])
    if (d > max) { max = d; idx = i }
  }
  if (max > eps * eps) return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)]
  return [pts[0], pts[pts.length - 1]]
}

const ringsFromGeoJSON = (g) => {
  if (!g) return []
  if (g.type === 'Polygon') return [g.coordinates[0]]
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p[0])
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(ringsFromGeoJSON)
  return []
}

const shapes = []
for (const t of TARGETS) {
  const hit = await lookup(t.q)
  await sleep(1100) // Nominatim asks for max 1 request per second
  if (!hit) { console.log(`MISS  ${t.name}`); continue }
  const rings = ringsFromGeoJSON(hit.geojson)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4)
    .map((r) => rdp(r, 0.0011))
    .filter((r) => r.length > 3)
  if (!rings.length) { console.log(`NO GEOM  ${t.name} (${hit.geojson?.type})`); continue }
  shapes.push({ ...t, osm: `${hit.osm_type}/${hit.osm_id}`, rings })
  console.log(`ok    ${t.name.padEnd(20)} ${hit.osm_type}/${hit.osm_id}  rings ${rings.length}  pts ${rings.reduce((n, r) => n + r.length, 0)}`)
}
if (!shapes.length) { console.error('nothing resolved'); process.exit(1) }

// ---- project: equirectangular with the latitude correction for Ufa's 54.7°N ----
const all = shapes.flatMap((s) => s.rings.flat())
const bbox = [
  Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])),
  Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1])),
]
const pad = 0.004
bbox[0] -= pad; bbox[1] -= pad / 2; bbox[2] += pad; bbox[3] += pad / 2
const kx = Math.cos((((bbox[1] + bbox[3]) / 2) * Math.PI) / 180)
const W = 1000
const spanX = (bbox[2] - bbox[0]) * kx
const spanY = bbox[3] - bbox[1]
const H = Math.round((W * spanY) / spanX)
const proj = ([lon, lat]) => [
  +(((lon - bbox[0]) * kx * W) / spanX).toFixed(1),
  +((1 - (lat - bbox[1]) / spanY) * H).toFixed(1),
]
const toPath = (rings) => rings.map((r) => 'M' + r.map(proj).map((p) => p.join(' ')).join('L') + 'Z').join('')

const centroid = (ring) => {
  const pts = ring.map(proj)
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]
    const f = x1 * y2 - x2 * y1
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
  }
  a *= 0.5
  return a ? [+(cx / (6 * a)).toFixed(1), +(cy / (6 * a)).toFixed(1)] : pts[0]
}

const slugMap = {
  'Дёмский': 'demsky', 'Калининский': 'kalininsky', 'Кировский': 'kirovsky',
  'Ленинский': 'leninsky', 'Октябрьский': 'oktyabrsky',
  'Орджоникидзевский': 'ordzhonikidzevsky', 'Советский': 'sovetsky',
}

const out = {
  viewBox: `0 0 ${W} ${H}`,
  bbox,
  kx,
  // the workshop itself: ул. Юрия Гагарина 25/1, Сипайлово (checked by reverse geocoding;
  // plain «Гагарина» sends Nominatim to a namesake street outside the city)
  shop: { name: 'Цех «Уфа Десерт»', addr: 'ул. Гагарина 25/1', lonlat: [56.0676, 54.7665], xy: proj([56.0676, 54.7665]) },
  city: shapes.filter((s) => s.level === 'city').map((s) => ({ name: s.name, d: toPath(s.rings), osm: s.osm }))[0] || null,
  districts: shapes.filter((s) => s.level === 'district').map((s) => ({
    name: s.name,
    slug: slugMap[s.name] || s.name.toLowerCase(),
    osm: s.osm,
    d: toPath(s.rings),
    label: centroid(s.rings[0]),
  })),
}

await writeFile('data/ufa.json', JSON.stringify(out))
console.log(`\nviewBox ${out.viewBox}   shop at ${out.shop.xy}`)
console.log(out.districts.map((d) => `  ${d.name.padEnd(20)} label ${d.label}`).join('\n'))
console.log('bytes:', JSON.stringify(out).length)
