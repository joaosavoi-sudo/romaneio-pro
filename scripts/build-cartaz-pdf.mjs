// Gera docs/CARTAZ-ESTACOES.pdf a partir de docs/cartaz-estacoes.html
// Uso: node scripts/build-cartaz-pdf.mjs
// A fonte (HTML) é editável e também pode ser impressa direto no navegador
// (abrir docs/cartaz-estacoes.html -> Ctrl+P -> A4 paisagem -> Salvar como PDF).

import { existsSync, statSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const HTML = resolve('docs/cartaz-estacoes.html')
const PDF = resolve('docs/CARTAZ-ESTACOES.pdf')

if (!existsSync(HTML)) {
  console.error('Nao encontrei a fonte:', HTML)
  process.exit(1)
}

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(p => existsSync(p))

if (!EDGE) {
  console.log('Edge nao encontrado. Abra docs/cartaz-estacoes.html e use Ctrl+P -> A4 paisagem -> Salvar como PDF.')
  process.exit(0)
}

const userDir = mkdtempSync(resolve(tmpdir(), 'edge-cartaz-'))
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
  console.log('Falha ao gerar PDF via Edge. Use o fallback: abrir docs/cartaz-estacoes.html e Ctrl+P.')
  process.exit(1)
}
