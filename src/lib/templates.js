// Templates aplicáveis a uma obra ao ser criada
// (marcos do cronograma + pendências sugeridas)

export const FASES = [
  { id: 'pre_producao', label: 'Pré-produção', cor: '#3b82f6' },
  { id: 'producao', label: 'Produção', cor: '#f59e0b' },
  { id: 'pos_producao', label: 'Pós-produção', cor: '#10b981' },
]

export const FASE_MAP = Object.fromEntries(FASES.map(f => [f.id, f]))

export const MARCOS_PADRAO = [
  { fase: 'pre_producao', marco: 'medicao',             label: 'Medição no local',                         ordem: 1 },
  { fase: 'pre_producao', marco: 'aprovacao_projeto',   label: 'Aprovação do projeto executivo',           ordem: 2 },
  { fase: 'pre_producao', marco: 'aprovacao_amostras',  label: 'Aprovação de amostras (cores/materiais)',  ordem: 3 },
  { fase: 'pre_producao', marco: 'liberacao_producao',  label: 'Liberação para produção',                  ordem: 4 },
  { fase: 'producao',     marco: 'producao_iniciada',   label: 'Produção iniciada',                        ordem: 5 },
  { fase: 'producao',     marco: 'producao_concluida',  label: 'Produção concluída',                       ordem: 6 },
  { fase: 'pos_producao', marco: 'entrega_canteiro',    label: 'Entrega no canteiro',                      ordem: 7 },
  { fase: 'pos_producao', marco: 'montagem',            label: 'Montagem / instalação',                    ordem: 8 },
  { fase: 'pos_producao', marco: 'vistoria_final',      label: 'Vistoria final',                           ordem: 9 },
]

export const TIPOS_PENDENCIA = [
  { id: 'cliente',  label: 'Cliente / Aprovação',          cor: '#8b5cf6' },
  { id: 'medicao',  label: 'Medição',                      cor: '#3b82f6' },
  { id: 'compras',  label: 'Compras / Materiais',          cor: '#f59e0b' },
  { id: 'canteiro', label: 'Canteiro / Construtora',       cor: '#ef4444' },
  { id: 'outro',    label: 'Outro',                        cor: '#6b7280' },
]

export const TIPO_PENDENCIA_MAP = Object.fromEntries(TIPOS_PENDENCIA.map(t => [t.id, t]))

export const PENDENCIAS_SUGERIDAS = [
  { tipo: 'medicao',  titulo: 'Agendar medição no local' },
  { tipo: 'cliente',  titulo: 'Cliente aprovar projeto executivo' },
  { tipo: 'cliente',  titulo: 'Cliente aprovar amostras (cor/material)' },
  { tipo: 'cliente',  titulo: 'Cliente definir puxadores e ferragens' },
  { tipo: 'compras',  titulo: 'Confirmar prazo de materiais especiais (importados/sob encomenda)' },
  { tipo: 'canteiro', titulo: 'Construtora finalizar alvenaria' },
  { tipo: 'canteiro', titulo: 'Construtora deixar pontos elétricos preparados' },
]

export const STATUS_MARCO = [
  { id: 'pendente',    label: 'Pendente',     cor: '#9ca3af' },
  { id: 'em_andamento',label: 'Em andamento', cor: '#f59e0b' },
  { id: 'concluido',   label: 'Concluído',    cor: '#10b981' },
  { id: 'atrasado',    label: 'Atrasado',     cor: '#ef4444' },
]

export const STATUS_MARCO_MAP = Object.fromEntries(STATUS_MARCO.map(s => [s.id, s]))

export const STATUS_PENDENCIA = [
  { id: 'aberta',    label: 'Aberta',    cor: '#f59e0b' },
  { id: 'resolvida', label: 'Resolvida', cor: '#10b981' },
  { id: 'cancelada', label: 'Cancelada', cor: '#9ca3af' },
]

export const STATUS_PENDENCIA_MAP = Object.fromEntries(STATUS_PENDENCIA.map(s => [s.id, s]))

// Helper: detecta marcos atrasados (data_alvo no passado e status != concluido)
export function isAtrasado(marco) {
  if (marco.status === 'concluido' || marco.status === 'atrasado') return marco.status === 'atrasado'
  if (!marco.data_alvo) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return new Date(marco.data_alvo) < hoje
}
