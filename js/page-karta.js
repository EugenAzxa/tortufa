/* page-karta.js — the delivery map page. */
import { shell, ufa, money, reveal } from './app.js'
import { renderMap, zoneListHTML } from './map.js'

shell('karta')
const m = await ufa()

const host = document.querySelector('[data-map]')
const api = renderMap(host, m, { interactive: true, pins: true, labels: true })
document.querySelector('[data-zones]').innerHTML = zoneListHTML(m)

const zonesEl = document.querySelector('[data-zones]')
const panel = document.querySelector('[data-panel]')

const showZone = (zone, title, sub) => {
  panel.innerHTML = `
    <p class="kicker">${sub}</p>
    <h3 style="font-size:clamp(1.5rem,4vw,2.25rem);padding-block:.35rem .5rem">${title}</h3>
    <div class="map-panel__price">
      <b class="num">${zone ? money(zone.price) : '—'}</b>
      <span>курьер до двери</span>
    </div>
    <ul class="map-panel__list">
      <li><b>Бесплатно</b> при заказе от <span class="num">${m.delivery.freeFrom} ₽</span></li>
      <li><b>Без указания времени</b> — при заказе от <span class="num">${m.delivery.noSlotFrom} ₽</span></li>
      <li><b>Самовывоз</b> из магазинов — бесплатно</li>
    </ul>
    <p class="map-panel__note">${m.delivery.window}</p>
    ${zone ? `<p class="map-panel__where">Зона: ${zone.places.map((p) => p.name).join(', ')}</p>` : ''}`
  zonesEl.querySelectorAll('li').forEach((li) =>
    li.classList.toggle('is-on', !!zone && li.dataset.zone === zone.key))
}

host.addEventListener('map:select', (e) => {
  if (!e.detail) {
    panel.innerHTML = `<p class="kicker">Выберите район</p>
      <p style="color:var(--ink-2);font-size:.9375rem;padding-top:.5rem">Кликните по карте — здесь появятся цена курьера, условия и время доставки.</p>`
    zonesEl.querySelectorAll('li').forEach((li) => li.classList.remove('is-on'))
    return
  }
  showZone(e.detail.zone, `${e.detail.district.name} район`, 'Район Уфы')
})
host.addEventListener('map:place', (e) => {
  showZone(e.detail.zone, e.detail.place, 'Микрорайон')
})

/* ---------------------------------------------------------- calculator */
const sumEl = document.querySelector('[data-calc-sum]')
const outEl = document.querySelector('[data-calc-out]')
const calc = () => {
  const s = Math.max(0, +sumEl.value || 0)
  const free = s >= m.delivery.freeFrom
  outEl.classList.toggle('is-free', free)
  if (free) {
    outEl.innerHTML = s >= m.delivery.noSlotFrom
      ? `Доставка <b>бесплатно</b>. От ${m.delivery.noSlotFrom} ₽ привезём по адресу без указания времени.`
      : `Доставка <b>бесплатно</b> — заказ уже больше ${m.delivery.freeFrom} ₽.`
  } else {
    const need = m.delivery.freeFrom - s
    outEl.innerHTML = `До бесплатной доставки не хватает <b class="num">${money(need)}</b>. Иначе — курьер по зоне, от ${m.delivery.zones[0].price} ₽.`
  }
}
sumEl.addEventListener('input', calc)
calc()

/* ---------------------------------------------------------- facts + rules */
document.querySelector('[data-facts]').innerHTML = `
  <dl class="spec">
    <div><dt>Цех и самовывоз</dt><dd>Гагарина 25/1</dd></div>
    <div><dt>Часы</dt><dd>8:00 — 20:00</dd></div>
    <div><dt>Окно доставки</dt><dd>8:00 — 15:00</dd></div>
    <div><dt>Пригороды</dt><dd class="num">${m.delivery.suburb.price} ₽</dd></div>
  </dl>
  <div style="display:grid;gap:.5rem;padding-top:.75rem">
    <a class="btn btn--wide" href="tel:+79677472114">Позвонить и заказать</a>
    <a class="btn btn--ghost btn--wide" href="catalog.html">Собрать заказ</a>
  </div>`

document.querySelector('[data-rules]').innerHTML = `
  <li><b>1</b><span>Заказ, оформленный с 8:00 до 20:00, уезжает на следующий день. Окно доставки — с 8:00 до 15:00, без конкретного часа.</span></li>
  <li><b>2</b><span>От ${m.delivery.freeFrom} ₽ доставка бесплатная. Если заказ меньше — курьер считается по зоне: от ${m.delivery.zones[0].price} ₽ в Сипайлово до ${m.delivery.suburb.price} ₽ в пригороды.</span></li>
  <li><b>3</b><span>Торты и выпечку под заказ цех готовит 2–3 дня. Готовые торты из витрины можно забрать в тот же день самовывозом.</span></li>`

reveal()
