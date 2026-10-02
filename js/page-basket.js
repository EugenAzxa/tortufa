/* page-basket.js — the order list. There's no checkout backend, so the basket
   composes a ready-to-send order and hands it to the phone, WhatsApp or clipboard. */
import { shell, catalog, basket, ufa, money, gram, esc, orderText, toast, discountActive, markFirstOrder } from './app.js'

shell('basket')
const c = await catalog()
const m = await ufa()

const linesEl = document.querySelector('[data-lines]')
const sumEl = document.querySelector('[data-sum]')

const paint = async () => {
  const lines = await basket.lines()
  const total = lines.reduce((s, l) => s + (l.item.price || 0) * l.n, 0)

  if (!lines.length) {
    linesEl.innerHTML = `<div class="empty">
      <p>Пока пусто.</p>
      <p style="padding-top:1.25rem"><a class="btn btn--berry" href="catalog.html">Выбрать торт</a></p>
    </div>`
    sumEl.innerHTML = ''
    return
  }

  linesEl.innerHTML = lines.map(({ item: i, n }) => `
    <div class="bline" data-slug="${i.slug}">
      ${i.img ? `<img src="${i.img.thumb}" alt="${esc(i.name)}" loading="lazy">` : '<div class="card__noshot" style="width:72px;height:72px;border-radius:10px"></div>'}
      <div>
        <a class="bline__name" href="tort.html?c=${encodeURIComponent(i.slug)}">${esc(i.title || i.name)}</a>
        <p class="bline__meta num">${gram(i.grams)}${i.perKg ? ` · ${money(i.perKg)}/кг` : ''}</p>
      </div>
      <div class="bline__right">
        <b class="num">${money((i.price || 0) * n)}</b>
        <div class="qty">
          <button data-dec aria-label="Меньше">−</button><span class="num">${n}</span><button data-inc aria-label="Больше">+</button>
        </div>
        <button class="meta" data-del style="text-decoration:underline">убрать</button>
      </div>
    </div>`).join('')

  const free = total >= m.delivery.freeFrom
  const need = m.delivery.freeFrom - total
  const disc = total >= 3000

  sumEl.innerHTML = `
    <div class="bsum">
      <div class="bsum__row"><span>Позиций</span><b class="num">${lines.reduce((s, l) => s + l.n, 0)}</b></div>
      <div class="bsum__row"><span>Доставка</span><b>${free ? 'бесплатно' : `от ${m.delivery.zones[0].price} ₽`}</b></div>
      ${disc ? `<div class="bsum__row" style="color:var(--ok)"><span>Скидка по акции цеха</span><b>−5%</b></div>` : ''}
      <div class="bsum__row bsum__row--total"><span>Итого</span><b class="num">${money(total)}</b></div>
      ${!free ? `<p class="meta">До бесплатной доставки – ${money(need)}</p>` : ''}
      <textarea data-text readonly aria-label="Текст заказа"></textarea>
      <div style="display:grid;gap:.5rem">
        <a class="btn btn--berry btn--wide" data-wa target="_blank" rel="noopener">Отправить в WhatsApp</a>
        <a class="btn btn--wide" href="tel:+79677472114">Позвонить +7 (967) 747-21-14</a>
        <button class="btn btn--ghost btn--wide" data-copy>Скопировать заказ</button>
        <button class="btn btn--ghost btn--wide" data-clear>Очистить корзину</button>
      </div>
      <p class="meta">Оплата – картой МИР/VISA/Mastercard через шлюз Сбербанка или наличными курьеру и в магазинах.</p>
    </div>`

  const text = orderText(lines, total)
  sumEl.querySelector('[data-text]').value = text
  sumEl.querySelector('[data-wa]').href = `https://wa.me/79677472114?text=${encodeURIComponent(text)}`
  // the app's first-order code goes out once; sending the order uses it up
  if (discountActive()) sumEl.querySelector('[data-wa]').addEventListener('click', markFirstOrder, { once: true })
  sumEl.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(text); toast('Заказ скопирован') }
    catch { sumEl.querySelector('[data-text]').select(); toast('Выделили – скопируйте вручную') }
  }
  sumEl.querySelector('[data-clear]').onclick = () => { basket.clear() }
}

linesEl.addEventListener('click', (e) => {
  const row = e.target.closest('[data-slug]')
  if (!row) return
  const slug = row.dataset.slug
  const cur = basket.all()[slug] || 0
  if (e.target.closest('[data-inc]')) basket.set(slug, cur + 1)
  else if (e.target.closest('[data-dec]')) basket.set(slug, cur - 1)
  else if (e.target.closest('[data-del]')) basket.set(slug, 0)
})

document.addEventListener('basket:change', paint)
paint()
