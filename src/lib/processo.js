// Processo da obra — 8 etapas com checklists e gates (Modelo Padrão Ouro, Seções 3 e 4).
// O catálogo vive aqui (front); o estado marcado fica em obras.checklist (jsonb).

// As 8 etapas do ciclo de vida da obra, em ordem, com a descrição do gate de transição.
export const OBRA_ETAPAS = [
  { id: 'contrato',    label: 'Contrato e Kick-off', cor: '#6366f1', gate: 'Contrato assinado + sinal recebido + pasta da obra criada' },
  { id: 'pre_medicao', label: 'Pré-medição',         cor: '#3b82f6', gate: 'Projeto aprovado pelo cliente + materiais definidos' },
  { id: 'medicao',     label: 'Medição',             cor: '#06b6d4', gate: 'Medidas confirmadas + projeto executivo validado' },
  { id: 'producao',    label: 'Produção',            cor: '#f59e0b', gate: 'Todas as peças produzidas + controle de qualidade aprovado' },
  { id: 'expedicao',   label: 'Expedição',           cor: '#ef4444', gate: 'Checklist de expedição completo + carga conferida' },
  { id: 'entrega',     label: 'Entrega',             cor: '#8b5cf6', gate: 'Material entregue + protocolo assinado' },
  { id: 'montagem',    label: 'Montagem',            cor: '#ec4899', gate: 'Montagem concluída + vistoria interna aprovada' },
  { id: 'finalizacao', label: 'Finalização',         cor: '#10b981', gate: 'Termo de aceite assinado + obra encerrada' },
]

export const OBRA_ETAPA_MAP = Object.fromEntries(OBRA_ETAPAS.map(e => [e.id, e]))

