// Vercel Serverless Function - proxy para análise de Guia Fechada via Claude API
// Aceita PDF (base64) ou URL do Google Sheets

export const config = {
  maxDuration: 180, // 3 minutos
}

const AI_PROMPT_GUIA = `Você analisa uma "Guia Fechada" da Top Móveis (marcenaria de móveis sob medida).
Extraia APENAS dados explícitos no documento. NÃO invente.
Se um campo não aparece, deixe string vazia (""). Para quantidade, use 1 quando não especificada.

Retorne APENAS JSON válido, sem markdown, sem texto extra antes ou depois.

Schema esperado:
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
      "nome": "descrição resumida em uma linha curta",
      "descricao": "descrição completa do item (texto longo)",
      "dimensoes": "4,45x2,80m",
      "acabamento_interno": "Lâmina de madeira carvalho natural...",
      "acabamento_externo": "Lâmina de madeira carvalho natural...",
      "incluido": "Pivô, perfil alumínio, fecho magnético oculto...",
      "nao_incluido": "Sem puxador, ...",
      "quantidade": 1,
      "observacoes": "...",
      "projeto_recebido": "05/01/2026 - 2025_12_30_JP_DET.MARCENARIA_R00"
    }
  ]
}

Regras importantes:
- "endereco" da obra é onde os móveis serão instalados (NUNCA o endereço do escritório do cliente ou da Top Móveis)
- "codigo" é o número do item da guia (ex: "17.1", "17.2", "18.1")
- "nome" deve ser CURTO (até ~80 caracteres), uma linha
- "descricao" pode ser longa (texto completo do item)
- IGNORE valores monetários (R$). Não capture valor unitário ou total.
- "projeto_recebido" combina a data com o nome do arquivo do arquiteto, se ambos aparecerem
- Inclua TODOS os móveis listados, mesmo que repitam ambiente`

function extractSheetsId(url) {
  const match = (url || '').match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

async function fetchSheetsCsv(sheetsUrl) {
  const id = extractSheetsId(sheetsUrl)
  if (!id) throw new Error('URL do Google Sheets inválida')
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
  const res = await fetch(csvUrl, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`Não consegui acessar o Sheets (${res.status}). Confira se está público (Compartilhar → "Qualquer pessoa com o link").`)
  }
  return await res.text()
}

function parseAIResponse(text) {
  // Remove markdown ```json ... ```
  let cleaned = text.trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) cleaned = fence[1].trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // Tentar achar primeiro { e último } válido
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1))
      } catch {}
    }
    throw new Error('IA retornou JSON inválido. Tente novamente.')
  }
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
    const { source, pdf_base64, sheets_url } = req.body || {}

    let userContent
    if (source === 'pdf') {
      if (!pdf_base64) {
        return res.status(400).json({ success: false, error: 'pdf_base64 ausente' })
      }
      userContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 },
        },
        { type: 'text', text: AI_PROMPT_GUIA },
      ]
    } else if (source === 'sheets') {
      if (!sheets_url) {
        return res.status(400).json({ success: false, error: 'sheets_url ausente' })
      }
      const csv = await fetchSheetsCsv(sheets_url)
      userContent = [
        {
          type: 'text',
          text: `${AI_PROMPT_GUIA}\n\nCONTEÚDO DA PLANILHA (CSV):\n\n${csv}`,
        },
      ]
    } else {
      return res.status(400).json({
        success: false,
        error: 'source deve ser "pdf" ou "sheets"',
      })
    }

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
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
      return res.status(500).json({ success: false, error: msg })
    }

    const json = await anthropicRes.json()
    const text = json?.content?.[0]?.text
    if (!text) {
      return res.status(500).json({ success: false, error: 'Resposta vazia da IA' })
    }

    const data = parseAIResponse(text)

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
    return res.status(500).json({ success: false, error: err.message || 'Erro desconhecido' })
  }
}
