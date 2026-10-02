/* page-opt.js — «Оптовикам».

   The sections and storage terms come from the workshop's own wholesale price list
   (tortufa.ru/prajs/). Its prices are from 2020, so none are shown: the page asks the
   sales department for a current one instead. How many items each section holds, and
   the examples, are read from today's catalogue. */
import { shell, catalog, esc, reveal, toast } from './app.js'

shell('opt')
const c = await catalog()

// section → storage terms as the price list states them, and the catalogue's categories
const RANGE = [
  { title: 'Торты', keep: '120 часов при +4 ± 2 °C', note: 'бисквитные, песочные, медовые, с суфле, слоёные, с меренгой, низкокалорийные', cats: ['torty'] },
  { title: 'Пирожные', keep: '120 часов при +4 ± 2 °C', note: 'поштучно и наборами', cats: ['pirozhnye'] },
  { title: 'Чак-чак и баурсак', keep: '1 месяц при +18 ± 3 °C', note: 'от 70 г до килограмма, горкой и сердцем', cats: ['chak-chak-i-baursak', 'chak-chak-i-baursak-zakaznoj'] },
  { title: 'Печенье', keep: '1 месяц при +18 ± 3 °C', note: 'песочное и слоёное, упаковка и коробка', cats: ['pechene'] },
  { title: 'Пряники и карамель', keep: 'по маркировке', note: '', cats: ['pryaniki-i-karamel'] },
  { title: 'Кексы', keep: '7 суток при +18 ± 3 °C', note: '', cats: ['keksy'] },
  { title: 'Пироги и выпечка', keep: '24–72 часа', note: 'пироги под заказ, изделия из дрожжевого теста', cats: ['pirogi-pirozhki', 'hlebobulochnye-izdeliya', 'vypechka-pod-zakaz-za-3-dnya'] },
  { title: 'Шоколадные фигуры', keep: '1 месяц при +18 ± 3 °C', note: 'молочный шоколад', cats: ['shokoladnye-figury'] },
  { title: 'Полуфабрикаты', keep: 'по маркировке', note: 'тесто, лапша, курник, вак-беляш', cats: ['polufabrikaty'] },
]

const rangeEl = document.querySelector('[data-range]')
rangeEl.innerHTML = RANGE.map((r) => {
  const items = c.items.filter((i) => i.cats.some((x) => r.cats.includes(x.slug)))
  // examples read like a shelf label: no shop-admin leftovers, no weights in brackets
  const clean = (n) => n.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/«\s*»/g, '').replace(/\s*\d+[.,]?\d*\s*(?:кг|гр|г)?\.?\s*$/i, '').replace(/\s+/g, ' ').trim()
  const eg = [...new Set(items.map((i) => i.title || i.name).filter((n) => !/копировать|товары для/i.test(n)).map(clean))].filter(Boolean).slice(0, 3)
  return `<a class="opt-cat" href="catalog.html?cat=${r.cats[0]}">
    <div class="opt-cat__top"><h3>${r.title}</h3><b class="num">${items.length || ''}</b></div>
    ${r.note ? `<p>${esc(r.note)}</p>` : ''}
    ${eg.length ? `<p class="opt-cat__eg">${eg.map(esc).join(' · ')}</p>` : ''}
    <p class="opt-cat__keep">Хранение: ${r.keep}</p>
  </a>`
}).join('')

/* ---------------------------------------------------------------- the request */
const KINDS = ['Магазин', 'Кафе или кофейня', 'Офис', 'Сеть', 'Пекарня, кулинария', 'Другое']
const form = document.querySelector('[data-form]')
const chips = (el, list, multi) => {
  el.innerHTML = list.map((t) => `<button type="button" class="chip" data-v="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]')
    if (!b) return
    const on = b.getAttribute('aria-pressed') !== 'true'
    if (!multi) el.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', 'false'))
    b.setAttribute('aria-pressed', String(on))
  })
}
chips(form.querySelector('[data-kind]'), KINDS, false)
chips(form.querySelector('[data-want]'), RANGE.map((r) => r.title), true)
const picked = (sel) => [...form.querySelectorAll(`${sel} [aria-pressed="true"]`)].map((b) => b.dataset.v)

let via = 'wa'
form.addEventListener('click', (e) => { const b = e.target.closest('[data-via]'); if (b) via = b.dataset.via })
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const f = new FormData(form)
  const phone = (f.get('phone') || '').trim()
  const err = form.querySelector('[data-err]')
  err.hidden = phone.replace(/\D/g, '').length >= 10
  if (!err.hidden) { form.querySelector('[name="phone"]').focus(); return }

  const lines = [
    'Здравствуйте! Хотим закупать продукцию «Уфа Десерт» оптом. Пришлите, пожалуйста, актуальный прайс и условия.',
    '',
    f.get('company') && `Компания: ${f.get('company')}`,
    picked('[data-kind]').length && `Кто мы: ${picked('[data-kind]').join(', ')}`,
    `Город: ${f.get('city') || '—'}`,
    picked('[data-want]').length && `Интересует: ${picked('[data-want]').join(', ')}`,
    f.get('note') && `Комментарий: ${f.get('note')}`,
    '',
    `Контакт: ${f.get('name') || ''} ${phone}`.trim(),
  ].filter((l) => l !== false && l !== null && l !== undefined && l !== 0).join('\n')

  if (via === 'mail') {
    location.href = `mailto:info@tortufa.ru?subject=${encodeURIComponent('Оптовая заявка')}&body=${encodeURIComponent(lines)}`
  } else {
    window.open(`https://wa.me/79677472114?text=${encodeURIComponent(lines)}`, '_blank', 'noopener')
  }
  toast('Заявка готова – осталось отправить')
})

reveal()
