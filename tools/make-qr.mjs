// The QR code a desktop visitor scans to open the app on their phone.
// It points at the live site, so rerun this if the domain changes:
//   node tools/make-qr.mjs https://new-domain/app
import { writeFile } from 'node:fs/promises'
import QRCode from 'qrcode'

const url = process.argv[2] || 'https://tortufa.vercel.app/app'
const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#342d31', light: '#ffffff' } })
await writeFile('assets/app-qr.svg', svg)
console.log('assets/app-qr.svg ->', url)
