/* sw.js — lets the installed app open without a connection.

   Pages, code and data go to the network first and fall back to the last copy, so a
   deploy is picked up on the next open and nobody runs yesterday's scripts against
   today's catalogue. Only what never changes under the same name (three.js, photos,
   icons, fonts) is served from the cache first. */
const CACHE = 'tortufa-v2'
const SHELL = [
  'app.html', 'manifest.webmanifest',
  'css/main.css', 'css/components.css', 'css/app.css',
  'js/page-app.js', 'js/app.js', 'js/recipe.js', 'js/section.js', 'js/cake3d.js', 'js/cake-gl.js', 'js/custom.js',
  'js/vendor/three.min.js', 'data/catalog.json', 'assets/favicon.svg', 'assets/app-qr.svg',
]

// Vercel answers app.html with a redirect to /app. A redirected response cannot be
// replayed for a navigation, so each one is stored as a plain copy under the name asked.
const plain = (res) => (res.redirected ? new Response(res.body, { status: res.status, headers: res.headers }) : res)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    fetch(u).then((res) => { if (res.ok) return c.put(u, plain(res)) })))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const stable = (url) =>
  /\/js\/vendor\/|\/assets\//.test(url.pathname) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const own = url.origin === location.origin
  if (!own && !stable(url)) return

  if (stable(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    })))
    return
  }

  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = plain(res.clone()); caches.open(CACHE).then((c) => c.put(req, copy)) }
    return res
  }).catch(async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' })
    // offline on /app or /app?r=…: the stored app shell answers for any of them
    return hit || (req.mode === 'navigate' ? caches.match('app.html') : undefined)
  }))
})
