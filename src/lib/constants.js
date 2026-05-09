export const ETAPAS = [
  { id: 'pre_montagem', label: 'Pré-montagem', cor: '#6b7280' },
  { id: 'romaneio', label: 'Romaneio', cor: '#3b82f6' },
  { id: 'acabamento', label: 'Acabamento', cor: '#f59e0b' },
  { id: 'conferencia', label: 'Conferência', cor: '#8b5cf6' },
  { id: 'embalagem', label: 'Embalagem', cor: '#10b981' },
  { id: 'expedicao', label: 'Expedição', cor: '#ef4444' },
]

export const ESTACOES = [
  { slug: 'acabamento', label: 'Acabamento', etapa: 'acabamento', cor: '#f59e0b' },
  { slug: 'conferencia', label: 'Conferência', etapa: 'conferencia', cor: '#8b5cf6' },
  { slug: 'embalagem', label: 'Embalagem', etapa: 'embalagem', cor: '#10b981' },
  { slug: 'expedicao', label: 'Expedição / Carga', etapa: 'expedicao', cor: '#ef4444' },
]

export const ESTACAO_MAP = Object.fromEntries(ESTACOES.map(e => [e.slug, e]))

export const ETAPA_MAP = Object.fromEntries(ETAPAS.map(e => [e.id, e]))

export const OBRA_STATUS = [
  { id: 'ativa', label: 'Ativa', cor: '#10b981' },
  { id: 'concluida', label: 'Concluída', cor: '#3b82f6' },
  { id: 'cancelada', label: 'Cancelada', cor: '#ef4444' },
]

export const MATERIAIS = [
  'MDF', 'MDP', 'Compensado', 'Madeira Maciça', 'OSB',
  'HDF', 'Fórmica', 'Vidro', 'Espelho', 'Acrílico', 'Outro',
]

// Status macro do item, derivado das etapas das peças (não persistido).
// Ordem importa: prioridade do mais "à frente" no fluxo.
export const ETAPA_ITEM_DERIVADA = {
  sem_pecas:      { id: 'sem_pecas',      label: 'Aguardando romaneio', cor: '#9ca3af' },
  em_producao:    { id: 'em_producao',    label: 'Em produção',         cor: '#3b82f6' },
  em_acabamento:  { id: 'em_acabamento',  label: 'Em acabamento',       cor: '#8b5cf6' },
  em_conferencia: { id: 'em_conferencia', label: 'Em conferência',      cor: '#06b6d4' },
  em_embalagem:   { id: 'em_embalagem',   label: 'Em embalagem',        cor: '#14b8a6' },
  expedido:       { id: 'expedido',       label: 'Expedido',            cor: '#f59e0b' },
}

// Status pós-expedição (preenchido manualmente quando ocorre — não há scanner no canteiro)
export const STATUS_POS_EXPEDICAO = {
  entregue_canteiro: { id: 'entregue_canteiro', label: 'Entregue no canteiro', cor: '#f97316' },
  em_montagem:       { id: 'em_montagem',       label: 'Em montagem',          cor: '#ea580c' },
  entregue:          { id: 'entregue',          label: 'Entregue',             cor: '#10b981' },
}

// Cores do semáforo (sempre calculado, nunca armazenado)
export const SEMAFORO = {
  verde:    { value: 'verde',    label: '🟢 Verde',    cor: '#10b981' },
  amarelo:  { value: 'amarelo',  label: '🟡 Amarelo',  cor: '#f59e0b' },
  vermelho: { value: 'vermelho', label: '🔴 Vermelho', cor: '#ef4444' },
}

export function proximaEtapa(etapaAtual) {
  const idx = ETAPAS.findIndex(e => e.id === etapaAtual)
  if (idx < 0 || idx >= ETAPAS.length - 1) return null
  return ETAPAS[idx + 1]
}

export function gerarCodigo(prefixo, numero) {
  return `${prefixo}-${String(numero).padStart(3, '0')}`
}
