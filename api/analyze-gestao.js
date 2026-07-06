// Vercel Serverless Function - Assistente IA de gestão
// Recebe o retrato (snapshot) das obras ativas e devolve insights priorizados.

export const config = {
  maxDuration: 180, // 3 minutos
}

const PRIORIDADES = ['alta', 'media', 'baixa']
const CATEGORIAS = ['compras', 'producao', 'acabamento', 'prazo', 'cliente', 'qualidade', 'outro']

const AI_PROMPT_GESTAO = `Você é o assistente de gestão da Top Móveis, uma marcenaria de móveis sob medida que opera pelo "Modelo Padrão Ouro de Gestão de Obras". Sua função é analisar o retrato atual das obras ativas e devolver os pontos críticos que a gestão precisa atacar AGORA, priorizados.

CONHECIMENTO DE DOMÍNIO (use nas suas análises):
- Ciclo de vida da obra (8 etapas, com gate de checklist entre elas): contrato → pré-medição → medição → produção → expedição → entrega → montagem → finalização. O campo "gate" mostra quantos itens do checklist da etapa atual já foram cumpridos (ex.: "6/10").
- Fluxo fabril das peças: pré-montagem → romaneio → acabamento → conferência → embalagem → expedição. "pecas_por_etapa" mostra onde a produção REALMENTE está.
- Cronograma da obra em 4 fases do prazo total: Definições (~10%), Fabricação (~40%), Acabamento/vistoria/embalagem (~15%), Montagem e finalização (~35%). Compare "decorrido_pct"/"fase_prevista" (onde a obra DEVERIA estar) com "pecas_por_etapa" (onde ela ESTÁ) para detectar atraso real.
- COMPRAS DE MATERIAIS ESPECIAIS: vidros, espelhos e acrílicos têm lead time de fornecedor de 15 a 30 dias. Eles precisam estar comprados/encomendados ANTES de a obra entrar na fase de acabamento/montagem. Se uma obra tem peças de Vidro/Espelho/Acrílico ainda no início do fluxo ("romaneio"/"pré-montagem") e a entrega está a menos de ~45 dias, é um alerta de compra antecipada.
- AMOSTRAS: SLA de 7 dias para cor/laca e 21 dias para lâmina/madeira/protótipo. Amostra atrasada ou não aprovada trava o acabamento da obra inteira.
- ASSISTÊNCIAS: SLA de 3 dias para agendar e 15 dias para concluir.
- COMUNICAÇÃO COM CLIENTE: cadência mínima quinzenal (14 dias). "dias_sem_contato_cliente" acima de 14 é falha de comunicação.
- SEMÁFORO dos itens: vermelho = bloqueado ou pendência vencida; amarelo = pendência/entrega próxima (≤7 dias). "bloqueio" traz o motivo do travamento.
- PRIORIZAÇÃO: pese sempre (1) proximidade da entrega ("dias_para_entrega" baixo ou negativo), (2) bloqueios e pendências vencidas, (3) descompasso entre fase prevista e produção real, (4) risco de compra tardia de materiais especiais. Obras com entrega mais próxima e mais travas vêm primeiro.
- "kpis_mes" traz os indicadores do mês corrente com meta e status (verde/amarelo/vermelho); use-os para o diagnóstico geral, não para insights por obra.

REGRAS:
- Baseie-se APENAS nos dados fornecidos. NÃO invente obras, itens, números ou datas.
- Gere entre 3 e 12 insights. Cada insight deve ser ACIONÁVEL: diga o que fazer, em qual obra, e por quê agora.
- Prioridade "alta" = risco direto de atrasar entrega ou parar produção nos próximos dias; "media" = precisa entrar na agenda da semana; "baixa" = atenção preventiva.
- Não repita o mesmo problema em vários insights; agrupe obras com o mesmo problema em um insight só (campo "obras").
- Escreva em português do Brasil, direto e sem jargão técnico de sistema.
- Dias negativos significam prazo VENCIDO (ex.: "dias_para_prazo": -3 = venceu há 3 dias).

IMPORTANTE: Sua resposta deve começar EXATAMENTE com "{" e terminar EXATAMENTE com "}".
NÃO inclua texto explicativo antes ou depois. NÃO use blocos markdown \`\`\`json. APENAS JSON puro.

Schema obrigatório:
{
  "resumo": "2 a 3 frases sobre o quadro geral das obras (o que está bem, onde está o maior risco)",
  "insights": [
    {
      "prioridade": "alta",
      "categoria": "compras",
      "titulo": "título curto e direto (máx 90 chars)",
      "detalhe": "explicação do problema com os números que o justificam (2-4 frases)",
      "obras": ["695-2025"],
      "acao": "ação concreta sugerida para a gestão executar"
    }
  ]
}

Valores permitidos:
- "prioridade": "alta" | "media" | "baixa"
- "categoria": "compras" | "producao" | "acabamento" | "prazo" | "cliente" | "qualidade" | "outro"
- "obras": array com os códigos das obras envolvidas (exatamente como aparecem no campo "codigo")`

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

