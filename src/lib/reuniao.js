// Reunião Semanal de Alinhamento (Modelo Ouro — Seção 7.1): pauta fixa de 5
// itens, preenchida automaticamente com os dados reais da semana.
import { etapaAtual, progressoEtapa } from './processo'
import { diasAte } from './itemStatus'

export const PAUTA_ITENS = [
  { id: 'entrada_producao', titulo: 'Obras que entrarão em produção na semana' },
  { id: 'entregas_semana', titulo: 'Obras com previsão de entrega/montagem na semana' },
  { id: 'pendencias_criticas', titulo: 'Obras com pendências críticas (bloqueios de produção)' },
  { id: 'alteracoes_escopo', titulo: 'Alterações de escopo que impactam produção' },
  { id: 'capacidade', titulo: 'Capacidade disponível vs. demanda projetada' },
]

const iso = d => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Semana (segunda → domingo) da data de referência. Strings ISO yyyy-mm-dd.
export function semanaDe(dataRef = new Date()) {
  const d = new Date(dataRef)
  d.setHours(0, 0, 0, 0)
  const diaSemana = (d.getDay() + 6) % 7 // 0 = segunda
  const inicio = new Date(d)
  inicio.setDate(d.getDate() - diaSemana)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  return { inicio: iso(inicio), fim: iso(fim) }
}

export function fmtSemana(semana) {
  const f = s => s.split('-').reverse().slice(0, 2).join('/')
  return `${f(semana.inicio)} a ${f(semana.fim)}`
}