// Checklists por etapa (item + papel responsável), conforme Seção 4 do documento.
export const CHECKLIST_TEMPLATES = {
  contrato: [
    { key: 'contrato_assinado',   label: 'Contrato assinado por ambas as partes', papel: 'G. Comercial' },
    { key: 'sinal_recebido',      label: 'Sinal/primeira parcela recebida e confirmada', papel: 'G. Comercial' },
    { key: 'pasta_criada',        label: 'Pasta da obra criada (digital) com número do contrato', papel: 'G. Obra' },
    { key: 'cronograma_prelim',   label: 'Cronograma preliminar estimado e compartilhado com cliente', papel: 'G. Obra' },
    { key: 'projeto_recebido',    label: 'Projeto arquitetônico/referências recebidas e arquivadas', papel: 'G. Obra' },
    { key: 'contatos_registrados',label: 'Contatos de todos os stakeholders registrados (cliente, arquiteto, engenheiro)', papel: 'G. Obra' },
    { key: 'kickoff_realizado',   label: 'Reunião de kick-off realizada com cliente e/ou arquiteto', papel: 'G. Obra' },
    { key: 'ata_kickoff',         label: 'Ata de kick-off registrada com decisões e próximos passos', papel: 'G. Obra' },
    { key: 'obra_comunicada_pcp', label: 'Obra comunicada ao PCP com previsão de entrada em produção', papel: 'G. Obra' },
    { key: 'escopo_definido',     label: 'Escopo claramente definido (ambientes, peças, acabamentos)', papel: 'G. Obra' },
  ],
  pre_medicao: [
    { key: 'projeto_detalhado',     label: 'Projeto detalhado recebido da arquitetura (plantas, cortes, 3D)', papel: 'G. Obra' },
    { key: 'acabamentos_definidos', label: 'Revestimentos e acabamentos definidos com cliente/arquiteto', papel: 'G. Obra' },
    { key: 'materiais_especificados',label: 'Materiais e ferragens especificados', papel: 'G. Obra' },
    { key: 'instalacoes_mapeadas',  label: 'Pontos de eletricidade, hidráulica e climatização mapeados', papel: 'G. Obra' },
    { key: 'pendencias_civil',      label: 'Verificação de pendências de obra civil que impactam a marcenaria', papel: 'G. Obra' },
    { key: 'duvidas_tecnicas',      label: 'Lista de dúvidas técnicas levantada para resolver na medição', papel: 'G. Obra' },
    { key: 'orcamento_revisado',    label: 'Orçamento revisado após definições (se houver alterações)', papel: 'G. Obra' },
    { key: 'medicao_agendada',      label: 'Agendamento da medição confirmado com cliente/engenharia', papel: 'G. Obra' },
  ],
  medicao: [
    { key: 'equipamentos_conferidos', label: 'Equipamentos de medição conferidos antes da ida à obra', papel: 'G. Obra' },
    { key: 'medidas_levantadas',      label: 'Medidas de todos os ambientes levantadas e registradas', papel: 'G. Obra' },
    { key: 'registro_fotografico',    label: 'Registro fotográfico completo do local (paredes, pisos, teto, instalações)', papel: 'G. Obra' },
    { key: 'niveis_prumos',           label: 'Níveis e prumos verificados', papel: 'G. Obra' },
    { key: 'pontos_atencao',          label: 'Pontos de atenção anotados (tubulações, vigas, irregularidades)', papel: 'G. Obra' },
    { key: 'conferencia_projeto',     label: 'Conferência das medidas versus projeto arquitetônico', papel: 'G. Obra' },
    { key: 'divergencias_comunicadas',label: 'Divergências registradas e comunicadas ao arquiteto/engenheiro', papel: 'G. Obra' },
    { key: 'executivo_atualizado',    label: 'Projeto executivo atualizado com medidas reais', papel: 'G. Obra' },
    { key: 'executivo_aprovado',      label: 'Projeto executivo aprovado formalmente pelo cliente', papel: 'G. Obra' },
    { key: 'op_gerada',               label: 'Ordem de produção gerada e encaminhada ao PCP', papel: 'G. Obra' },
  ],
  producao: [
    { key: 'op_priorizada',      label: 'Ordem de produção recebida e priorizada no planejamento', papel: 'G. PCP' },
    { key: 'materiais_estoque',  label: 'Materiais necessários em estoque ou com pedido de compra emitido', papel: 'G. PCP' },
    { key: 'lista_corte',        label: 'Lista de corte gerada e validada', papel: 'Coord. Chão de Fábrica' },
    { key: 'producao_iniciada',  label: 'Produção iniciada conforme programação', papel: 'Coord. Chão de Fábrica' },
    { key: 'avanco_registrado',  label: 'Acompanhamento diário do avanço registrado', papel: 'Coord. Chão de Fábrica' },
    { key: 'cq_processo',        label: 'Controle de qualidade em processo (peça a peça)', papel: 'Coord. Chão de Fábrica' },
    { key: 'desvios_comunicados',label: 'Desvios comunicados imediatamente ao G. PCP e G. Obra', papel: 'Coord. Chão de Fábrica' },
    { key: 'acabamento_concluido',label: 'Acabamento e pintura/verniz concluídos', papel: 'Coord. Chão de Fábrica' },
    { key: 'ferragens_aplicadas',label: 'Ferragens aplicadas e testadas', papel: 'Coord. Chão de Fábrica' },
    { key: 'inspecao_final',     label: 'Inspeção final de qualidade antes de liberar para expedição', papel: 'G. PCP' },
  ],
  expedicao: [
    { key: 'pecas_conferidas',     label: 'Todas as peças conferidas versus lista de produção/projeto', papel: 'Coord. Expedição' },
    { key: 'pecas_agrupadas',      label: 'Peças separadas e agrupadas por ambiente/cômodo', papel: 'Coord. Expedição' },
    { key: 'embalagem',            label: 'Embalagem adequada (proteção contra riscos e impactos)', papel: 'Coord. Expedição' },
    { key: 'etiquetagem',          label: 'Etiquetagem de volumes com identificação (obra, ambiente, peça)', papel: 'Coord. Expedição' },
    { key: 'kits_ferragens',       label: 'Ferragens e acessórios separados em kits por ambiente', papel: 'Coord. Expedição' },
    { key: 'registro_carga',       label: 'Registro fotográfico da carga antes do embarque', papel: 'Coord. Expedição' },
    { key: 'romaneio_gerado',      label: 'Romaneio de entrega gerado e anexado', papel: 'Coord. Expedição' },
    { key: 'transporte_agendado',  label: 'Transporte agendado em sincronia com escala de montagem', papel: 'Coord. Expedição' },
    { key: 'recebimento_confirmado',label: 'Confirmação de recebimento no local agendada com cliente/engenharia', papel: 'G. Obra' },
  ],
  entrega: [
    { key: 'acesso_verificado',  label: 'Condições de acesso ao local verificadas (elevador, escadas, portaria)', papel: 'Coord. Montagem' },
    { key: 'material_conferido', label: 'Material descarregado e conferido no local com romaneio', papel: 'Montador Líder' },
    { key: 'danos_registrados',  label: 'Danos de transporte registrados (se houver) com foto', papel: 'Montador Líder' },
    { key: 'protocolo_assinado', label: 'Protocolo de recebimento assinado pelo responsável no local', papel: 'Montador Líder' },
    { key: 'material_armazenado',label: 'Material armazenado em local seguro e protegido na obra', papel: 'Montador Líder' },
    { key: 'gobra_informado',    label: 'G. Obra informado sobre status da entrega', papel: 'Coord. Montagem' },
  ],
  montagem: [
    { key: 'condicoes_local',      label: 'Verificação das condições do local (limpeza, energia, água)', papel: 'Montador Líder' },
    { key: 'conferencia_executivo',label: 'Conferência do projeto executivo no local antes de iniciar', papel: 'Montador Líder' },
    { key: 'ferramentas_conferidas',label: 'Ferramentas e equipamentos conferidos', papel: 'Montador Líder' },
    { key: 'protecao_instalada',   label: 'Proteção de pisos e paredes instalada', papel: 'Montador Líder' },
    { key: 'montagem_executada',   label: 'Montagem executada conforme projeto (ambiente por ambiente)', papel: 'Equipe Montagem' },
    { key: 'niveis_verificados',   label: 'Níveis e alinhamentos verificados após montagem de cada peça', papel: 'Montador Líder' },
    { key: 'ferragens_reguladas',  label: 'Ferragens reguladas (portas, gavetas, corrediças)', papel: 'Equipe Montagem' },
    { key: 'arremates',            label: 'Acabamentos e arremates instalados', papel: 'Equipe Montagem' },
    { key: 'limpeza_diaria',       label: 'Limpeza do local realizada ao final de cada dia', papel: 'Equipe Montagem' },
    { key: 'registro_diario',      label: 'Registro fotográfico do progresso diário enviado ao G. Obra', papel: 'Montador Líder' },
    { key: 'pendencias_registradas',label: 'Pendências registradas com foto e descrição', papel: 'Montador Líder' },
    { key: 'vistoria_interna',     label: 'Vistoria interna concluída (antes de chamar o cliente)', papel: 'G. Obra' },
  ],
  finalizacao: [
    { key: 'vistoria_cliente',     label: 'Vistoria com cliente agendada e realizada', papel: 'G. Obra' },
    { key: 'pendencias_levantadas',label: 'Lista de pendências/ajustes levantada com o cliente', papel: 'G. Obra' },
    { key: 'pendencias_corrigidas',label: 'Pendências corrigidas e re-vistoriadas', papel: 'Coord. Montagem' },
    { key: 'registro_final',       label: 'Registro fotográfico final de todos os ambientes', papel: 'G. Obra' },
    { key: 'termo_aceite',         label: 'Termo de aceite/vistoria final assinado pelo cliente', papel: 'G. Obra' },
    { key: 'manual_entregue',      label: 'Manual de uso e conservação entregue ao cliente', papel: 'G. Obra' },
    { key: 'garantia_formalizada', label: 'Garantia formalizada e prazos informados', papel: 'G. Obra' },
    { key: 'parcela_final',        label: 'Parcela final faturada/cobrada', papel: 'G. Comercial' },
    { key: 'obra_encerrada',       label: 'Obra encerrada no sistema/controle interno', papel: 'G. Obra' },
    { key: 'pesquisa_satisfacao',  label: 'Pesquisa de satisfação enviada ao cliente', papel: 'G. Comercial' },
    { key: 'licoes_aprendidas',    label: 'Lições aprendidas registradas (se aplicável)', papel: 'G. Obra' },
  ],
}

