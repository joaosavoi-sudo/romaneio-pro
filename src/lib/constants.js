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

export function proximaEtapa(etapaAtual) {
  const idx = ETAPAS.findIndex(e => e.id === etapaAtual)
  if (idx < 0 || idx >= ETAPAS.length - 1) return null
  return ETAPAS[idx + 1]
}

export function gerarCodigo(prefixo, numero) {
  return `${prefixo}-${String(numero).padStart(3, '0')}`
}
