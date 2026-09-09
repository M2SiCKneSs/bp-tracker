// Generates the PWA icons as PNGs with no image dependencies: an RGBA buffer is
// rasterised by hand and wrapped in a minimal PNG container (IHDR/IDAT/IEND).
// Run with: npm run icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const BRAND = [0xb3, 0x24, 0x3b, 0xff]
const INK = [0xff, 0xff, 0xff, 0xff]

/** An idealised ECG trace in unit coordinates; y grows downward. */
const TRACE = [
  [0.04, 0.55], [0.26, 0.55], [0.335, 0.44], [0.415, 0.70],
  [0.5, 0.20], [0.585, 0.68], [0.66, 0.55], [0.96, 0.55],
]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Perpendicular distance from a point to a segment, for round-capped strokes. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const tRaw = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  const t = clamp01(tRaw)
  const qx = ax + t * dx
  const qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}

/** Signed distance to a rounded rectangle; negative inside. */
function roundedRectSDF(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - (halfW - r)
  const qy = Math.abs(py) - (halfH - r)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - r
}

function blend(buf, i, color, alpha) {
  if (alpha <= 0) return
  const a = Math.min(1, alpha)
  for (let c = 0; c < 3; c++) buf[i + c] = Math.round(buf[i + c] * (1 - a) + color[c] * a)
  buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * a))
}

function render(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4, 0)
  // Antialiasing width in pixels; SDF values are converted to coverage across it.
  const aa = 1.0

  const inset = maskable ? 0 : 0.5 // maskable icons bleed to the edge
  const radius = maskable ? 0 : size * 0.22
  const half = size / 2 - inset

  // Content sits inside the maskable safe zone so a circular mask cannot clip it.
  const contentScale = maskable ? 0.6 : 0.88
  const contentOrigin = (size - size * contentScale) / 2
  const stroke = size * contentScale * 0.085

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const cx = x + 0.5 - size / 2
      const cy = y + 0.5 - size / 2

      const bg = maskable ? -1 : roundedRectSDF(cx, cy, half, half, radius)
      blend(buf, i, BRAND, clamp01(0.5 - bg / aa))

      // Trace, in content-local pixel space.
      const px = x + 0.5 - contentOrigin
      const py = y + 0.5 - contentOrigin
      const span = size * contentScale

      let best = Infinity
      for (let s = 0; s < TRACE.length - 1; s++) {
        const [ax, ay] = TRACE[s]
        const [bx, by] = TRACE[s + 1]
        const d = distToSegment(px, py, ax * span, ay * span, bx * span, by * span)
        if (d < best) best = d
      }
      blend(buf, i, INK, clamp01(0.5 + (stroke / 2 - best) / aa))
    }
  }
  return buf
}

// --- minimal PNG container -------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  // bytes 10-12 stay 0: deflate, adaptive filtering, no interlace

  // Each scanline is prefixed with filter type 0 (None).
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- outputs ---------------------------------------------------------------

mkdirSync(OUT, { recursive: true })

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-512-maskable.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
]

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), encodePNG(render(size, opts), size))
  console.log(`wrote ${name} (${size}x${size})`)
}

// Matching favicon, as vector.
const points = TRACE.map(([x, y]) => `${(x * 32).toFixed(2)},${(y * 32).toFixed(2)}`).join(' ')
writeFileSync(
  join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#b3243b"/>
  <polyline points="${points}" fill="none" stroke="#fff" stroke-width="2.4"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
)
console.log('wrote favicon.svg')
