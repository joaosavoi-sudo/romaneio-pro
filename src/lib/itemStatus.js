import { ETAPA_ITEM_DERIVADA } from './constants'

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
//   1. bloqueado → PARADO/PENDENTE
//   2. data_montagem_concluida → Entregue
//   3. data_inicio_montagem → Em montagem
//   4. data_entrega_canteiro → Entregue no canteiro
//   5. derivado das peças
export function calcularEtapaItem(movel, pecasDoItem = []) {
  if (movel.bloqueado) {
    return {
      id: 'bloqueado',
      label: 'PARADO/PENDENTE',
      cor: '#ef4444',
      motivo: movel.motivo_bloqueio || '',
    }
  }
  if (movel.data_montagem_concluida) {
    return { id: 'entregue', label: 'Entregue', cor: '#10b981' }
  }
  if (movel.data_inicio_montagem) {
    return { id: 'em_montagem', label: 'Em montagem', cor: '#ea580c' }
  }
  if (movel.data_entrega_canteiro) {
    return { id: 'entregue_canteiro', label: 'Entregue no canteiro', cor: '#f97316' }
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

// Sugere semáforo baseado em bloqueio + pendências do item + previsão entrega.
//   - vermelho: bloqueado OU pendência aberta com prazo vencido
//   - amarelo: pendência aberta sem prazo OU prazo ≤ 7d OU previsão entrega ≤ 7d e ainda não expedido
//   - verde: caso contrário
export function sugerirSemaforo(movel, pendenciasDoItem = [], etapaAtual = null) {
  if (movel.bloqueado) return 'vermelho'

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

  // Previsão de entrega próxima e ainda não expedido/entregue
  if (movel.previsao_entrega) {
    const dias = diasAte(movel.previsao_entrega)
    const jaPosExpedicao = etapaAtual && [
      'expedido', 'entregue_canteiro', 'em_montagem', 'entregue',
    ].includes(etapaAtual.id)
    if (dias !== null && dias <= 7 && !jaPosExpedicao) return 'amarelo'
  }

  return 'verde'
}
