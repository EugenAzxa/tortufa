// Renders the app icons the manifest and iOS ask for out of assets/favicon.svg.
// Rerun after changing the favicon: node tools/make-icons.mjs
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const SRC = 'assets/favicon.svg'
const OUT = 'assets/icons'
const BG = '#fdf8f8' // the favicon's own ground, so the full-bleed icons have no seam
await mkdir(OUT, { recursive: true })

const plain = (size, file) => sharp(SRC, { density: 600 }).resize(size, size).png().toFile(`${OUT}/${file}`)

// full-bleed: the platform crops these (Android to a circle or squircle, iOS to its
// rounded square), so the cake sits inside the safe zone on a flat ground
const bleed = async (size, file, scale) => {
  const inner = Math.round(size * scale)
  const art = await sharp(SRC, { density: 600 }).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: 'center' }]).png().toFile(`${OUT}/${file}`)
}

await plain(192, 'icon-192.png')
await plain(512, 'icon-512.png')
await bleed(512, 'maskable-512.png', 0.72)
await bleed(180, 'apple-touch-icon.png', 0.86)
console.log('icons written to', OUT)
