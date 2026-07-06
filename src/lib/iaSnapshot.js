// Retrato compacto das obras ativas para o Assistente IA de gestão (/insights).
// Função pura: recebe os dados já buscados e devolve o JSON enviado à IA.
// Prioriza densidade de informação por token: chaves curtas, verdes agregados,
// listas com corte, textos truncados.
import { calcularEtapaItem, calcularSemaforo, diasAte } from './itemStatus'
import { posicaoHoje, temCronograma, dataEntregaDerivada } from './cronograma'
import { etapaAtual, progressoEtapa } from './processo'
import { diasDesde } from './comunicacao'
import { amostraEmAberto, amostraAtrasada } from './amostras'
import { assistenciaAtrasada } from './assistencias'
import { calcularKpis, mesPeriodo } from './kpi'

const MATERIAIS_ESPECIAIS = ['Vidro', 'Espelho', 'Acrílico']
const LIMITE_PENDENCIAS = 10
const LIMITE_AMOSTRAS = 8
const LIMITE_AJUSTES = 3

const truncar = (t, n = 120) => {
  const s = (t || '').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
const dataDe = ts => (ts ? String(ts).slice(0, 10) : null)
const hojeIso = () => new Date().toISOString().slice(0, 10)
const addDiasIso = n => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function montarSnapshot({
  obras, moveis, pecas, pendencias, amostras,
  assistencias, retrabalhos, contatos, prazoAjustes, pecaHistorico,
}) {
  const ativas = obras.filter(o => o.status === 'ativa')

  // Índices por obra/móvel
  const moveisPorObra = agrupa(moveis, m => m.obra_id)
  const pecasPorMovel = agrupa(pecas, p => p.movel_id)
  const pendPorObra = agrupa(pendencias, p => p.obra_id)
  const pendPorMovel = agrupa(pendencias.filter(p => p.movel_id), p => p.movel_id)
  const amostrasPorObra = agrupa(amostras, a => a.obra_id)
  const assistPorObra = agrupa(assistencias, a => a.obra_id)
  const ajustesPorObra = agrupa(prazoAjustes, a => a.obra_id)
  const retrabPorObra = agrupa(retrabalhos, r => r.obra_id)
  const ultimoContato = {}
  contatos.forEach(c => {
    if (!ultimoContato[c.obra_id] || c.data > ultimoContato[c.obra_id]) ultimoContato[c.obra_id] = c.data
  })

  const corte90d = addDiasIso(-90)
  const corte30d = addDiasIso(-30)

  const obrasSnap = ativas.map(o => {
    const movs = moveisPorObra[o.id] || []
    const pecasObra = movs.flatMap(m => pecasPorMovel[m.id] || [])

    // Onde a produção REALMENTE está (contagem de peças por etapa da fábrica)
    const pecasPorEtapa = {}
    pecasObra.forEach(p => { pecasPorEtapa[p.etapa] = (pecasPorEtapa[p.etapa] || 0) + 1 })

    // Materiais especiais (vidro/espelho/acrílico): total + em que etapa estão
    const materiaisEspeciais = {}
    pecasObra.forEach(p => {
      if (!MATERIAIS_ESPECIAIS.includes(p.material)) return
      if (!materiaisEspeciais[p.material]) materiaisEspeciais[p.material] = { total: 0, por_etapa: {} }
      materiaisEspeciais[p.material].total++
      materiaisEspeciais[p.material].por_etapa[p.etapa] = (materiaisEspeciais[p.material].por_etapa[p.etapa] || 0) + 1
    })

    // Itens: só amarelo/vermelho/bloqueado entram individualmente; verdes viram contagem
    const itensAtencao = []
    let itensOk = 0
    movs.forEach(m => {
      const sem = calcularSemaforo(m, pendPorMovel[m.id] || [])
      if (sem === 'verde') { itensOk++; return }
      const etapa = calcularEtapaItem(m, pecasPorMovel[m.id] || [])
      itensAtencao.push({
        cod: m.codigo,
        nome: truncar(m.nome || m.descricao, 60),
        etapa: etapa.label,
        semaforo: sem,
        bloqueio: m.motivo_bloqueio?.trim() ? truncar(m.motivo_bloqueio) : null,
        dias_para_previsao: diasAte(m.previsao_entrega),
      })
    })

    const pendAbertas = (pendPorObra[o.id] || [])
      .filter(p => p.status === 'aberta')
      .sort((a, b) => (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1)
      .slice(0, LIMITE_PENDENCIAS)
      .map(p => ({ titulo: truncar(p.titulo), tipo: p.tipo, dias_para_prazo: diasAte(p.prazo) }))

    const amostrasAbertas = (amostrasPorObra[o.id] || [])
      .filter(a => amostraEmAberto(a))
      .slice(0, LIMITE_AMOSTRAS)
      .map(a => ({
        titulo: truncar(a.titulo), tipo: a.tipo, status: a.status,
        dias_para_prazo: diasAte(a.prazo), atrasada: amostraAtrasada(a),
      }))

    const assistAtrasadas = (assistPorObra[o.id] || [])
      .filter(a => assistenciaAtrasada(a))
      .map(a => ({ titulo: truncar(a.titulo), status: a.status }))

    const ajustes = (ajustesPorObra[o.id] || [])
      .filter(a => dataDe(a.created_at) >= corte90d)
      .slice(0, LIMITE_AJUSTES)
      .map(a => ({ dias: a.dias_delta, motivo: truncar(a.justificativa) }))

    // Retrabalhos 30d agregados por motivo
    const retrabMotivos = {}
    ;(retrabPorObra[o.id] || []).forEach(r => {
      if (r.data < corte30d) return
      const motivo = truncar(r.motivo) || 'sem motivo informado'
      retrabMotivos[motivo] = (retrabMotivos[motivo] || 0) + (r.quantidade || 1)
    })

    const etapa = etapaAtual(o)
    const { marcados, total } = progressoEtapa(o, etapa)
    const prazoEfetivo = o.data_entrega_prometida || dataEntregaDerivada(o.data_inicio, o.prazo_dias)
    const pos = temCronograma(o) ? posicaoHoje(o) : null

    return {
      codigo: o.codigo,
      cliente: o.cliente,
      etapa_processo: etapa,
      gate: total > 0 ? `${marcados}/${total}` : null,
      dias_para_entrega: diasAte(prazoEfetivo),
      cronograma: pos ? { decorrido_pct: Math.round(pos.pct), fase_prevista: pos.faseChave } : null,
      pecas_por_etapa: pecasPorEtapa,
      ajustes_prazo_90d: ajustes,
      dias_sem_contato_cliente: ultimoContato[o.id] ? diasDesde(ultimoContato[o.id]) : null,
      itens_atencao: itensAtencao,
      itens_ok: itensOk,
      materiais_especiais: materiaisEspeciais,
      pendencias_abertas: pendAbertas,
      amostras_abertas: amostrasAbertas,
      assistencias_atrasadas: assistAtrasadas,
      retrabalhos_30d: Object.entries(retrabMotivos).map(([motivo, qtd]) => ({ qtd, motivo })),
    }
  })

  // KPIs do mês corrente (usa TODAS as obras — inclui concluídas)
  const agora = new Date()
  const periodo = mesPeriodo(agora.getFullYear(), agora.getMonth() + 1)
  const kpisMes = calcularKpis({ obras, retrabalhos, pecaHistorico, pendencias, contatos }, periodo)
    .filter(k => k.id !== 'material')
    .map(k => ({ nome: k.label, valor: k.valorFmt, meta: k.metaFmt, status: k.status, resumo: k.resumo }))

  const snapshot = { hoje: hojeIso(), obras: obrasSnap, kpis_mes: kpisMes }

  // Válvula de tamanho: se estourar, mantém só itens vermelhos/bloqueados
  if (JSON.stringify(snapshot).length > 150000) {
    snapshot.obras.forEach(o => {
      o.itens_atencao = o.itens_atencao.filter(i => i.semaforo === 'vermelho' || i.bloqueio)
    })
  }

  return snapshot
}

function agrupa(lista, chaveFn) {
  const idx = {}
  ;(lista || []).forEach(item => {
    const k = chaveFn(item)
    if (!k) return
    if (!idx[k]) idx[k] = []
    idx[k].push(item)
  })
  return idx
}
