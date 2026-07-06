// KPIs do Modelo Ouro (Seção 9) — funções puras: recebem os dados já buscados
// e devolvem { id, label, valorFmt, meta, metaFmt, status, detalhes }.
// status: 'verde' (meta ok) | 'amarelo' (até ~10% da meta) | 'vermelho' | 'cinza' (sem dados)
import { dataEntregaDerivada } from './cronograma'
import { INTERVALO_CONTATO_DIAS } from './comunicacao'

// ===== Período (mês) =====

// mes: 1–12. Devolve { inicio, fim } como strings ISO yyyy-mm-dd.
export function mesPeriodo(ano, mes) {
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const mm = String(mes).padStart(2, '0')
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}` }
}

export function mesAnterior(ano, mes) {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
}

export function fmtMes(ano, mes) {
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const dentro = (data, p) => !!data && data >= p.inicio && data <= p.fim
const dataDe = ts => (ts ? String(ts).slice(0, 10) : null) // timestamptz → yyyy-mm-dd
const addDiasIso = (s, n) => {
  const d = new Date(s)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Datas (yyyy-mm-dd, ordenadas) em que itens do checklist de uma etapa do
// processo foram marcados — obras.checklist = { etapa: { key: { ok, por, em } } }
function datasChecklist(obra, etapaId) {
  const itens = obra?.checklist?.[etapaId] || {}
  return Object.values(itens)
    .filter(i => i?.ok && i?.em)
    .map(i => String(i.em).slice(0, 10))
    .sort()
}

// maiorMelhor: verde se valor >= meta; senão verde se valor <= meta
function farol(valor, meta, maiorMelhor = true) {
  if (valor == null) return 'cinza'
  if (maiorMelhor) {
    if (valor >= meta) return 'verde'
    return valor >= meta * 0.9 ? 'amarelo' : 'vermelho'
  }
  if (valor <= meta) return 'verde'
  return valor <= meta * 1.1 ? 'amarelo' : 'vermelho'
}

const pct = v => (v == null ? '—' : `${Math.round(v)}%`)
const num = (v, casas = 1) => (v == null ? '—' : v.toFixed(casas).replace('.', ','))

// Prazo efetivo da obra: o prometido ou o derivado do cronograma (início + prazo)
function prazoEfetivo(obra) {
  return obra.data_entrega_prometida || dataEntregaDerivada(obra.data_inicio, obra.prazo_dias)
}

// ===== KPI 1: % obras entregues no prazo (meta ≥85%) =====
export function kpiEntregasNoPrazo(obras, periodo) {
  const concluidas = obras.filter(o => dentro(o.data_conclusao, periodo))
  const comPrazo = concluidas.filter(o => prazoEfetivo(o))
  const semPrazo = concluidas.filter(o => !prazoEfetivo(o))
  const noPrazo = comPrazo.filter(o => o.data_conclusao <= prazoEfetivo(o))
  const atrasadas = comPrazo.filter(o => o.data_conclusao > prazoEfetivo(o))
  const valor = comPrazo.length > 0 ? (noPrazo.length / comPrazo.length) * 100 : null

  const detalhes = [
    ...atrasadas.map(o => {
      const dias = Math.round((new Date(o.data_conclusao) - new Date(prazoEfetivo(o))) / 86400000)
      return { texto: `${o.codigo} — ${o.cliente}: entregue com ${dias} dia(s) de atraso`, obraId: o.id }
    }),
    ...semPrazo.map(o => ({ texto: `${o.codigo} — ${o.cliente}: sem prazo definido (fora do cálculo)`, obraId: o.id })),
  ]
  return {
    id: 'entregas_prazo',
    label: 'Obras entregues no prazo',
    valor,
    valorFmt: pct(valor),
    metaFmt: '≥ 85%',
    status: farol(valor, 85),
    resumo: comPrazo.length > 0 ? `${noPrazo.length} de ${comPrazo.length} entrega(s) no mês` : 'Nenhuma entrega no mês',
    detalhes,
  }
}

// ===== KPI 2: taxa de retrabalho (meta ≤5%) =====
// Denominador (proxy de "total produzido no mês"): peças distintas movimentadas
// na fábrica no período (peca_historico).
export function kpiRetrabalho(retrabalhos, pecaHistorico, periodo) {
  const eventos = retrabalhos.filter(r => dentro(r.data, periodo))
  const qtde = eventos.reduce((acc, r) => acc + (r.quantidade || 1), 0)
  const produzidas = new Set(
    pecaHistorico.filter(h => dentro(dataDe(h.created_at), periodo)).map(h => h.peca_id)
  ).size
  const valor = produzidas > 0 ? (qtde / produzidas) * 100 : null
  return {
    id: 'retrabalho',
    label: 'Taxa de retrabalho',
    valor,
    valorFmt: pct(valor),
    metaFmt: '≤ 5%',
    status: farol(valor, 5, false),
    resumo: produzidas > 0
      ? `${qtde} peça(s) retrabalhada(s) / ${produzidas} movimentada(s)`
      : (qtde > 0 ? `${qtde} retrabalho(s), sem produção registrada no mês` : 'Sem produção no mês'),
    detalhes: eventos.map(r => ({
      texto: `${r.data.split('-').reverse().join('/')} — ${r.quantidade || 1} peça(s) · ${r.motivo || 'sem motivo informado'} (${r.origem})`,
      obraId: r.obra_id,
    })),
  }
}

// ===== KPI 3: pendências pós-montagem (meta ≤3 por obra) =====
// Obras montadas no período = concluídas no mês (data_conclusao). Início da
// montagem = 1ª marcação do checklist da etapa 'montagem'; sem checklist,
// janela de 30 dias antes da conclusão.
export function kpiPendenciasPosMontagem(obras, pendencias, periodo) {
  const montadas = obras.filter(o => dentro(o.data_conclusao, periodo))
  const detalhes = []
  let totalPend = 0
  montadas.forEach(o => {
    const marcas = datasChecklist(o, 'montagem')
    const inicioMontagem = marcas[0] || addDiasIso(o.data_conclusao, -30)
    const pend = pendencias.filter(p =>
      p.obra_id === o.id && dataDe(p.created_at) >= inicioMontagem
    )
    totalPend += pend.length
    detalhes.push({ texto: `${o.codigo} — ${o.cliente}: ${pend.length} pendência(s) desde ${inicioMontagem.split('-').reverse().join('/')}`, obraId: o.id })
  })
  const valor = montadas.length > 0 ? totalPend / montadas.length : null
  return {
    id: 'pendencias_pos_montagem',
    label: 'Pendências pós-montagem',
    valor,
    valorFmt: valor == null ? '—' : `${num(valor)} por obra`,
    metaFmt: '≤ 3 por obra',
    status: farol(valor, 3, false),
    resumo: montadas.length > 0 ? `${totalPend} pendência(s) em ${montadas.length} obra(s) concluída(s)` : 'Nenhuma obra concluída no mês',
    detalhes,
  }
}

// ===== KPI 4: NPS do cliente (meta ≥8.5) =====
export function kpiNps(obras, periodo) {
  const doMes = obras.filter(o => o.nps != null && dentro(o.nps_data, periodo))
  const todas = obras.filter(o => o.nps != null)
  const media = arr => (arr.length ? arr.reduce((a, o) => a + Number(o.nps), 0) / arr.length : null)
  const valor = media(doMes)
  const acumulado = media(todas)
  return {
    id: 'nps',
    label: 'NPS do cliente',
    valor,
    valorFmt: num(valor),
    metaFmt: '≥ 8,5',
    status: farol(valor, 8.5),
    resumo: doMes.length > 0
      ? `${doMes.length} pesquisa(s) no mês · acumulado geral: ${num(acumulado)}`
      : (todas.length > 0 ? `Sem pesquisa no mês · acumulado geral: ${num(acumulado)} (${todas.length})` : 'Nenhum NPS registrado ainda'),
    detalhes: doMes.map(o => ({ texto: `${o.codigo} — ${o.cliente}: nota ${num(Number(o.nps))}`, obraId: o.id })),
  }
}

// ===== KPI 5: lead time médio medição → entrega (baseline, sem meta) =====
// Data de medição = última marcação do checklist da etapa 'medicao';
// fallback = primeiro contato registrado com momento 'medicao'.
export function kpiLeadTime(obras, contatos, periodo) {
  const medicaoContato = {}
  contatos.forEach(c => {
    if (c.momento !== 'medicao' || !c.data) return
    if (!medicaoContato[c.obra_id] || c.data < medicaoContato[c.obra_id]) medicaoContato[c.obra_id] = c.data
  })
  const dataMedicao = o => {
    const marcas = datasChecklist(o, 'medicao')
    return (marcas.length ? marcas[marcas.length - 1] : null) || medicaoContato[o.id] || null
  }
  const concluidas = obras.filter(o => dentro(o.data_conclusao, periodo))
  const comMedicao = concluidas.filter(o => dataMedicao(o))
  const dias = comMedicao.map(o =>
    Math.round((new Date(o.data_conclusao) - new Date(dataMedicao(o))) / 86400000)
  )
  const valor = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null
  return {
    id: 'lead_time',
    label: 'Lead time (medição → entrega)',
    valor,
    valorFmt: valor == null ? '—' : `${Math.round(valor)} dias`,
    metaFmt: 'definir baseline',
    status: valor == null ? 'cinza' : 'neutro',
    resumo: comMedicao.length > 0
      ? `${comMedicao.length} obra(s) no cálculo`
      : (concluidas.length > 0 ? 'Obras concluídas sem medição rastreável (checklist/contato)' : 'Nenhuma entrega no mês'),
    detalhes: comMedicao.map((o, i) => ({ texto: `${o.codigo} — ${o.cliente}: ${dias[i]} dias`, obraId: o.id })),
  }
}

// ===== KPI 6: aderência ao cronograma de feedback (meta 100%) =====
// Para cada obra ativa no mês, contatos previstos = max(1, floor(diasAtivos/14)).
export function kpiAderenciaFeedback(obras, contatos, periodo) {
  const contPorObra = {}
  contatos.forEach(c => {
    if (!dentro(c.data, periodo)) return
    contPorObra[c.obra_id] = (contPorObra[c.obra_id] || 0) + 1
  })

  const ativasNoMes = obras.filter(o => {
    if (o.status === 'cancelada') return false
    const criada = dataDe(o.created_at)
    if (criada > periodo.fim) return false
    if (o.status === 'concluida' && o.data_conclusao && o.data_conclusao < periodo.inicio) return false
    return true
  })

  let totalPrev = 0
  let totalReal = 0
  const detalhes = []
  ativasNoMes.forEach(o => {
    const de = dataDe(o.created_at) > periodo.inicio ? dataDe(o.created_at) : periodo.inicio
    const ate = o.data_conclusao && o.data_conclusao < periodo.fim ? o.data_conclusao : periodo.fim
    const diasAtivos = Math.max(0, Math.round((new Date(ate) - new Date(de)) / 86400000)) + 1
    const previstos = Math.max(1, Math.floor(diasAtivos / INTERVALO_CONTATO_DIAS))
    const realizados = Math.min(previstos, contPorObra[o.id] || 0)
    totalPrev += previstos
    totalReal += realizados
    if (realizados < previstos) {
      detalhes.push({ texto: `${o.codigo} — ${o.cliente}: ${realizados} de ${previstos} contato(s) no mês`, obraId: o.id })
    }
  })
  const valor = totalPrev > 0 ? (totalReal / totalPrev) * 100 : null
  return {
    id: 'aderencia_feedback',
    label: 'Aderência ao feedback do cliente',
    valor,
    valorFmt: pct(valor),
    metaFmt: '100%',
    status: farol(valor, 100),
    resumo: totalPrev > 0 ? `${totalReal} de ${totalPrev} contato(s) previsto(s)` : 'Nenhuma obra ativa no mês',
    detalhes,
  }
}

// ===== KPI 7: aproveitamento de material (aguardando integração TMPro) =====
export function kpiMaterial() {
  return {
    id: 'material',
    label: 'Aproveitamento de material',
    valor: null,
    valorFmt: '—',
    metaFmt: '≥ 90%',
    status: 'cinza',
    resumo: 'Aguardando integração com o TMPro (dados de compras)',
    detalhes: [],
    aguardandoIntegracao: true,
  }
}

// Calcula os 7 KPIs de uma vez para um período.
export function calcularKpis({ obras, retrabalhos, pecaHistorico, pendencias, contatos }, periodo) {
  return [
    kpiEntregasNoPrazo(obras, periodo),
    kpiRetrabalho(retrabalhos, pecaHistorico, periodo),
    kpiPendenciasPosMontagem(obras, pendencias, periodo),
    kpiNps(obras, periodo),
    kpiLeadTime(obras, contatos, periodo),
    kpiAderenciaFeedback(obras, contatos, periodo),
    kpiMaterial(),
  ]
}
