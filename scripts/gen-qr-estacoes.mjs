// Gera os QR Codes das estações e injeta no docs/cartaz-estacoes.html.
// Uso:    node scripts/gen-qr-estacoes.mjs
//         QR_BASE_URL=https://meu-dominio node scripts/gen-qr-estacoes.mjs
//         node scripts/gen-qr-estacoes.mjs https://meu-dominio
//
// Cada QR aponta para  <BASE>/estacao/<slug>  — a MESMA URL que o app gera em
// Estações Móveis (src/pages/EstacaoIndex.jsx). Reaproveita o qrcode.react já
// instalado (via react-dom/server), sem dependência nova. Re-rodar é idempotente:
// só troca o conteúdo entre os marcadores <!-- QR:slug --> … <!-- /QR:slug -->.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { ESTACOES } from '../src/lib/constants.js'

const BASE = (process.env.QR_BASE_URL || process.argv[2] || 'https://romaneio-pro.vercel.app')
  .replace(/\/+$/, '')

const FILE = resolve('docs/cartaz-estacoes.html')
let html = readFileSync(FILE, 'utf8')

let ok = 0
const faltando = []

for (const est of ESTACOES) {
  const url = `${BASE}/estacao/${est.slug}`
  const svg = renderToStaticMarkup(
    createElement(QRCodeSVG, { value: url, size: 240, level: 'M', marginSize: 2 }),
  )
  const re = new RegExp(`(<!-- QR:${est.slug} -->)([\\s\\S]*?)(<!-- /QR:${est.slug} -->)`)
  if (!re.test(html)) {
    faltando.push(est.slug)
    continue
  }
  html = html.replace(re, `$1${svg}$3`)
  ok++
  console.log(`  ✓ ${est.label.padEnd(22)} → ${url}`)
}

if (faltando.length) {
  console.error(`\n✗ Marcadores não encontrados no HTML para: ${faltando.join(', ')}`)
  console.error('  (esperado: <!-- QR:slug --> … <!-- /QR:slug --> dentro de cada .qrbox)')
  process.exit(1)
}

writeFileSync(FILE, html, 'utf8')
console.log(`\nPronto: ${ok} QR gravados em ${FILE}`)
console.log(`Base: ${BASE}  —  regere o PDF com:  node scripts/build-cartaz-pdf.mjs`)