const fmtDia = s => (s ? s.split('-').reverse().slice(0, 2).join('/') : '')
const dentro = (data, s) => !!data && data >= s.inicio && data <= s.fim
const addDiasIso = (s, n) => {
  const d = new Date(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

// Monta as linhas de cada item da pauta. Devolve
// [{ id, titulo, linhas: [{ texto, obraId?, cor? }] }]
export function montarPauta({ obras, moveis, pecas, pendencias, prazoAjustes }, semana) {
  const ativas = obras.filter(o => o.status === 'ativa')
  const obraDe = Object.fromEntries(obras.map(o => [o.id, o]))
  const rotulo = o => (o ? `${o.codigo} — ${o.cliente}` : 'Obra desconhecida')

  const pecasPorMovel = {}
  pecas.forEach(p => {
    if (!p.movel_id) return
    if (!pecasPorMovel[p.movel_id]) pecasPorMovel[p.movel_id] = []
    pecasPorMovel[p.movel_id].push(p)
  })

  const moveisAtivos = moveis.filter(m => obraDe[m.obra_id]?.status === 'ativa')
  const agrupar = lista => {
    const porObra = {}
    lista.forEach(m => {
      if (!porObra[m.obra_id]) porObra[m.obra_id] = []
      porObra[m.obra_id].push(m)
    })
    return porObra
  }

  // 1. Entrada em produção: obras cuja primeira peça nasceu na semana
  //    (romaneio criado = produção começando) + obras em medição com o
  //    gate quase completo (candidatas a entrar)
  const linhas1 = []
  const movelObra = Object.fromEntries(moveis.map(m => [m.id, m.obra_id]))
  const primeiraPecaPorObra = {}
  pecas.forEach(p => {
    const obraId = movelObra[p.movel_id]
    if (!obraId) return
    const d = String(p.created_at || '').slice(0, 10)
    if (!primeiraPecaPorObra[obraId] || d < primeiraPecaPorObra[obraId]) primeiraPecaPorObra[obraId] = d
  })
  ativas.forEach(o => {
    const inicio = primeiraPecaPorObra[o.id]
    if (inicio && dentro(inicio, semana)) {
      linhas1.push({ texto: `${rotulo(o)}: produção iniciada na semana (primeiras peças em ${fmtDia(inicio)})`, obraId: o.id })
    }
  })
  ativas.forEach(o => {
    if (etapaAtual(o) !== 'medicao') return
    const { marcados, total } = progressoEtapa(o, 'medicao')
    if (total > 0 && marcados / total >= 0.8) {
      linhas1.push({ texto: `${rotulo(o)}: candidata — gate de medição ${marcados}/${total}`, obraId: o.id, cor: '#3b82f6' })
    }
  })

  // 2. Entregas/montagens da semana
  const linhas2 = []
  Object.entries(agrupar(moveisAtivos.filter(m => dentro(m.previsao_entrega, semana) && m.status_pos_expedicao !== 'entregue'))).forEach(([obraId, ms]) => {
    linhas2.push({
      texto: `${rotulo(obraDe[obraId])}: ${ms.length} item(ns) com entrega prevista (${ms.map(m => `${m.codigo} ${fmtDia(m.previsao_entrega)}`).join(', ')})`,
      obraId,
    })
  })
  Object.entries(agrupar(moveisAtivos.filter(m => m.status_pos_expedicao === 'em_montagem'))).forEach(([obraId, ms]) => {
    linhas2.push({ texto: `${rotulo(obraDe[obraId])}: ${ms.length} item(ns) em montagem no momento`, obraId })
  })
  ativas.filter(o => dentro(o.data_entrega_prometida, semana)).forEach(o => {
    linhas2.push({ texto: `${rotulo(o)}: entrega da obra prometida para ${fmtDia(o.data_entrega_prometida)}`, obraId: o.id, cor: '#f59e0b' })
  })

  // 3. Pendências críticas: itens bloqueados + pendências abertas vencidas
  const linhas3 = []
  moveisAtivos.filter(m => m.motivo_bloqueio && m.motivo_bloqueio.trim()).forEach(m => {
    linhas3.push({
      texto: `${rotulo(obraDe[m.obra_id])} · item ${m.codigo}: BLOQUEADO — ${m.motivo_bloqueio}`,
      obraId: m.obra_id,
      cor: '#ef4444',
    })
  })
  const vencidasPorObra = {}
  pendencias.filter(p => p.status === 'aberta' && p.prazo && diasAte(p.prazo) < 0).forEach(p => {
    if (!vencidasPorObra[p.obra_id]) vencidasPorObra[p.obra_id] = []
    vencidasPorObra[p.obra_id].push(p)
  })
  Object.entries(vencidasPorObra).forEach(([obraId, ps]) => {
    linhas3.push({
      texto: `${rotulo(obraDe[obraId])}: ${ps.length} pendência(s) vencida(s) — ${ps.map(p => p.titulo).join('; ')}`,
      obraId,
      cor: '#ef4444',
    })
  })

  // 4. Alterações de escopo (registradas no sistema nos 7 dias anteriores à semana
  //    + durante a semana): ajustes de prazo e pendências de cliente novas
  const desde = addDiasIso(semana.inicio, -7)
  const linhas4 = []
  prazoAjustes.filter(a => {
    const d = String(a.created_at || '').slice(0, 10)
    return d >= desde && d <= semana.fim
  }).forEach(a => {
    const delta = a.dias_delta > 0 ? `+${a.dias_delta} dia(s)` : `${a.dias_delta} dia(s)`
    linhas4.push({
      texto: `${rotulo(obraDe[a.obra_id])}: prazo ajustado ${delta} — ${a.justificativa || 'sem justificativa'}`,
      obraId: a.obra_id,
    })
  })
  pendencias.filter(p => {
    const d = String(p.created_at || '').slice(0, 10)
    return p.tipo === 'cliente' && d >= desde && d <= semana.fim
  }).forEach(p => {
    linhas4.push({ texto: `${rotulo(obraDe[p.obra_id])}: nova definição do cliente — ${p.titulo}`, obraId: p.obra_id })
  })

  // 5. Capacidade × demanda: carga de itens em produção por responsável
  //    vs. itens com entrega nos próximos 14 dias
  const linhas5 = []
  const emProducao = moveisAtivos.filter(m => {
    if (m.status_pos_expedicao) return false
    const ps = pecasPorMovel[m.id] || []
    return ps.length > 0 && !ps.every(p => p.etapa === 'expedicao')
  })
  const porResp = {}
  emProducao.forEach(m => {
    const r = m.responsavel || 'Sem responsável'
    porResp[r] = (porResp[r] || 0) + 1
  })
  Object.entries(porResp).sort((a, b) => b[1] - a[1]).forEach(([resp, n]) => {
    linhas5.push({ texto: `${resp}: ${n} item(ns) em produção` })
  })
  const ate14 = addDiasIso(semana.inicio, 14)
  const demanda = moveisAtivos.filter(m =>
    m.previsao_entrega && m.previsao_entrega >= semana.inicio && m.previsao_entrega <= ate14 &&
    m.status_pos_expedicao !== 'entregue'
  )
  linhas5.push({
    texto: `Demanda: ${demanda.length} item(ns) com entrega prevista até ${fmtDia(ate14)}`,
    cor: '#f59e0b',
  })

  const porId = {
    entrada_producao: linhas1,
    entregas_semana: linhas2,
    pendencias_criticas: linhas3,
    alteracoes_escopo: linhas4,
    capacidade: linhas5,
  }
  return PAUTA_ITENS.map(item => ({ ...item, linhas: porId[item.id] || [] }))
}
