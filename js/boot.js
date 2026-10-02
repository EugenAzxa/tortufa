/* boot.js — the loading screen: a cake turning while the page gets ready.

   Shown on the cover and in the app, once per browser session (a tiny inline script in
   <head> decides, before first paint, and adds .boot-on; without it — no JS, or a later
   page in the same session — the screen never appears at all).

   The cake on it is the flat canvas one: no dependencies, so it turns at once. What the
   bar measures is real: the fonts, the catalogue, the WebGL module and the first frame
   of the lit cake underneath. When those are in, the screen fades and the lit cake is
   already standing there. If anything hangs, the screen leaves on its own after 9s —
   it can delay the page, never hide it. */
import { Cake3D } from './cake3d.js'

const root = document.documentElement
const el = document.getElementById('boot')
if (el && root.classList.contains('boot-on')) run()

function run() {
  try { sessionStorage.setItem('tortufa.boot', '1') } catch {}
  const bar = el.querySelector('.boot__bar i')
  const pct = el.querySelector('.boot__pct')

  // a showpiece cake drawn from a real recipe shape: sponge, cream, jam, cream on top
  const cake = new Cake3D(el.querySelector('canvas'), {
    id: 7,
    layers: [
      { label: 'Ванильный бисквит', color: '#EFD59C', tex: 'sponge', h: 1, role: 'корж' },
      { label: 'Крем из сливок', color: '#FFF8EC', tex: 'cream', h: 0.5, role: 'прослойка' },
      { label: 'Малиновый конфитюр', color: '#C21E45', tex: 'jam', h: 0.3, role: 'начинка' },
      { label: 'Шоколадный бисквит', color: '#6B4130', tex: 'cocoa', h: 1, role: 'корж' },
      { label: 'Крем из сливок', color: '#FFF8EC', tex: 'cream', h: 0.5, role: 'прослойка' },
      { label: 'Малиновый конфитюр', color: '#C21E45', tex: 'jam', h: 0.3, role: 'начинка' },
      { label: 'Ванильный бисквит', color: '#EFD59C', tex: 'sponge', h: 1, role: 'корж' },
      { label: 'Крем из сливок', color: '#FBEFF0', tex: 'whipped', h: 0.34, role: 'обмазка' },
    ],
    decor: [{ label: 'Посыпка', color: '#BF1771', tex: 'sprinkle' }, { label: 'Посыпка', color: '#C21E45', tex: 'sprinkle' }, { label: 'Посыпка', color: '#6B4130', tex: 'sprinkle' }],
  }, { hint: false, spinDelay: 0, spinSpeed: 0.0011 })

  // each thing the page waits for, and how much of the bar it is worth
  const steps = []
  const track = (p, w) => {
    const s = { w, done: false }
    steps.push(s)
    Promise.resolve(p).catch(() => {}).finally(() => { s.done = true })
  }
  track(document.fonts?.ready, 1)
  track(fetch('data/catalog.json').then((r) => r.arrayBuffer()), 2)
  const glOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } })()
  if (glOK) {
    track(import('./cake-gl.js'), 3)
    // the lit cake's first frame, from whichever page owns it
    track(new Promise((res) => document.addEventListener('cake:ready', res, { once: true })), 2)
  }

  const total = steps.reduce((s, x) => s + x.w, 0)
  const target = () => steps.reduce((s, x) => s + (x.done ? x.w : 0), 0) / total
  let shown = 0
  let finished = false
  const t0 = performance.now()

  const finish = () => {
    if (finished) return
    finished = true
    el.classList.add('done')
    // the class alone hides it (opacity 0, visibility hidden); removal is housekeeping
    setTimeout(() => { cake.destroy(); el.remove(); root.classList.remove('boot-on') }, 800)
  }

  const tick = (t) => {
    if (finished) return
    // the bar eases toward what has really loaded, and never sits at 100 for long
    const goal = target()
    shown += (goal - shown) * 0.12
    if (goal - shown < 0.004) shown = goal
    bar.style.transform = `scaleX(${shown})`
    pct.textContent = `ПЕЧЁМ ${Math.round(shown * 100)}%`
    // at least a moment of cake, so a warm cache does not flash the screen
    if (shown >= 1 && t - t0 > 900) { finish(); return }
    if (t - t0 > 9000) { finish(); return }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
