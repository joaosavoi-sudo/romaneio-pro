// Comunicação com o cliente (Modelo Ouro - Seção 5): cadência de contatos + gerador
// do update quinzenal.

// Pontos de contato obrigatórios ao longo da obra (Seção 5.1).
export const MOMENTOS_CONTATO = [
  { id: 'kickoff',         label: 'Resumo de kick-off',              canal: 'E-mail' },
  { id: 'medicao',         label: 'Confirmação de medição',          canal: 'E-mail/WhatsApp' },
  { id: 'inicio_producao', label: 'Aviso de início de fabricação',   canal: 'WhatsApp' },
  { id: 'quinzenal',       label: 'Update quinzenal de andamento',   canal: 'WhatsApp/E-mail' },
  { id: 'pre_entrega',     label: 'Agendamento de entrega/montagem', canal: 'E-mail + Ligação' },
  { id: 'montagem_diario', label: 'Update diário de montagem',       canal: 'WhatsApp' },
  { id: 'pos_montagem',    label: 'Convite para vistoria',           canal: 'E-mail + Ligação' },
  { id: 'followup',        label: 'Follow-up de satisfação (30 dias)', canal: 'Ligação' },
  { id: 'pendencia',       label: 'Comunicação de pendência/alerta', canal: 'WhatsApp/E-mail' },
  { id: 'outro',           label: 'Outro contato',                   canal: 'Outro' },
]

export const MOMENTO_MAP = Object.fromEntries(MOMENTOS_CONTATO.map(m => [m.id, m]))

export const CANAIS_CONTATO = ['WhatsApp', 'E-mail', 'Ligação', 'Presencial', 'Outro']

// Cadência recorrente padrão durante a obra (quinzenal).
export const INTERVALO_CONTATO_DIAS = 14

// Dias decorridos desde uma data (negativo se a data é futura). null se sem data.
export function diasDesde(data) {
  if (!data) return null
  const d = data instanceof Date ? new Date(data) : new Date(data)
  if (isNaN(d.getTime())) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((hoje.getTime() - d.getTime()) / 86400000)
}

export function addDias(data, dias) {
  const d = data instanceof Date ? new Date(data) : new Date(data)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  return d
}

export function fmtData(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR')
}

// Monta a mensagem de update quinzenal (template da Seção 5.3) com dados da obra.
export function gerarUpdateQuinzenal({ obra, pct, previsao, pendenciasCliente = [], proximosPassos, gestor }) {
  const pend = pendenciasCliente.length
    ? pendenciasCliente.map(t => `   - ${t}`).join('\n')
    : '   - Nenhuma no momento'
  return `Olá ${obra?.cliente || ''},

Segue a atualização da sua obra ${obra?.codigo || ''}:

• Status atual: ${pct != null ? `${pct}% concluído` : 'em andamento'}
• Previsão de entrega: ${previsao || 'a confirmar'}
• Pendências que dependem de você/arquitetura:
${pend}
• Próximos passos: ${proximosPassos?.trim() || 'seguimos conforme o cronograma'}

Estamos à disposição para qualquer dúvida.

Atenciosamente,
${gestor || '[Gestor de Obra]'}`
}
