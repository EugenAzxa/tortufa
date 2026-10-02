import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const ROOT = process.cwd()
const T = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' }
createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p.endsWith('/')) p += 'index.html'
  const file = join(ROOT, normalize(p).replace(/^(\.\.[\/\\])+/, ''))
  try {
    const s = await stat(file)
    if (!s.isFile()) throw new Error('dir')
    res.writeHead(200, { 'content-type': T[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(await readFile(file))
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('404 ' + p)
  }
}).listen(4173, () => console.log('http://localhost:4173'))
