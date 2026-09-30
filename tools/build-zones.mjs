// Adds the delivery zones to data/ufa.json.
// Prices and wording are exactly those published on tortufa.ru/oplata_dostavka/;
// each neighbourhood is geocoded through Nominatim and projected with the same
// transform build-map.mjs used, so the pins land where the places really are.
import { readFile, writeFile } from 'node:fs/promises'

const UA = 'tortufa-magazine/1.0 (delivery map build; info@tortufa.ru)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const map = JSON.parse(await readFile('data/ufa.json', 'utf8'))

// zone → price, straight from the shop's own published table
const ZONES = [
  { key: 'sipailovo', price: 250, tone: '#e0aeae', places: [{ name: 'Сипайлово', q: 'микрорайон Сипайлово, Октябрьский район, Уфа' }] },
  { key: 'chernikovka', price: 400, tone: '#d99494', places: [
    { name: 'Черниковка', q: 'Черниковка, Уфа' },
    { name: 'Инорс', q: 'микрорайон Инорс, Калининский район, Уфа' },
  ] },
  { key: 'oktyabrya', price: 450, tone: '#c96d8b', places: [
    { name: 'Пр. Октября', q: 'проспект Октября, Уфа' },
    { name: 'Зелёная роща', q: 'Зелёная роща, Уфа' },
  ] },
  { key: 'center', price: 600, tone: '#bf1771', places: [{ name: 'Центр', q: 'Гостиный двор, Уфа' }] },
  { key: 'edge', price: 700, tone: '#8e1256', places: [
    { name: 'Затон', q: 'микрорайон Затон, Ленинский район, Уфа' },
    { name: 'Дёма', q: 'Дёма, Уфа' },
    { name: 'Шакша', q: 'Шакша, Уфа' },
    { name: 'Нижегородка', q: 'Нижегородка, Уфа' },
  ] },
]

const [minLon, minLat, maxLon, maxLat] = map.bbox
const kx = map.kx
const [, , W, H] = map.viewBox.split(' ').map(Number)
const spanX = (maxLon - minLon) * kx
const spanY = maxLat - minLat
const proj = ([lon, lat]) => [
  +(((lon - minLon) * kx * W) / spanX).toFixed(1),
  +((1 - (lat - minLat) / spanY) * H).toFixed(1),
]

const geocode = async (q) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&accept-language=ru`
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
  if (!res.ok) throw new Error(res.status)
  const a = await res.json()
  return a[0] ? [parseFloat(a[0].lon), parseFloat(a[0].lat)] : null
}

const zones = []
for (const z of ZONES) {
  const places = []
  for (const p of z.places) {
    const ll = await geocode(p.q)
    await sleep(1100)
    if (!ll) { console.log(`MISS ${p.name}`); continue }
    const xy = proj(ll)
    const inside = xy[0] > 0 && xy[0] < W && xy[1] > 0 && xy[1] < H
    places.push({ name: p.name, lonlat: ll, xy })
    console.log(`${inside ? 'ok  ' : 'OFF '} ${p.name.padEnd(14)} ${ll.map((n) => n.toFixed(4)).join(', ')} -> ${xy.join(', ')}`)
  }
  zones.push({ ...z, places: places.map((p) => ({ name: p.name, xy: p.xy, lonlat: p.lonlat })) })
}

map.delivery = {
  freeFrom: 1000,
  noSlotFrom: 2000,
  pickup: 'Самовывоз из всех магазинов — бесплатно',
  window: 'Заказ с 8:00 до 20:00 — доставка на следующий день с 8:00 до 15:00, без указания конкретного времени',
  suburb: { label: 'Пригороды Уфы', price: 1000, tone: '#5e0d39' },
  zones,
  source: 'https://tortufa.ru/oplata_dostavka/',
}

// which districts each zone mostly covers — used to tint the polygons
map.districtZone = {
  sovetsky: 'center',
  leninsky: 'center',
  kirovsky: 'oktyabrya',
  oktyabrsky: 'sipailovo',
  ordzhonikidzevsky: 'chernikovka',
  kalininsky: 'chernikovka',
  demsky: 'edge',
}

await writeFile('data/ufa.json', JSON.stringify(map))
console.log('\nzones:', zones.map((z) => `${z.key} ${z.price}₽ (${z.places.length})`).join(' · '))
console.log('bytes:', JSON.stringify(map).length)