// Garante que cada insight respeita o schema (valores fora da lista viram padrão)
function sanitizarInsights(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter(i => i && typeof i.titulo === 'string' && i.titulo.trim())
    .map(i => ({
      prioridade: PRIORIDADES.includes(i.prioridade) ? i.prioridade : 'media',
      categoria: CATEGORIAS.includes(i.categoria) ? i.categoria : 'outro',
      titulo: String(i.titulo).trim(),
      detalhe: typeof i.detalhe === 'string' ? i.detalhe.trim() : '',
      obras: Array.isArray(i.obras) ? i.obras.filter(o => typeof o === 'string') : [],
      acao: typeof i.acao === 'string' ? i.acao.trim() : '',
    }))
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
    const { snapshot } = req.body || {}

    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return res.status(400).json({
        success: false,
        error: 'snapshot ausente. Envie o retrato das obras no body.',
      })
    }

    const snapshotStr = JSON.stringify(snapshot)
    if (snapshotStr.length > 400000) {
      return res.status(400).json({
        success: false,
        error: 'Snapshot grande demais para análise.',
      })
    }

    console.log(`[analyze-gestao] Snapshot recebido: ${snapshotStr.length} chars, ${snapshot.obras?.length || 0} obra(s)`)

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
        max_tokens: 8192,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: `${AI_PROMPT_GESTAO}\n\nDADOS DAS OBRAS (JSON):\n\n${snapshotStr}`,
          }],
        }],
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
      console.error('[analyze-gestao] Anthropic error:', anthropicRes.status, errBody)
      return res.status(500).json({ success: false, error: msg })
    }

    const json = await anthropicRes.json()
    const text = json?.content?.[0]?.text
    const stopReason = json?.stop_reason
    const usage = json?.usage

    console.log(`[analyze-gestao] Resposta IA - stop_reason: ${stopReason}, output_tokens: ${usage?.output_tokens}, length: ${text?.length}`)

    if (!text) {
      return res.status(500).json({ success: false, error: 'Resposta vazia da IA' })
    }

    let data
    try {
      data = parseAIResponse(text)
    } catch (parseErr) {
      console.error('[analyze-gestao] Parse falhou. Snippet:', parseErr.snippet)
      console.error('[analyze-gestao] Full length:', parseErr.fullLength, 'stop_reason:', stopReason)
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

    const insights = sanitizarInsights(data?.insights)
    if (insights.length === 0) {
      return res.status(200).json({
        success: false,
        error: 'IA não retornou insights válidos. Tente novamente.',
        rawResponse: data,
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        resumo: typeof data.resumo === 'string' ? data.resumo.trim() : '',
        insights,
      },
      usage: {
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
      },
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ success: false, error: 'Timeout - IA demorou mais de 3 minutos' })
    }
    console.error('[analyze-gestao] Erro:', err)
    return res.status(500).json({ success: false, error: err.message || 'Erro desconhecido' })
  }
}
