// Generates the PWA PNG icons (flat-colour dumbbell) with no image deps.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [0x0e, 0x11, 0x16]
const FG = [0x4a, 0xde, 0x80]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const png = (size, rgba) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Draws a dumbbell centred in the canvas, scaled by `inset` (share of the
// canvas left empty around it — maskable icons need a fat safe margin).
const render = (size, inset) => {
  const buf = Buffer.alloc(size * size * 4)
  const px = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px(x, y, BG)

  const s = size * (1 - inset * 2)
  const ox = size * inset
  const oy = size * inset
  const rect = (x, y, w, h, r) => {
    const x0 = Math.round(ox + x * s), y0 = Math.round(oy + y * s)
    const w0 = Math.round(w * s), h0 = Math.round(h * s), r0 = r * s
    for (let y1 = 0; y1 < h0; y1++) {
      for (let x1 = 0; x1 < w0; x1++) {
        const dx = Math.min(x1, w0 - 1 - x1), dy = Math.min(y1, h0 - 1 - y1)
        if (dx < r0 && dy < r0 && Math.hypot(r0 - dx, r0 - dy) > r0) continue
        px(x0 + x1, y0 + y1, FG)
      }
    }
  }
  rect(0.02, 0.30, 0.11, 0.40, 0.035) // outer plate, left
  rect(0.15, 0.22, 0.13, 0.56, 0.04)  // inner plate, left
  rect(0.28, 0.43, 0.44, 0.14, 0.03)  // bar
  rect(0.72, 0.22, 0.13, 0.56, 0.04)  // inner plate, right
  rect(0.87, 0.30, 0.11, 0.40, 0.035) // outer plate, right
  return buf
}

for (const [file, size, inset] of [
  ['public/icon-192.png', 192, 0.14],
  ['public/icon-512.png', 512, 0.14],
  ['public/icon-512-maskable.png', 512, 0.24],
  ['public/icon-180.png', 180, 0.14],
]) {
  writeFileSync(file, png(size, render(size, inset)))
  console.log('wrote', file)
}
