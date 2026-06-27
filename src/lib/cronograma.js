import { CRONOGRAMA_FASES_PADRAO } from './constants'
import { diasAte } from './itemStatus'

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
