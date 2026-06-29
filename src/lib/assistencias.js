import { diasAte } from './itemStatus'

export const STATUS_ASSISTENCIA = [
  { id: 'aberta',       label: 'Aberta',        cor: '#f59e0b' },
  { id: 'agendada',     label: 'Agendada',      cor: '#3b82f6' },
  { id: 'em_andamento', label: 'Em andamento',  cor: '#8b5cf6' },
  { id: 'concluida',    label: 'Concluída',     cor: '#10b981' },
  { id: 'cancelada',    label: 'Cancelada',     cor: '#9ca3af' },
]
export const STATUS_ASSISTENCIA_MAP = Object.fromEntries(STATUS_ASSISTENCIA.map(s => [s.id, s]))

// SLA padrão (dias a partir da solicitação)
export const SLA_AGENDAR_DIAS = 3
export const SLA_CONCLUIR_DIAS = 15

export const STATUS_ABERTOS = ['aberta', 'agendada', 'em_andamento']

function addDiasISO(baseISO, dias) {
  const d = baseISO ? new Date(baseISO) : new Date()
  if (isNaN(d.getTime())) return ''
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function prazoAgendarPadrao(dataSolicitacaoISO) {
  return addDiasISO(dataSolicitacaoISO, SLA_AGENDAR_DIAS)
}
export function prazoConcluirPadrao(dataSolicitacaoISO) {
  return addDiasISO(dataSolicitacaoISO, SLA_CONCLUIR_DIAS)
}

export function assistenciaEmAberto(a) {
  return STATUS_ABERTOS.includes(a?.status)
}

// Atrasada = aberta e algum prazo (agendar quando ainda não agendada, ou concluir) vencido.
export function assistenciaAtrasada(a) {
  if (!a || !STATUS_ABERTOS.includes(a.status)) return false
  const naoAgendou = a.status === 'aberta'
  if (naoAgendou && a.prazo_agendar) {
    const d = diasAte(a.prazo_agendar)
    if (d !== null && d < 0) return true
  }
  if (a.prazo_concluir) {
    const d = diasAte(a.prazo_concluir)
    if (d !== null && d < 0) return true
  }
  return false
}
