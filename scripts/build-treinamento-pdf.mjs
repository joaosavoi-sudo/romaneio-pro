// Gera docs/TREINAMENTO.pdf a partir de docs/TREINAMENTO.md
// Uso: node scripts/build-treinamento-pdf.mjs
// Caminho: Markdown -> HTML estilizado (marked) -> PDF (Edge headless).

import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { marked } from 'marked'

const MD = resolve('docs/TREINAMENTO.md')
const HTML = resolve('docs/TREINAMENTO.html')
const PDF = resolve('docs/TREINAMENTO.pdf')

// Slug compatível com o GitHub (e com os links do Sumário): minúsculas,
// mantém letras/números acentuados, descarta o resto, espaços viram hífen.
function slugify(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

const body = marked.parse(readFileSync(MD, 'utf8'), { gfm: true, breaks: false })

// Injeta id nos títulos (h2..h4) para o índice/âncoras funcionarem também no PDF.
const bodyWithIds = body.replace(
  /<h([2-4])>([\s\S]*?)<\/h\1>/g,
  (_, lvl, inner) => `<h${lvl} id="${slugify(inner)}">${inner}</h${lvl}>`,
)

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Romaneio Pro — Treinamento</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.55; font-size: 10.5pt; margin: 0; }

  h1 { color: #065f46; font-size: 23pt; margin: 0 0 6px; padding: 0 0 10px; border-bottom: 3px solid #10b981; }
  h2 { color: #065f46; font-size: 14pt; margin: 24px 0 9px; padding: 4px 0 4px 11px; border-left: 4px solid #10b981; border-bottom: 1px solid #d1fae5; page-break-after: avoid; }
  h3 { color: #111827; font-size: 11.5pt; margin: 15px 0 6px; page-break-after: avoid; }

  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 6px 22px; padding: 0; }
  li { margin: 3px 0; }
  ol li { margin: 4px 0; }

  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #ecfdf5; color: #065f46; }
  tr:nth-child(even) td { background: #f9fafb; }

  code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; font-family: Consolas, monospace; font-size: 9.5pt; color: #334155; }

  /* Blocos de diagrama / fluxo */
  pre { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 11px 13px; font-size: 10pt; line-height: 1.7; white-space: pre-wrap; word-break: keep-all; page-break-inside: avoid; }
  pre code { background: none; padding: 0; color: #14532d; }

  /* Callouts (blockquote) */
  blockquote { margin: 10px 0; padding: 8px 13px; background: #eff6ff; border-left: 4px solid #60a5fa; color: #1e3a5f; border-radius: 0 6px 6px 0; page-break-inside: avoid; }
  blockquote p { margin: 3px 0; }

  hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
  strong { color: #111827; }
  a { color: #047857; text-decoration: none; }
</style></head>
<body>${bodyWithIds}</body></html>`

writeFileSync(HTML, html, 'utf8')
console.log('HTML gerado:', HTML)

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(p => existsSync(p))

if (!EDGE) {
  console.log('Edge nao encontrado. Abra docs/TREINAMENTO.html e use Ctrl+P -> Salvar como PDF.')
  process.exit(0)
}

const userDir = mkdtempSync(resolve(tmpdir(), 'edge-pdf-'))
const url = 'file:///' + HTML.replace(/\\/g, '/')

execFileSync(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--user-data-dir=${userDir}`,
  `--print-to-pdf=${PDF}`,
  url,
], { stdio: 'inherit' })

if (existsSync(PDF) && statSync(PDF).size > 0) {
  console.log('PDF gerado:', PDF, '(' + Math.round(statSync(PDF).size / 1024) + ' KB)')
} else {
  console.log('Falha ao gerar PDF via Edge. Use o fallback: abrir docs/TREINAMENTO.html e Ctrl+P -> Salvar como PDF.')
  process.exit(1)
}
