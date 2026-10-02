// Where to buy: reads the shop list from tortufa.ru/kontakt/, geocodes each address
// through Nominatim (one request a second, as its policy asks) and projects it with the
// same transform as the delivery map, so Ufa's shops land on the district map and the
// ones out of town are listed separately. Writes data/shops.json.
//   node tools/build-shops.mjs
import { readFile, writeFile } from 'node:fs/promises'

const SRC = 'https://tortufa.ru/kontakt/'
const UA = 'tortufa-magazine/1.0 (shop map build; info@tortufa.ru)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const map = JSON.parse(await readFile('data/ufa.json', 'utf8'))

const html = await (await fetch(SRC, { headers: { 'user-agent': UA } })).text()
const body = html.slice(html.indexOf('АДРЕСА И ТЕЛЕФОНЫ'), html.indexOf('реквизиты компании'))
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#171;|&laquo;/g, '«')
  .replace(/&#187;|&raquo;/g, '»').replace(/&#8212;|&#8211;/g, '–').replace(/\s+/g, ' ').trim()

// the page is a run of: bold title, then icon boxes whose <img alt> says what they hold
const KIND = { 'месторасположение': 'addr', 'телефон продаж': 'phone', 'время работы': 'hours' }
const token = /<p(?: style="text-align: left")?><span[^>]*font-weight: bold[^>]*>([\s\S]*?)<\/span><\/p>|alt="(месторасположение|телефон продаж|время работы)"[\s\S]*?<div class="icon-box-text[^"]*">([\s\S]*?)<\/div>/g
// A few titles are typed in another style and do not match, so a shop starts at its
// address, not at its title: otherwise the next address would overwrite this one.
const raw = []
let title = ''
for (const m of body.matchAll(token)) {
  if (m[1]) { title = text(m[1]); continue }
  const kind = KIND[m[2]]
  if (kind === 'addr') { raw.push({ title, addr: text(m[3]) }); title = '' }
  else if (raw.length) raw[raw.length - 1][kind] = text(m[3])
}

// The titles on the shop's page are typed by hand in mixed case («Магазин В Тск королевА»).
// These are the same places, named the way a sign would name them.
const NAMES = [
  [/Гагарина 25/, 'Фирменный магазин при цехе'],
  [/Гагарина 42/, 'ТСК «Гагаринский», место 40'],
  [/Ахметова/, 'ТК «Затон»'],
  [/Королева/, 'ТСК «Королёва»'],
  [/Верхнеторговая/, 'ТДК «Гостиный двор», центральный вход'],
  [/Цюрупы/, 'ТК «Центральный», зона «Фреш маркет»'],
  [/Первомайская/, 'ТСК «Первомайский», место 206'],
  [/Правды/, 'Дёма, ул. Правды'],
  [/Кольцевая/, 'ТРК «Меркурий», место 156'],
  [/Серебряная/, 'Рынок «Матрица», напротив Пекарни №1'],
  [/Школьная/, 'Магазин «Байрам»'],
  [/Чернышевского/, 'Чишмы'],
  [/Иглино/, 'Иглино'],
  [/Ферина/, 'В пекарне «Печка»'],
  [/Гвардейская/, 'ТК «Центр», Шакша'],
  [/Авдон/, 'Авдон'],
  [/Седова/, 'Благовещенск'],
  [/Перовской/, 'ТСК «Перовский»'],
  [/Рощинская, 91/, 'Нагаево, Рощинская 91/1'],
  [/Рощинская, 15/, 'Нагаево, Рощинская 15/3'],
  [/Губайдуллина/, 'ТК «Аркада», 1 этаж'],
  [/Красная Горка/i, 'Красная Горка'],
]

// What Nominatim should be asked, when the address as written does not find it.
const QUERY = [
  [/Гагарина 25/, 'улица Юрия Гагарина 25/1, Уфа'],
  [/Гагарина 42/, 'улица Юрия Гагарина 42, Уфа'],
  [/Ахметова/, 'улица Ахметова 299, Уфа'],
  [/Королева/, 'улица Королёва 14, Уфа'],
  [/Верхнеторговая/, 'Гостиный двор, Уфа'],
  [/Цюрупы/, 'улица Цюрупы 97, Уфа'],
  [/Первомайская/, 'Первомайская улица 65/1, Уфа'],
  [/Правды/, 'улица Правды 24, Уфа'],
  [/Кольцевая/, 'Кольцевая улица 65/4, Уфа'],
  [/Серебряная/, 'Серебряная улица, Зубово, Уфимский район'],
  [/Школьная/, 'Школьная улица 41, Булгаково'],
  [/Чернышевского/, 'улица Чернышевского 15, Чишмы'],
  [/Иглино/, 'улица Ленина 5, Иглино'],
  [/Ферина/, 'улица Ферина 16, Уфа'],
  [/Гвардейская/, 'Гвардейская улица 35, Уфа'],
  [/Авдон/, 'Советская улица 36, Авдон'],
  [/Седова/, 'улица Седова 110, Благовещенск, Башкортостан'],
  [/Перовской/, 'улица Софьи Перовской 17, Уфа'],
  [/Рощинская, 91/, 'Рощинская улица 91, Нагаево'],
  [/Рощинская, 15/, 'Рощинская улица 15, Нагаево'],
  [/Губайдуллина/, 'улица Губайдуллина 6, Уфа'],
  [/Красная Горка/i, 'Советская улица 68, Красная Горка, Башкортостан'],
]
const pick = (list, addr, fallback) => list.find(([re]) => re.test(addr))?.[1] || fallback

const [minLon, minLat, maxLon, maxLat] = map.bbox
const [, , W, H] = map.viewBox.split(' ').map(Number)
const spanX = (maxLon - minLon) * map.kx
const spanY = maxLat - minLat
const proj = ([lon, lat]) => [+(((lon - minLon) * map.kx * W) / spanX).toFixed(1), +((1 - (lat - minLat) / spanY) * H).toFixed(1)]

const geocode = async (q) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&accept-language=ru&countrycodes=ru`
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const a = await res.json()
  return a[0] ? [+(+a[0].lon).toFixed(5), +(+a[0].lat).toFixed(5)] : null
}

const shops = []
for (const r of raw) {
  if (!r.addr) continue
  const addr = r.addr.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ')
  const q = pick(QUERY, addr, addr)
  const lonlat = await geocode(q)
  await sleep(1100)
  const xy = lonlat ? proj(lonlat) : null
  // on the map only if it falls inside the city outline's frame
  const onMap = !!xy && xy[0] > 0 && xy[0] < W && xy[1] > 0 && xy[1] < H
  const town = /Уфа/.test(addr) ? 'Уфа' : (addr.match(/(Нагаево|Зубово|Булгаково|Чишмы|Иглино|Авдон|Благовещенск|Красная Горка)/i)?.[1] || 'Пригород')
  shops.push({
    name: pick(NAMES, addr, r.title),
    title: r.title,
    addr,
    town,
    phone: r.phone || null,
    hours: (r.hours || '').replace(/\s+/g, ''),
    lonlat,
    xy: onMap ? xy : null,
    main: /Гагарина 25/.test(addr),
  })
  console.log(`${lonlat ? (onMap ? 'map ' : 'out ') : 'MISS'} ${addr}`)
}

await writeFile('data/shops.json', JSON.stringify({ source: SRC, shops }, null, 1) + '\n')
console.log(`\n${shops.length} shops, ${shops.filter((s) => s.xy).length} on the map, ${shops.filter((s) => !s.lonlat).length} not found`)
