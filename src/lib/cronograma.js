import { CRONOGRAMA_FASES_PADRAO, ETAPAS } from './constants'
import { diasAte } from './itemStatus'

// Ordem das etapas de peça (do scanner), para comparar "alcançou etapa X".
const ETAPA_ORDER = ETAPAS.map(e => e.id)
const idxEtapa = e => ETAPA_ORDER.indexOf(e)

// Índice da 1ª etapa de cada fase macro do cronograma (mapa acordado com a gestão):
//   Fabricação           = pré-montagem + romaneio        (entra em idx 0)
//   Acabamento/vistoria/embalagem = acabamento + conferência + embalagem (idx 2)
//   Montagem             = expedição + pós  → ignorado por ora (sem scanner no canteiro)
const FASE_DESDE_IDX = { fabricacao: 0, acabamento: idxEtapa('acabamento') }
// Limite (saída) de cada fase = entrada na fase seguinte:
const FASE_ATE_IDX = { fabricacao: idxEtapa('acabamento'), acabamento: idxEtapa('expedicao') }

// Deriva as DATAS REAIS de cada fase a partir do histórico das peças (peca_historico).
// Retorna { fabricacao?: {inicio, fim}, acabamento?: {inicio, fim} } com Date.
//   - inicio = primeira peça a entrar na fase
//   - fim    = quando a última peça saiu da fase (entrou na seguinte); null = em andamento
export function calcRealizado(pecas, historico) {
  if (!pecas || pecas.length === 0) return {}

  // primeira data em que cada peça entrou em cada etapa
  const firstEntry = {} // peca_id -> { etapa -> ms }
  for (const h of historico || []) {
    if (!h.etapa_nova || !h.created_at) continue
    const t = new Date(h.created_at).getTime()
    if (isNaN(t)) continue
    const m = firstEntry[h.peca_id] || (firstEntry[h.peca_id] = {})
    if (m[h.etapa_nova] == null || t < m[h.etapa_nova]) m[h.etapa_nova] = t
  }

  // primeira vez que a peça atingiu uma etapa de índice >= k (robusto a pulos de etapa)
  const primeiroAlcance = (p, k) => {
    const m = firstEntry[p.id] || {}
    let min = null
    ETAPA_ORDER.forEach((e, i) => {
      if (i >= k && m[e] != null && (min == null || m[e] < min)) min = m[e]
    })
    return min
  }
  const alcancou = (p, k) => idxEtapa(p.etapa) >= k || primeiroAlcance(p, k) != null

  const minMs = arr => (arr.length ? Math.min(...arr) : null)
  const maxMs = arr => (arr.length ? Math.max(...arr) : null)
  const toDate = ms => (ms == null ? null : new Date(ms))

  function faseRealizada(chave) {
    const desde = FASE_DESDE_IDX[chave]
    const ate = FASE_ATE_IDX[chave]
    // início: primeira peça a entrar na fase
    const entradas = pecas.map(p => {
      if (chave === 'fabricacao' && p.created_at) {
        // peça nasce em "romaneio" (sem registro de histórico) → usa a criação
        const c = new Date(p.created_at).getTime()
        const h = primeiroAlcance(p, desde)
        return isNaN(c) ? h : (h == null ? c : Math.min(c, h))
      }
      return primeiroAlcance(p, desde)
    }).filter(v => v != null)
    const inicio = minMs(entradas)
    if (inicio == null) return null
    // fim: só quando TODAS as peças saíram da fase (entraram na seguinte)
    const todasSairam = pecas.every(p => alcancou(p, ate))
    const saidas = pecas.map(p => primeiroAlcance(p, ate)).filter(v => v != null)
    const fim = todasSairam && saidas.length ? maxMs(saidas) : null
    return { inicio: toDate(inicio), fim: toDate(fim) }
  }

  const res = {}
  const fab = faseRealizada('fabricacao')
  if (fab) res.fabricacao = fab
  const acab = faseRealizada('acabamento')
  if (acab) res.acabamento = acab
  return res
}

// Soma uma quantidade de dias a uma data ISO/Date. Devolve Date.
export function addDays(data, dias) {
  const d = data instanceof Date ? new Date(data) : new Date(data)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + Math.round(dias))
  return d
}

// Formata Date como dd/mm/yyyy (pt-BR). Aceita Date ou string ISO.
export function fmtData(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR')
}

// Mescla as fases-padrão com os percentuais salvos em obra.cronograma_fases.
// Sempre devolve as 4 fases na ordem canônica, com label/cor da constante.
export function getFases(obra) {
  const salvos = {}
  if (Array.isArray(obra?.cronograma_fases)) {
    obra.cronograma_fases.forEach(f => {
      if (f && f.chave != null && f.pct != null) salvos[f.chave] = Number(f.pct)
    })
  }
  return CRONOGRAMA_FASES_PADRAO.map(f => ({
    ...f,
    pct: salvos[f.chave] != null ? salvos[f.chave] : f.pct,
  }))
}

// True se a obra (ou item) já tem cronograma definido (início + prazo em dias).
export function temCronograma(obra) {
  return !!(obra?.data_inicio && obra?.prazo_dias > 0)
}

// Cronograma a usar para um item: o próprio, se definido; senão herda o da obra.
// Funciona porque item e obra têm os mesmos campos { data_inicio, prazo_dias, cronograma_fases }.
export function cronogramaEfetivo(movel, obra) {
  return temCronograma(movel) ? movel : obra
}

// Soma dos percentuais das fases.
export function somaPct(fases) {
  return fases.reduce((acc, f) => acc + (Number(f.pct) || 0), 0)
}

// Para cada fase: percentual acumulado de início/fim e datas calculadas
// a partir de obra.data_inicio + obra.prazo_dias. Datas só existem se houver
// cronograma definido (senão dataInicio/dataFim ficam null).
export function calcFases(obra) {
  const fases = getFases(obra)
  const prazo = Number(obra?.prazo_dias) || 0
  const temBase = temCronograma(obra)
  let acc = 0
  return fases.map(f => {
    const inicioPct = acc
    const fimPct = acc + (Number(f.pct) || 0)
    acc = fimPct
    return {
      ...f,
      inicioPct,
      fimPct,
      dataInicio: temBase ? addDays(obra.data_inicio, (inicioPct / 100) * prazo) : null,
      dataFim: temBase ? addDays(obra.data_inicio, (fimPct / 100) * prazo) : null,
    }
  })
}

// Posição de "hoje" na barra (% 0–100) e a chave da fase corrente.
// Devolve null se não houver cronograma definido.
export function posicaoHoje(obra) {
  if (!temCronograma(obra)) return null
  const prazo = Number(obra.prazo_dias)
  // diasAte(data_inicio) é negativo quando o início já passou; dias decorridos = -diasAte
  const decorridos = -diasAte(obra.data_inicio)
  const pct = Math.max(0, Math.min(100, (decorridos / prazo) * 100))
  const fases = calcFases(obra)
  const corrente = fases.find(f => pct >= f.inicioPct && pct < f.fimPct) || fases[fases.length - 1]
  return { pct, faseChave: corrente?.chave || null }
}

// Data de entrega derivada (= data_inicio + prazo_dias) como string ISO yyyy-mm-dd,
// para gravar em obras.data_entrega_prometida. Null se faltar base.
export function dataEntregaDerivada(dataInicio, prazoDias) {
  if (!dataInicio || !(Number(prazoDias) > 0)) return null
  const d = addDays(dataInicio, Number(prazoDias))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
