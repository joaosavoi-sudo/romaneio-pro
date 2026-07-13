// Divide o CSV/TSV de uma Guia Fechada em partes para análise por IA em etapas
// (guias grandes estouravam o limite de 3 min da função em uma chamada única).
// O cabeçalho (dados da obra, no topo do documento) é repetido em cada parte;
// as fronteiras têm sobreposição para nenhum item se perder — duplicatas são
// removidas no merge (por código do item).

// Divide o texto em "linhas lógicas": uma célula com quebra de linha entre
// aspas continua pertencendo à mesma linha da planilha (vale p/ CSV e TSV).
function linhasLogicas(texto) {
  const linhas = []
  let atual = ''
  let dentroAspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (ch === '"') dentroAspas = !dentroAspas
    if (ch === '\n' && !dentroAspas) {
      linhas.push(atual)
      atual = ''
    } else if (ch !== '\r' || dentroAspas) {
      atual += ch
    }
  }
  if (atual.length > 0) linhas.push(atual)
  return linhas
}

// Retorna [{ conteudo, parte, total }]. Uma única parte = fluxo atual.
export function dividirEmPartes(texto, { maxChars = 24000, headerLinhas = 20, overlapLinhas = 8 } = {}) {
  if (texto.length <= maxChars) {
    return [{ conteudo: texto, parte: 1, total: 1 }]
  }

  const linhas = linhasLogicas(texto)
  const header = linhas.slice(0, headerLinhas).join('\n')
  const corpo = linhas.slice(headerLinhas)

  // Fatia o corpo em blocos de até ~maxChars (descontando o header repetido)
  const alvo = Math.max(4000, maxChars - header.length)
  const blocos = []
  let bloco = []
  let tamanho = 0
  for (const linha of corpo) {
    if (tamanho + linha.length > alvo && bloco.length > 0) {
      blocos.push(bloco)
      // sobreposição: repete as últimas linhas na próxima parte
      bloco = bloco.slice(-overlapLinhas)
      tamanho = bloco.reduce((acc, l) => acc + l.length + 1, 0)
    }
    bloco.push(linha)
    tamanho += linha.length + 1
  }
  if (bloco.length > 0) blocos.push(bloco)

  const total = blocos.length
  return blocos.map((b, i) => ({
    conteudo: `${header}\n--- CONTINUAÇÃO DO DOCUMENTO (trecho ${i + 1} de ${total}) ---\n${b.join('\n')}`,
    parte: i + 1,
    total,
  }))
}

// Junta os móveis extraídos das partes, removendo duplicatas da sobreposição
// (mesmo código de item → mantém a primeira ocorrência).
export function mesclarMoveis(listas) {
  const vistos = new Set()
  const resultado = []
  for (const lista of listas) {
    for (const m of lista || []) {
      const cod = (m.codigo || '').trim()
      if (cod) {
        if (vistos.has(cod)) continue
        vistos.add(cod)
      }
      resultado.push(m)
    }
  }
  return resultado
}
