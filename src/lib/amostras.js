import { diasAte } from './itemStatus'

// Tipos de amostra + SLA padrão (dias) — do Modelo Ouro: laca 7d, lâmina/protótipo 21d.
export const TIPOS_AMOSTRA = [
  { id: 'cor_laca',            label: 'Cor / Laca',          slaDias: 7,  cor: '#8b5cf6' },
  { id: 'lamina',             label: 'Lâmina',              slaDias: 21, cor: '#f59e0b' },
  { id: 'madeira_tingimento', label: 'Madeira / Tingimento', slaDias: 21, cor: '#b45309' },
  { id: 'prototipo',          label: 'Protótipo',           slaDias: 21, cor: '#0ea5e9' },
  { id: 'outro',              label: 'Outro',               slaDias: 7,  cor: '#6b7280' },
]
export const TIPO_AMOSTRA_MAP = Object.fromEntries(TIPOS_AMOSTRA.map(t => [t.id, t]))

export const STATUS_AMOSTRA = [
  { id: 'solicitada',  label: 'Solicitada',           cor: '#9ca3af' },
  { id: 'em_producao', label: 'Em produção',          cor: '#3b82f6' },
  { id: 'enviada',     label: 'Enviada p/ aprovação', cor: '#f59e0b' },
  { id: 'aprovada',    label: 'Aprovada',             cor: '#10b981' },
  { id: 'reprovada',   label: 'Reprovada',            cor: '#ef4444' },
]
export const STATUS_AMOSTRA_MAP = Object.fromEntries(STATUS_AMOSTRA.map(s => [s.id, s]))

// Status "encerrados" (não contam como em aberto / não atrasam).
export const STATUS_AMOSTRA_FECHADOS = ['aprovada', 'reprovada']

export function slaDiasTipo(tipo) {
  return TIPO_AMOSTRA_MAP[tipo]?.slaDias ?? 7
}

// Data limite padrão = data de solicitação + SLA do tipo. Retorna 'yyyy-mm-dd'.
export function prazoPadrao(tipo, dataSolicitacaoISO) {
  const base = dataSolicitacaoISO ? new Date(dataSolicitacaoISO) : new Date()
  if (isNaN(base.getTime())) return ''
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() + slaDiasTipo(tipo))
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Amostra atrasada = tem prazo vencido e ainda não foi aprovada/reprovada.
export function amostraAtrasada(a) {
  if (!a?.prazo || STATUS_AMOSTRA_FECHADOS.includes(a.status)) return false
  const d = diasAte(a.prazo)
  return d !== null && d < 0
}

export function amostraEmAberto(a) {
  return !STATUS_AMOSTRA_FECHADOS.includes(a?.status)
}
