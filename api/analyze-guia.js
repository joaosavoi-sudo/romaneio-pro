// Vercel Serverless Function - proxy para análise de Guia Fechada via Claude API
// Aceita PDF (base64) ou URL do Google Sheets

export const config = {
  maxDuration: 180, // 3 minutos
}

const AI_PROMPT_GUIA = `Você analisa uma "Guia Fechada" da Top Móveis (marcenaria de móveis sob medida).
Extraia APENAS dados explícitos no documento. NÃO invente.
Se um campo não aparece, deixe string vazia (""). Para quantidade, use 1 quando não especificada.

IMPORTANTE: Sua resposta deve começar EXATAMENTE com "{" e terminar EXATAMENTE com "}".
NÃO inclua texto explicativo antes ou depois. NÃO use blocos markdown \`\`\`json. APENAS JSON puro.

Schema obrigatório:
{
  "obra": {
    "numero_guia": "695-2025",
    "cliente": "PJS LEGACY CAPITAL LTDA",
    "endereco": "endereço completo da OBRA (onde os móveis serão instalados), com cidade/UF",
    "arquiteto": "nome do(a) arquiteto(a)"
  },
  "moveis": [
    {
      "codigo": "17.1",
      "ambiente": "Hall",
      "nome": "descrição resumida em uma linha curta (max 80 chars)",
      "descricao": "descrição completa do item",
      "dimensoes": "4,45x2,80m",
      "acabamento_interno": "...",
      "acabamento_externo": "...",
      "incluido": "...",
      "nao_incluido": "...",
      "quantidade": 1,
      "observacoes": "...",
      "projeto_recebido": "data + nome do arquivo do arquiteto"
    }
  ]
}

Regras:
- "endereco" da obra = onde os móveis serão instalados (NUNCA o do escritório)
- "codigo" = número do item (ex: "17.1", "17.2")
- "nome" CURTO. "descricao" pode ser longo.
- IGNORE valores monetários (R$).
- Inclua TODOS os móveis da guia.
- Para textos longos, use \\n (quebra de linha escapada) em vez de quebrar a string JSON.`

// Tenta consertar JSON truncado contando braces/brackets abertos e fechando-os
function tryRepairTruncated(text) {
  let depthObj = 0
  let depthArr = 0
  let inString = false
  let escape = false
  for (const ch of text) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depthObj++
    else if (ch === '}') depthObj--
    else if (ch === '[') depthArr++
    else if (ch === ']') depthArr--
  }
  // Cortar string aberta no fim, se houver
  let repaired = text
  if (inString) {
    const lastQuote = repaired.lastIndexOf('"')
    if (lastQuote >= 0) repaired = repaired.substring(0, lastQuote) + '"'
  }
  // Remover vírgula trailing antes de fechar
  repaired = repaired.replace(/,\s*$/, '')
  // Fechar arrays/objetos abertos
  repaired += ']'.repeat(Math.max(0, depthArr))
  repaired += '}'.repeat(Math.max(0, depthObj))
  return repaired
}

function parseAIResponse(text) {
  let cleaned = text.trim()

  // Remove markdown ```json ... ```
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) cleaned = fence[1].trim()

  // 1. Tentar JSON puro
  try { return JSON.parse(cleaned) } catch {}

  // 2. Cortar entre primeiro { e último }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const subset = cleaned.substring(firstBrace, lastBrace + 1)
    try { return JSON.parse(subset) } catch {}
  }

  // 3. JSON truncado? Tentar reparar fechando braces/brackets
  if (firstBrace >= 0) {
    const fromBrace = cleaned.substring(firstBrace)
    const repaired = tryRepairTruncated(fromBrace)
    try { return JSON.parse(repaired) } catch {}
  }

  // Falha: lança erro com snippet pra debug
  const snippet = cleaned.substring(0, 500)
  const err = new Error('JSON inválido')
  err.snippet = snippet
  err.fullLength = cleaned.length
  throw err
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Use POST' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'ANTHROPIC_API_KEY não configurada no Vercel',
    })
  }

  try {
    const { csv_content } = req.body || {}

    if (!csv_content || typeof csv_content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'csv_content ausente. Envie o conteúdo CSV/TSV no body.',
      })
    }

    console.log(`[analyze-guia] Tabela recebida: ${csv_content.length} chars`)

    const userContent = [
      {
        type: 'text',
        text: `${AI_PROMPT_GUIA}\n\nCONTEÚDO DA TABELA:\n\n${csv_content}`,
      },
    ]

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 175000)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        messages: [{ role: 'user', content: userContent }],
      }),
    }).finally(() => clearTimeout(timer))

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}))
      const msg =
        anthropicRes.status === 401
          ? 'Chave da API Anthropic inválida'
          : anthropicRes.status === 429
            ? 'Limite de requisições atingido. Tente em alguns minutos.'
            : errBody?.error?.message || `Erro Anthropic ${anthropicRes.status}`
      console.error('[analyze-guia] Anthropic error:', anthropicRes.status, errBody)
      return res.status(500).json({ success: false, error: msg })
    }

    const json = await anthropicRes.json()
    const text = json?.content?.[0]?.text
    const stopReason = json?.stop_reason
    const usage = json?.usage

    console.log(`[analyze-guia] Resposta IA - stop_reason: ${stopReason}, output_tokens: ${usage?.output_tokens}, length: ${text?.length}`)
    console.log(`[analyze-guia] Início da resposta: ${text?.substring(0, 200)}`)
    console.log(`[analyze-guia] Fim da resposta: ...${text?.substring(Math.max(0, (text?.length || 0) - 200))}`)

    if (!text) {
      return res.status(500).json({ success: false, error: 'Resposta vazia da IA' })
    }

    let data
    try {
      data = parseAIResponse(text)
    } catch (parseErr) {
      console.error('[analyze-guia] Parse falhou. Snippet:', parseErr.snippet)
      console.error('[analyze-guia] Full length:', parseErr.fullLength, 'stop_reason:', stopReason)
      const hint = stopReason === 'max_tokens'
        ? ' A resposta foi cortada por atingir o limite de tokens. Tente novamente.'
        : ''
      return res.status(500).json({
        success: false,
        error: `IA retornou JSON inválido.${hint}`,
        debug: {
          stopReason,
          outputTokens: usage?.output_tokens,
          snippet: parseErr.snippet,
          fullLength: parseErr.fullLength,
        },
      })
    }

    // Validação básica
    if (!data?.obra) {
      return res.status(200).json({
        success: false,
        error: 'IA não conseguiu extrair os dados da obra. Verifique se o documento é uma guia fechada.',
        rawResponse: data,
      })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ success: false, error: 'Timeout - IA demorou mais de 3 minutos' })
    }
    console.error('[analyze-guia] Erro:', err)
    return res.status(500).json({ success: false, error: err.message || 'Erro desconhecido' })
  }
}
