import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Package, ScanLine, AlertTriangle, CalendarClock, Ban, MessageCircle, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS, SEMAFORO } from '../lib/constants'
import { OBRA_ETAPAS, etapaAtual } from '../lib/processo'
import { INTERVALO_CONTATO_DIAS, diasDesde } from '../lib/comunicacao'
import { assistenciaAtrasada } from '../lib/assistencias'
import { calcularEtapaItem, calcularSemaforo, diasAte } from '../lib/itemStatus'
import { Card, CardBody } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

function StatCard({ icon: Icon, label, value, color, onClick }) {
  const clickable = typeof onClick === 'function'
  return (
    <Card
      className={clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      onClick={onClick}
    >
      <CardBody className="flex items-center gap-4">
        <div className="p-3 rounded-xl" style={{ backgroundColor: color + '15' }}>
          <Icon size={24} style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ obras: 0, pecas: 0, romaneios: 0 })
  const [etapaCounts, setEtapaCounts] = useState({})
  const [historico, setHistorico] = useState([])
  const [moveis, setMoveis] = useState([])
  const [pecasPorMovel, setPecasPorMovel] = useState({})
  const [pendenciasPorMovel, setPendenciasPorMovel] = useState({})
  const [obrasPorEtapa, setObrasPorEtapa] = useState({})
  const [obrasAComunicar, setObrasAComunicar] = useState(0)
  const [assist, setAssist] = useState({ atrasadas: 0, cobrar: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const [obrasRes, pecasRes, romaneiosRes, historicoRes, moveisRes, pendRes, contatosRes, assistRes] = await Promise.all([
      supabase.from('obras').select('id, etapa_atual, created_at').eq('status', 'ativa'),
      supabase.from('pecas').select('id, etapa, movel_id'),
      supabase.from('romaneios').select('id', { count: 'exact', head: true }),
      supabase.from('peca_historico').select('*, pecas(codigo, nome)').order('created_at', { ascending: false }).limit(10),
      supabase.from('moveis').select('*, obras(id, codigo, cliente, status)').order('codigo', { ascending: true }),
      supabase.from('pendencias').select('id, status, prazo, movel_id').not('movel_id', 'is', null),
      supabase.from('obra_contatos').select('obra_id, data'),
      supabase.from('assistencias').select('status, em_garantia, prazo_agendar, data_agendada, prazo_concluir'),
    ])

    setStats({
      obras: obrasRes.data?.length || 0,
      pecas: pecasRes.data?.length || 0,
      romaneios: romaneiosRes.count || 0,
    })

    const etCounts = {}
    OBRA_ETAPAS.forEach(e => { etCounts[e.id] = 0 })
    ;(obrasRes.data || []).forEach(o => {
      const k = etapaAtual(o)
      if (etCounts[k] != null) etCounts[k]++
    })
    setObrasPorEtapa(etCounts)

    // Obras ativas sem contato com o cliente nos últimos N dias (base do KPI de aderência)
    const ultimoContato = {}
    ;(contatosRes.data || []).forEach(c => {
      if (!ultimoContato[c.obra_id] || c.data > ultimoContato[c.obra_id]) ultimoContato[c.obra_id] = c.data
    })
    const aComunicar = (obrasRes.data || []).filter(o => {
      const base = ultimoContato[o.id] || o.created_at
      const d = diasDesde(base)
      return d != null && d >= INTERVALO_CONTATO_DIAS
    }).length
    setObrasAComunicar(aComunicar)

    // Assistências: atrasadas e a cobrar (pendentes de pós-venda)
    const assistData = assistRes.data || []
    setAssist({
      atrasadas: assistData.filter(a => assistenciaAtrasada(a)).length,
      cobrar: assistData.filter(a => a.em_garantia === false && a.status !== 'cancelada').length,
    })

    const counts = {}
    ETAPAS.forEach(e => { counts[e.id] = 0 })
    const idxPecas = {}
    pecasRes.data?.forEach(p => {
      if (counts[p.etapa] !== undefined) counts[p.etapa]++
      if (p.movel_id) {
        if (!idxPecas[p.movel_id]) idxPecas[p.movel_id] = []
        idxPecas[p.movel_id].push(p)
      }
    })
    setEtapaCounts(counts)

    const idxPend = {}
    ;(pendRes.data || []).forEach(p => {
      if (!idxPend[p.movel_id]) idxPend[p.movel_id] = []
      idxPend[p.movel_id].push(p)
    })

    setMoveis(moveisRes.data || [])
    setPecasPorMovel(idxPecas)
    setPendenciasPorMovel(idxPend)
    setHistorico(historicoRes.data || [])
  }

  // Itens ativos (de obras ativas) com semáforo, etapa e prazo calculados
  const itensInfo = useMemo(() => {
    return moveis
      .filter(m => m.obras?.status === 'ativa')
      .map(m => {
        const cor = calcularSemaforo(m, pendenciasPorMovel[m.id] || [])
        const etapa = calcularEtapaItem(m, pecasPorMovel[m.id] || [])
        const entregue = m.status_pos_expedicao === 'entregue'
        const dias = entregue ? null : diasAte(m.previsao_entrega)
        return { m, cor, etapa, entregue, dias }
      })
  }, [moveis, pendenciasPorMovel, pecasPorMovel])

  const semaforo = useMemo(() => {
    const c = { verde: 0, amarelo: 0, vermelho: 0 }
    itensInfo.forEach(i => { c[i.cor]++ })
    return c
  }, [itensInfo])

  const atrasados = useMemo(
    () => itensInfo.filter(i => i.dias !== null && i.dias < 0),
    [itensInfo]
  )
  const bloqueados = useMemo(
    () => itensInfo.filter(i => i.m.motivo_bloqueio && i.m.motivo_bloqueio.trim()),
    [itensInfo]
  )

  // Lista "pedem atenção": vermelhos e amarelos, vermelho primeiro, depois por prazo
  const atencao = useMemo(() => {
    const ordemCor = { vermelho: 0, amarelo: 1, verde: 2 }
    return itensInfo
      .filter(i => i.cor !== 'verde')
      .sort((a, b) => {
        if (ordemCor[a.cor] !== ordemCor[b.cor]) return ordemCor[a.cor] - ordemCor[b.cor]
        const da = a.dias ?? Infinity
        const db = b.dias ?? Infinity
        return da - db
      })
  }, [itensInfo])

  // Entregas dos próximos 7 dias (não entregues)
  const entregasSemana = useMemo(() => {
    return itensInfo
      .filter(i => i.dias !== null && i.dias >= 0 && i.dias <= 7)
      .sort((a, b) => a.dias - b.dias)
  }, [itensInfo])

  const totalItens = itensInfo.length
  const totalPecas = Object.values(etapaCounts).reduce((a, b) => a + b, 0)

  function irParaItens(cor) {
    navigate(cor ? `/itens?semaforo=${cor}` : '/itens')
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Visão geral das obras ativas</p>
      </div>

      {/* Alerta: obras a comunicar com o cliente */}
      {obrasAComunicar > 0 && (
        <button
          onClick={() => navigate('/obras')}
          className="w-full mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left cursor-pointer hover:bg-amber-100/60"
        >
          <MessageCircle size={20} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            <strong>{obrasAComunicar}</strong> obra(s) ativa(s) sem contato com o cliente há {INTERVALO_CONTATO_DIAS}+ dias — atualize-os antes que perguntem.
          </span>
        </button>
      )}

      {/* Alerta: assistências atrasadas / a cobrar */}
      {(assist.atrasadas > 0 || assist.cobrar > 0) && (
        <button
          onClick={() => navigate('/assistencias')}
          className="w-full mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left cursor-pointer hover:bg-red-100/60"
        >
          <Wrench size={20} className="text-red-600 shrink-0" />
          <span className="text-sm text-red-800">
            {assist.atrasadas > 0 && <><strong>{assist.atrasadas}</strong> assistência(s) atrasada(s)</>}
            {assist.atrasadas > 0 && assist.cobrar > 0 && ' · '}
            {assist.cobrar > 0 && <><strong>{assist.cobrar}</strong> a cobrar (fora de garantia)</>}
          </span>
        </button>
      )}

      {/* KPIs de gestão (item-level) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Building2} label="Obras ativas" value={stats.obras} color="#059669" onClick={() => navigate('/obras')} />
        <StatCard icon={AlertTriangle} label="Itens atrasados" value={atrasados.length} color="#ef4444" onClick={() => irParaItens('vermelho')} />
        <StatCard icon={CalendarClock} label="Entregas em ≤ 7 dias" value={entregasSemana.length} color="#f59e0b" onClick={() => irParaItens()} />
        <StatCard icon={Ban} label="Itens bloqueados" value={bloqueados.length} color="#dc2626" onClick={() => irParaItens('vermelho')} />
      </div>

      {/* Semáforo geral dos itens */}
      <Card className="mb-8">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Semáforo dos Itens</h3>
            <span className="text-sm text-gray-500">{totalItens} item(ns) ativos</span>
          </div>
          {totalItens === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum item em obras ativas.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <SemaforoBtn cor={SEMAFORO.verde.cor} label="No prazo" count={semaforo.verde} onClick={() => irParaItens('verde')} />
                <SemaforoBtn cor={SEMAFORO.amarelo.cor} label="Atenção" count={semaforo.amarelo} onClick={() => irParaItens('amarelo')} />
                <SemaforoBtn cor={SEMAFORO.vermelho.cor} label="Crítico" count={semaforo.vermelho} onClick={() => irParaItens('vermelho')} />
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                {['verde', 'amarelo', 'vermelho'].map(c => {
                  const pct = totalItens > 0 ? (semaforo[c] / totalItens) * 100 : 0
                  return pct > 0 ? (
                    <div key={c} style={{ width: `${pct}%`, backgroundColor: SEMAFORO[c].cor }} />
                  ) : null
                })}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Pipeline de obras por etapa do processo */}
      <Card className="mb-8">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Obras por Etapa do Processo</h3>
            <button onClick={() => navigate('/obras')} className="text-xs text-primary-600 hover:underline cursor-pointer">Ver obras</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {OBRA_ETAPAS.map(e => (
              <div key={e.id} className="flex-1 min-w-[92px] rounded-lg border border-gray-100 p-2 text-center" style={{ backgroundColor: e.cor + '0d' }}>
                <div className="text-2xl font-bold" style={{ color: e.cor }}>{obrasPorEtapa[e.id] || 0}</div>
                <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{e.label}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Itens que pedem atenção + Entregas da semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Itens que Pedem Atenção</h3>
            {atencao.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Tudo no verde. 🎉</p>
            ) : (
              <div className="space-y-2">
                {atencao.slice(0, 8).map(({ m, cor, etapa, dias }) => (
                  <ItemRow
                    key={m.id}
                    m={m}
                    cor={cor}
                    etapa={etapa}
                    dias={dias}
                    onClick={() => navigate(`/obras/${m.obras?.id}?item=${m.id}`)}
                  />
                ))}
                {atencao.length > 8 && (
                  <button onClick={() => irParaItens()} className="text-sm text-primary-600 hover:underline cursor-pointer pt-1">
                    Ver todos os {atencao.length} itens →
                  </button>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Entregas dos Próximos 7 Dias</h3>
            {entregasSemana.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Nenhuma entrega prevista para a semana.</p>
            ) : (
              <div className="space-y-2">
                {entregasSemana.slice(0, 8).map(({ m, cor, etapa, dias }) => (
                  <ItemRow
                    key={m.id}
                    m={m}
                    cor={cor}
                    etapa={etapa}
                    dias={dias}
                    onClick={() => navigate(`/obras/${m.obras?.id}?item=${m.id}`)}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* KPIs de chão de fábrica (peças) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Package} label="Total de peças" value={stats.pecas} color="#3b82f6" onClick={() => navigate('/pecas')} />
        <StatCard icon={ScanLine} label="Romaneios" value={stats.romaneios} color="#8b5cf6" onClick={() => navigate('/romaneios')} />
        <StatCard icon={Package} label="Peças expedidas" value={etapaCounts.expedicao || 0} color="#ef4444" />
      </div>

      {/* Peças por etapa */}
      <Card className="mb-8">
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Peças por Etapa</h3>
          <div className="space-y-3">
            {ETAPAS.map(etapa => {
              const count = etapaCounts[etapa.id] || 0
              const pct = totalPecas > 0 ? (count / totalPecas) * 100 : 0
              return (
                <div key={etapa.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 shrink-0">{etapa.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 0)}%`, backgroundColor: etapa.cor }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-10 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Últimas movimentações */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimas Movimentações</h3>
          {historico.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nenhuma movimentação registrada</p>
          ) : (
            <div className="space-y-2">
              {historico.map(h => {
                const etapaInfo = ETAPAS.find(e => e.id === h.etapa_nova)
                return (
                  <div key={h.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: etapaInfo?.cor || '#6b7280' }}
                    />
                    <div className="flex-1 text-sm">
                      <span className="font-medium text-gray-900">{h.pecas?.codigo}</span>
                      <span className="text-gray-500"> — {h.pecas?.nome}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      → {etapaInfo?.label || h.etapa_nova}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function SemaforoBtn({ cor, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer"
    >
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-lg font-bold ml-auto" style={{ color: cor }}>{count}</span>
    </button>
  )
}

function ItemRow({ m, cor, etapa, dias, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-md px-1"
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SEMAFORO[cor].cor }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {m.codigo} — {m.descricao || m.nome}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {m.obras?.codigo} · {m.obras?.cliente}{m.responsavel ? ` · ${m.responsavel}` : ''}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge label={etapa.label} cor={etapa.cor} />
        {dias !== null && (
          <div className={`text-xs mt-0.5 ${dias < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {dias < 0 ? `${Math.abs(dias)}d atrasado` : dias === 0 ? 'hoje' : `em ${dias}d`}
          </div>
        )}
      </div>
    </div>
  )
}
