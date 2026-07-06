import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase, checarErros } from '../lib/supabase'
import { montarSnapshot } from '../lib/iaSnapshot'
import { Btn, Card, CardBody, Badge, Select, ErroCarga } from '../components/ui'

const MODELO = 'claude-sonnet-4-6'

const PRIORIDADE_INFO = {
  alta: { label: 'Prioridade alta', cor: '#ef4444' },
  media: { label: 'Prioridade média', cor: '#f59e0b' },
  baixa: { label: 'Atenção preventiva', cor: '#9ca3af' },
}

const CATEGORIA_COR = {
  compras: '#3b82f6',
  producao: '#f59e0b',
  acabamento: '#8b5cf6',
  prazo: '#ef4444',
  cliente: '#06b6d4',
  qualidade: '#f97316',
  outro: '#6b7280',
}

const isoDiasAtras = n => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function Insights() {
  const navigate = useNavigate()
  const [analises, setAnalises] = useState([])
  const [analiseAtualId, setAnaliseAtualId] = useState(null)
  const [obrasMap, setObrasMap] = useState({}) // codigo → id
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [migrationPendente, setMigrationPendente] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState(null)
  const [debug, setDebug] = useState(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [])
  useEffect(() => { loadData() }, [])

  async function loadData() {
    setErro(null)
    setLoading(true)
    try {
      const [analisesRes, obrasRes] = await Promise.all([
        supabase.from('ia_analises').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('obras').select('id, codigo'),
      ])
      if (analisesRes.error && /does not exist/i.test(analisesRes.error.message || '')) {
        setMigrationPendente(true)
        setLoading(false)
        return
      }
      checarErros(analisesRes, obrasRes)
      const lista = analisesRes.data || []
      setAnalises(lista)
      setAnaliseAtualId(prev => prev && lista.some(a => a.id === prev) ? prev : (lista[0]?.id || null))
      setObrasMap(Object.fromEntries((obrasRes.data || []).map(o => [o.codigo, o.id])))
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function gerarAnalise() {
    setGerando(true)
    setErroGeracao(null)
    setDebug(null)
    try {
      const inicioMes = new Date()
      inicioMes.setDate(1)
      const inicioMesIso = inicioMes.toISOString().slice(0, 10)
      const deRetrab = inicioMesIso < isoDiasAtras(30) ? inicioMesIso : isoDiasAtras(30)

      const [obrasRes, moveisRes, pecasRes, pendRes, amostrasRes, assistRes,
        retrabRes, contatosRes, ajustesRes, histRes] = await Promise.all([
        supabase.from('obras').select('id, codigo, cliente, status, etapa_atual, checklist, data_inicio, prazo_dias, cronograma_fases, data_entrega_prometida, data_conclusao, nps, nps_data, created_at'),
        supabase.from('moveis').select('id, obra_id, codigo, nome, descricao, motivo_bloqueio, status_pos_expedicao, previsao_entrega'),
        supabase.from('pecas').select('id, etapa, material, movel_id').not('movel_id', 'is', null),
        supabase.from('pendencias').select('id, obra_id, movel_id, tipo, titulo, prazo, status, created_at'),
        supabase.from('amostras').select('id, obra_id, tipo, titulo, status, prazo'),
        supabase.from('assistencias').select('id, obra_id, titulo, status, prazo_agendar, data_agendada, prazo_concluir'),
        supabase.from('retrabalhos').select('obra_id, quantidade, motivo, data').gte('data', deRetrab),
        supabase.from('obra_contatos').select('obra_id, data, momento'),
        supabase.from('obra_prazo_ajustes').select('obra_id, dias_delta, justificativa, created_at').gte('created_at', isoDiasAtras(90)),
        supabase.from('peca_historico').select('peca_id, created_at').gte('created_at', inicioMesIso),
      ])
      checarErros(obrasRes, moveisRes, pecasRes, pendRes, amostrasRes, assistRes, retrabRes, contatosRes, ajustesRes, histRes)

      const snapshot = montarSnapshot({
        obras: obrasRes.data || [],
        moveis: moveisRes.data || [],
        pecas: pecasRes.data || [],
        pendencias: pendRes.data || [],
        amostras: amostrasRes.data || [],
        assistencias: assistRes.data || [],
        retrabalhos: retrabRes.data || [],
        contatos: contatosRes.data || [],
        prazoAjustes: ajustesRes.data || [],
        pecaHistorico: histRes.data || [],
      })

      if (snapshot.obras.length === 0) {
        setErroGeracao('Nenhuma obra ativa para analisar.')
        return
      }

      const res = await fetch('/api/analyze-gestao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      })
      let json
      try {
        json = await res.json()
      } catch {
        throw new Error('O serviço de análise não respondeu (funciona apenas no site publicado, não em ambiente local).')
      }
      if (!json.success) {
        setErroGeracao(json.error || 'Falha na análise')
        if (json.debug) setDebug(json.debug)
        return
      }

      const insertRes = await supabase.from('ia_analises').insert({
        gerado_por: userEmail || null,
        modelo: MODELO,
        resumo: json.data.resumo || null,
        insights: json.data.insights,
        snapshot,
        obras_ativas: snapshot.obras.length,
        input_tokens: json.usage?.input_tokens ?? null,
        output_tokens: json.usage?.output_tokens ?? null,
      }).select().single()
      checarErros(insertRes)

      setAnalises(prev => [insertRes.data, ...prev].slice(0, 10))
      setAnaliseAtualId(insertRes.data.id)
    } catch (e) {
      setErroGeracao(e.message)
    } finally {
      setGerando(false)
    }
  }

  const analise = analises.find(a => a.id === analiseAtualId) || null
  const insights = Array.isArray(analise?.insights) ? analise.insights : []
  const grupos = ['alta', 'media', 'baixa']
    .map(p => ({ p, itens: insights.filter(i => i.prioridade === p) }))
    .filter(g => g.itens.length > 0)

  const fmtDataHora = ts => ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={24} className="text-primary-600" /> Assistente IA de Gestão
          </h2>
          <p className="text-sm text-gray-500">A IA analisa as obras ativas e aponta os pontos críticos priorizados</p>
        </div>
        <Btn onClick={gerarAnalise} disabled={gerando || migrationPendente}>
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {gerando ? 'Analisando as obras...' : 'Gerar nova análise'}
        </Btn>
      </div>

      {gerando && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Loader2 size={20} className="text-blue-600 animate-spin shrink-0" />
          <span className="text-sm text-blue-800">
            Pode levar de 30 a 90 segundos. A IA está cruzando cronogramas, produção, pendências e prazos de todas as obras ativas.
          </span>
        </div>
      )}

      {erroGeracao && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-600 shrink-0" />
            <span className="text-sm text-red-800">Falha ao gerar a análise: {erroGeracao}</span>
          </div>
          {debug && (
            <details className="mt-2 ml-8 text-xs text-red-700">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(debug, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {migrationPendente ? (
        <Card>
          <CardBody className="text-center py-12">
            <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3" />
            <p className="font-medium text-gray-900">Falta preparar o banco de dados</p>
            <p className="text-sm text-gray-500 mt-1">
              Rode a migration <strong>supabase-migration-v6.13.sql</strong> no SQL Editor do Supabase e recarregue esta página.
            </p>
          </CardBody>
        </Card>
      ) : erro ? (
        <ErroCarga mensagem={erro} onRetry={loadData} />
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : !analise ? (
        <Card>
          <CardBody className="text-center py-16">
            <Sparkles size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Nenhuma análise ainda</p>
            <p className="text-sm text-gray-400 mt-1">
              Clique em "Gerar nova análise" para a IA avaliar as obras ativas — compras a antecipar, prioridades de produção e riscos de prazo.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Contexto da análise + histórico */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">
              Gerada em <strong>{fmtDataHora(analise.created_at)}</strong>
              {analise.gerado_por ? <> por {analise.gerado_por}</> : null}
              {analise.obras_ativas != null ? <> · {analise.obras_ativas} obra(s) ativa(s)</> : null}
            </p>
            {analises.length > 1 && (
              <div className="w-64">
                <Select
                  value={analiseAtualId || ''}
                  onChange={e => setAnaliseAtualId(e.target.value)}
                  options={analises.map(a => ({
                    value: a.id,
                    label: `${fmtDataHora(a.created_at)}${a.gerado_por ? ` — ${a.gerado_por.split('@')[0]}` : ''}`,
                  }))}
                />
              </div>
            )}
          </div>

          {/* Resumo */}
          {analise.resumo && (
            <Card>
              <CardBody>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Quadro geral</p>
                <p className="text-gray-800">{analise.resumo}</p>
              </CardBody>
            </Card>
          )}

          {/* Insights por prioridade */}
          {grupos.map(({ p, itens }) => (
            <div key={p}>
              <div className="flex items-center gap-2 mb-2 mt-4">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORIDADE_INFO[p].cor }} />
                <h3 className="font-semibold text-gray-900">{PRIORIDADE_INFO[p].label}</h3>
                <span className="text-sm text-gray-400">({itens.length})</span>
              </div>
              <div className="space-y-3">
                {itens.map((ins, i) => (
                  <Card key={i} className="border-l-4" style={{ borderLeftColor: PRIORIDADE_INFO[p].cor }}>
                    <CardBody>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="font-semibold text-gray-900">{ins.titulo}</p>
                        <Badge color={CATEGORIA_COR[ins.categoria] || CATEGORIA_COR.outro}>{ins.categoria}</Badge>
                      </div>
                      {ins.detalhe && <p className="text-sm text-gray-600 mt-1.5">{ins.detalhe}</p>}
                      {ins.acao && (
                        <p className="text-sm mt-2 px-3 py-2 rounded-lg bg-primary-50 text-primary-800">
                          <strong>Ação sugerida:</strong> {ins.acao}
                        </p>
                      )}
                      {ins.obras?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                          {ins.obras.map(cod => obrasMap[cod] ? (
                            <button
                              key={cod}
                              onClick={() => navigate(`/obras/${obrasMap[cod]}`)}
                              className="text-xs font-medium px-2 py-0.5 rounded-full border border-primary-200 text-primary-700 hover:bg-primary-50 cursor-pointer"
                            >
                              {cod}
                            </button>
                          ) : (
                            <span key={cod} className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">
                              {cod}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-400 pt-2">
            Análise gerada por IA com base nos dados do sistema no momento da geração — confira antes de decidir.
            Gere uma nova análise quando os dados mudarem.
          </p>
        </div>
      )}
    </div>
  )
}
