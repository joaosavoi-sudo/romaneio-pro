import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { supabase, checarErros } from '../lib/supabase'
import { calcularKpis, mesPeriodo, mesAnterior, fmtMes } from '../lib/kpi'
import { Card, CardBody, Badge, ErroCarga } from '../components/ui'

const COR_STATUS = {
  verde: '#10b981',
  amarelo: '#f59e0b',
  vermelho: '#ef4444',
  cinza: '#9ca3af',
  neutro: '#3b82f6',
}

export default function Kpis() {
  const navigate = useNavigate()
  const hoje = new Date()
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [kpiAberto, setKpiAberto] = useState(null)

  const periodo = mesPeriodo(ref.ano, ref.mes)
  const anterior = mesAnterior(ref.ano, ref.mes)
  const periodoAnterior = mesPeriodo(anterior.ano, anterior.mes)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [ref.ano, ref.mes])

  async function loadData() {
    setErro(null)
    setLoading(true)
    try {
      // histórico e retrabalhos só do intervalo analisado (mês atual + anterior)
      const de = periodoAnterior.inicio
      const ate = `${periodo.fim}T23:59:59`
      const [obrasRes, retrabRes, pendRes, contatosRes, histRes] = await Promise.all([
        supabase.from('obras').select('id, codigo, cliente, status, created_at, data_conclusao, data_entrega_prometida, data_inicio, prazo_dias, nps, nps_data, checklist'),
        supabase.from('retrabalhos').select('*').gte('data', de).lte('data', periodo.fim),
        supabase.from('pendencias').select('id, obra_id, created_at, status, titulo'),
        supabase.from('obra_contatos').select('obra_id, data, momento'),
        supabase.from('peca_historico').select('peca_id, created_at').gte('created_at', de).lte('created_at', ate),
      ])
      checarErros(obrasRes, retrabRes, pendRes, contatosRes, histRes)
      setDados({
        obras: obrasRes.data || [],
        retrabalhos: retrabRes.data || [],
        pendencias: pendRes.data || [],
        contatos: contatosRes.data || [],
        pecaHistorico: histRes.data || [],
      })
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  const kpis = useMemo(() => (dados ? calcularKpis(dados, periodo) : []), [dados, periodo.inicio, periodo.fim]) // eslint-disable-line react-hooks/exhaustive-deps
  const kpisAnteriores = useMemo(() => (dados ? calcularKpis(dados, periodoAnterior) : []), [dados, periodoAnterior.inicio, periodoAnterior.fim]) // eslint-disable-line react-hooks/exhaustive-deps

  const ehMesAtual = ref.ano === hoje.getFullYear() && ref.mes === hoje.getMonth() + 1

  function mudarMes(delta) {
    setKpiAberto(null)
    setRef(r => {
      let { ano, mes } = r
      mes += delta
      if (mes < 1) { mes = 12; ano-- }
      if (mes > 12) { mes = 1; ano++ }
      return { ano, mes }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={24} className="text-primary-600" /> KPIs do Modelo Ouro
          </h2>
          <p className="text-sm text-gray-500">Indicadores de desempenho — revisão mensal (Seção 9)</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
          <button onClick={() => mudarMes(-1)} className="p-1 rounded hover:bg-gray-100 cursor-pointer" aria-label="Mês anterior">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-900 w-36 text-center capitalize">{fmtMes(ref.ano, ref.mes)}</span>
          <button
            onClick={() => mudarMes(1)}
            disabled={ehMesAtual}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default cursor-pointer"
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {erro ? (
        <ErroCarga mensagem={erro} onRetry={loadData} />
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                anterior={kpisAnteriores[i]}
                aberto={kpiAberto === kpi.id}
                onClick={() => setKpiAberto(kpiAberto === kpi.id ? null : kpi.id)}
              />
            ))}
          </div>

          {kpiAberto && (() => {
            const kpi = kpis.find(k => k.id === kpiAberto)
            if (!kpi) return null
            return (
              <Card>
                <CardBody>
                  <p className="font-medium text-gray-900 mb-2">{kpi.label} — detalhes de {fmtMes(ref.ano, ref.mes)}</p>
                  {kpi.detalhes.length === 0 ? (
                    <p className="text-sm text-gray-500">Nada a detalhar neste período.</p>
                  ) : (
                    <ul className="space-y-1">
                      {kpi.detalhes.map((d, i) => (
                        <li key={i}>
                          {d.obraId ? (
                            <button
                              onClick={() => navigate(`/obras/${d.obraId}`)}
                              className="text-sm text-primary-700 hover:underline text-left cursor-pointer"
                            >
                              {d.texto}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-600">{d.texto}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )
          })()}

          <p className="text-xs text-gray-400">
            Metas do Modelo Padrão Ouro. Taxa de retrabalho usa como base as peças movimentadas na fábrica no mês.
            Clique em um cartão para ver os detalhes.
          </p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ kpi, anterior, aberto, onClick }) {
  const cor = COR_STATUS[kpi.status] || COR_STATUS.cinza
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardBody>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
          <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: cor }} />
        </div>
        <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.valorFmt}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500">Meta: {kpi.metaFmt}</p>
          {anterior?.valorFmt && anterior.valorFmt !== '—' && (
            <p className="text-xs text-gray-400">anterior: {anterior.valorFmt}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400 truncate">{kpi.resumo}</p>
          {aberto ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
        </div>
        {kpi.aguardandoIntegracao && (
          <Badge color="#9ca3af" className="mt-2">Aguardando integração TMPro</Badge>
        )}
      </CardBody>
    </Card>
  )
}
