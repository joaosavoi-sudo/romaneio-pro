import { ETAPA_ITEM_DERIVADA, STATUS_POS_EXPEDICAO } from './constants'

// Dias entre hoje e uma data ISO/Date. Negativo = passado.
export function diasAte(data) {
  if (!data) return null
  const d = data instanceof Date ? data : new Date(data)
  if (isNaN(d.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - hoje.getTime()) / 86400000)
}

// Calcula a etapa atual do item. Prioridade:
//   1. motivo_bloqueio preenchido → PARADO/PENDENTE (vermelho)
//   2. status_pos_expedicao preenchido → label correspondente
//   3. derivado das peças
export function calcularEtapaItem(movel, pecasDoItem = []) {
  if (movel.motivo_bloqueio && movel.motivo_bloqueio.trim()) {
    return {
      id: 'bloqueado',
      label: 'PARADO/PENDENTE',
      cor: '#ef4444',
      motivo: movel.motivo_bloqueio,
    }
  }
  if (movel.status_pos_expedicao && STATUS_POS_EXPEDICAO[movel.status_pos_expedicao]) {
    return STATUS_POS_EXPEDICAO[movel.status_pos_expedicao]
  }
  if (!pecasDoItem || pecasDoItem.length === 0) {
    return ETAPA_ITEM_DERIVADA.sem_pecas
  }
  const etapas = pecasDoItem.map(p => p.etapa)
  if (etapas.every(e => e === 'expedicao')) return ETAPA_ITEM_DERIVADA.expedido
  if (etapas.some(e => e === 'embalagem')) return ETAPA_ITEM_DERIVADA.em_embalagem
  if (etapas.some(e => e === 'conferencia')) return ETAPA_ITEM_DERIVADA.em_conferencia
  if (etapas.some(e => e === 'acabamento')) return ETAPA_ITEM_DERIVADA.em_acabamento
  return ETAPA_ITEM_DERIVADA.em_producao
}

// Calcula o semáforo do item (sempre — não armazenado).
//   - vermelho: bloqueado OR pendência aberta com prazo vencido
//   - amarelo: pendência aberta sem prazo OU prazo ≤ 7d OU previsão entrega ≤ 7d e ainda não pós-expedição
//   - verde: caso contrário
export function calcularSemaforo(movel, pendenciasDoItem = []) {
  if (movel.motivo_bloqueio && movel.motivo_bloqueio.trim()) return 'vermelho'

  const abertas = pendenciasDoItem.filter(p => p.status === 'aberta')

  const venceuPendencia = abertas.some(p => {
    if (!p.prazo) return false
    const dias = diasAte(p.prazo)
    return dias !== null && dias < 0
  })
  if (venceuPendencia) return 'vermelho'

  const proximaPendencia = abertas.some(p => {
    if (!p.prazo) return true // sem prazo definido = aviso
    const dias = diasAte(p.prazo)
    return dias !== null && dias <= 7
  })
  if (proximaPendencia) return 'amarelo'

  if (movel.previsao_entrega && !movel.status_pos_expedicao) {
    const dias = diasAte(movel.previsao_entrega)
    if (dias !== null && dias <= 7) return 'amarelo'
  }

  return 'verde'
}