// ===== Helpers =====
export function itensDaEtapa(etapaId) {
  return CHECKLIST_TEMPLATES[etapaId] || []
}

export function etapaInfo(etapaId) {
  return OBRA_ETAPA_MAP[etapaId] || OBRA_ETAPAS[0]
}

export function indiceEtapa(etapaId) {
  const i = OBRA_ETAPAS.findIndex(e => e.id === etapaId)
  return i < 0 ? 0 : i
}

export function proximaEtapa(etapaId) {
  return OBRA_ETAPAS[indiceEtapa(etapaId) + 1] || null
}

export function etapaAnterior(etapaId) {
  return OBRA_ETAPAS[indiceEtapa(etapaId) - 1] || null
}

export function itemMarcado(obra, etapaId, key) {
  return !!obra?.checklist?.[etapaId]?.[key]?.ok
}

// { marcados, total } de uma etapa
export function progressoEtapa(obra, etapaId) {
  const itens = itensDaEtapa(etapaId)
  const marcados = itens.filter(i => itemMarcado(obra, etapaId, i.key)).length
  return { marcados, total: itens.length }
}

// Gate fechado = todos os itens da etapa marcados
export function gateCompleto(obra, etapaId) {
  const { marcados, total } = progressoEtapa(obra, etapaId)
  return total > 0 && marcados === total
}

export function etapaAtual(obra) {
  return obra?.etapa_atual || 'contrato'
}
