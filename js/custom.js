/* custom.js — what a customer adds on top of the recipe: roses, berries, an inscription.
   Shared by the constructor and the app, so a cake built in one opens the same in the
   other (the query string carries it: r recipe, p piping, b berry, t text, i ink,
   f font). None of this is in the catalogue, so none of it is priced. */

// berries the workshop bakes with (colours from its own catalogue lexicon)
export const BERRIES = [
  { key: 'strawberry', label: 'Клубника', color: '#D9304A', shape: 'strawberry' },
  { key: 'raspberry', label: 'Малина', color: '#C21E45', shape: 'raspberry' },
  { key: 'cherry', label: 'Вишня', color: '#8E1B2C', shape: 'cherry' },
  { key: 'currant', label: 'Смородина', color: '#4A1E3D', shape: 'currant' },
]
export const INKS = [
  { key: 'choco', label: 'Шоколад', color: '#4a2a1c' },
  { key: 'berry', label: 'Малиновый', color: '#b0123f' },
  { key: 'white', label: 'Белый', color: '#fffaf2' },
  { key: 'gold', label: 'Золотой', color: '#c79a3b' },
]
export const FONTS = [
  { key: 'script', label: 'Прописью', css: '"Marck Script", cursive', style: '' },
  { key: 'hand', label: 'От руки', css: '"Caveat", cursive', style: '600' },
  { key: 'serif', label: 'Строго', css: '"Playfair Display", serif', style: 'italic 700' },
]
export const IDEAS = ['С днём рождения!', 'Любимой маме', 'С юбилеем!', 'Поздравляем!', 'Спасибо!', 'С 8 Марта']
export const MAX_TEXT = 40

export const berryOf = (key) => BERRIES.find((b) => b.key === key) || null
export const inkOf = (key) => INKS.find((i) => i.key === key) || INKS[0]
export const fontOf = (key) => FONTS.find((f) => f.key === key) || FONTS[0]

/** decoration from a query string, with safe defaults */
export const readDecor = (q, defaults = {}) => ({
  piping: q.has('p') ? q.get('p') !== '0' : defaults.piping ?? false,
  berry: berryOf(q.get('b'))?.key ?? (q.has('p') ? null : defaults.berry ?? null),
  text: (q.get('t') || '').slice(0, MAX_TEXT),
  ink: inkOf(q.get('i')).key,
  font: fontOf(q.get('f')).key,
})

export const writeDecor = (q, d) => {
  q.set('p', d.piping ? '1' : '0')
  q.set('i', d.ink)
  q.set('f', d.font)
  if (d.berry) q.set('b', d.berry); else q.delete('b')
  if (d.text) q.set('t', d.text); else q.delete('t')
  return q
}

/** the order lines for the decoration */
export const decorLines = (d) => {
  const lines = []
  const parts = [d.piping && 'розочки из крема', berryOf(d.berry)?.label.toLowerCase()].filter(Boolean)
  if (parts.length) lines.push(`Украшение: ${parts.join(', ')}`)
  if (d.text) lines.push(`Надпись: «${d.text.replace(/\n/g, ' / ')}» (${inkOf(d.ink).label.toLowerCase()}, ${fontOf(d.font).label.toLowerCase()})`)
  return lines
}

/** options for the WebGL cake */
export const cakeDecor = (d) => ({ piping: d.piping, berries: berryOf(d.berry) })

/** paint the inscription once its webfont is in */
export async function paintText(cake, d) {
  const f = fontOf(d.font)
  try { await document.fonts.load(`${f.style} 64px ${f.css}`, d.text || 'А') } catch {}
  cake.setInscription?.({ text: d.text, color: inkOf(d.ink).color, font: f.css, style: f.style })
}

/** the WebGL cake where the device can draw it, the flat one otherwise */
export async function makeCake(canvas, item, opts, Flat) {
  try {
    const { CakeGL, webglOK } = await import('./cake-gl.js')
    if (webglOK()) return { cake: new CakeGL(canvas, item, opts), gl: true }
  } catch (e) { console.warn('WebGL cake unavailable, drawing the flat one', e) }
  return { cake: new Flat(canvas, item, { open: !!opts.open }), gl: false }
}
