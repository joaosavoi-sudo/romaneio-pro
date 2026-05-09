import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Save, ClipboardList, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Btn, Card, CardBody } from '../components/ui'
import { ETAPAS } from '../lib/constants'
import { FASE_MAP, TIPO_PENDENCIA_MAP, isAtrasado } from '../lib/templates'

export default function RelatorioObra() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [obra, setObra] = useState(null)
  const [marcos, setMarcos] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [pecas, setPecas] = useState([])
  const [moveis, setMoveis] = useState([])
  const [loading, setLoading] = useState(true)
  const [proximos, setProximos] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const [obraRes, marcosRes, pendRes, romsRes, movRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('obra_marcos').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('pendencias').select('*').eq('obra_id', id).eq('status', 'aberta').order('prazo', { ascending: true, nullsLast: true }),
      supabase.from('romaneios').select('id, pecas(id, etapa)').eq('obra_id', id),
      supabase.from('moveis').select('id').eq('obra_id', id),
    ])
    setObra(obraRes.data)
    setMarcos(marcosRes.data || [])
    setPendencias(pendRes.data || [])
    const allPecas = (romsRes.data || []).flatMap(r => r.pecas || [])
    setPecas(allPecas)
    setMoveis(movRes.data || [])
    setProximos(obraRes.data?.proximos_passos || '')
    setLoading(false)
  }

  async function salvarProximos() {
    setSaving(true)
    await supabase.from('obras').update({ proximos_passos: proximos }).eq('id', id)
    setSaving(false)
    setSavedAt(new Date())
    setTimeout(() => setSavedAt(null), 2000)
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (!obra) return <p className="text-center text-red-500 py-12">Obra não encontrada</p>

  const totalPecas = pecas.length
  const pecasExpedidas = pecas.filter(p => p.etapa === 'expedicao').length
  const pctConcluido = totalPecas > 0 ? Math.round((pecasExpedidas / totalPecas) * 100) : 0

  // Distribuição de peças por etapa
  const distribuicao = {}
  ETAPAS.forEach(e => { distribuicao[e.id] = 0 })
  pecas.forEach(p => { if (distribuicao[p.etapa] !== undefined) distribuicao[p.etapa]++ })

  // Status geral
  const hoje = new Date()
  const dataEntrega = obra.data_entrega_prometida ? new Date(obra.data_entrega_prometida) : null
  const atrasado = dataEntrega && hoje > dataEntrega && pctConcluido < 100
  const statusGeral = pctConcluido === 100 ? 'Concluída' : atrasado ? 'Atrasada' : 'No prazo'
  const statusCor = pctConcluido === 100 ? '#3b82f6' : atrasado ? '#ef4444' : '#10b981'

  // Pendências por tipo
  const pendPorTipo = {}
  pendencias.forEach(p => {
    if (!pendPorTipo[p.tipo]) pendPorTipo[p.tipo] = []
    pendPorTipo[p.tipo].push(p)
  })

  return (
    <div>
      {/* Toolbar (não imprime) */}
      <div className="no-print flex items-center justify-between mb-6 flex-wrap gap-2">
        <button onClick={() => navigate(`/obras/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          <ArrowLeft size={16} /> Voltar para a obra
        </button>
        <div className="flex gap-2 items-center">
          {savedAt && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> Salvo</span>}
          <Btn variant="secondary" onClick={salvarProximos} disabled={saving}>
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar próximos passos'}
          </Btn>
          <Btn onClick={() => window.print()}>
            <Printer size={18} /> Imprimir / Salvar PDF
          </Btn>
        </div>
      </div>

      {/* Documento */}
      <div className="print-doc bg-white rounded-xl shadow-sm border border-gray-200 mx-auto" style={{ maxWidth: '210mm', padding: '15mm' }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid #059669', paddingBottom: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={26} color="#059669" />
                <h1 style={{ margin: 0, fontSize: '20pt', fontWeight: 700, color: '#111827' }}>Status da Obra</h1>
              </div>
              <div style={{ fontSize: '11pt', color: '#374151', marginTop: '2px' }}>
                <strong>{obra.codigo}</strong> · {obra.cliente}
              </div>
              {obra.endereco && <div style={{ fontSize: '9pt', color: '#6b7280' }}>{obra.endereco}</div>}
              {obra.arquiteto && <div style={{ fontSize: '9pt', color: '#6b7280' }}>Arquiteto: {obra.arquiteto}</div>}
              {obra.construtora && <div style={{ fontSize: '9pt', color: '#6b7280' }}>Construtora: {obra.construtora}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#6b7280' }}>
              <div>Emitido em {new Date().toLocaleDateString('pt-BR')}</div>
              {obra.data_entrega_prometida && (
                <div style={{ marginTop: '2px' }}>
                  Entrega: <strong style={{ color: '#111827' }}>{new Date(obra.data_entrega_prometida).toLocaleDateString('pt-BR')}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status geral - 3 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          <SecaoCard label="Status" value={statusGeral} color={statusCor} />
          <SecaoCard label="Conclusão" value={`${pctConcluido}%`} sub={`${pecasExpedidas}/${totalPecas} peças`} color="#059669" />
          <SecaoCard label="Pendências em aberto" value={pendencias.length} sub={`${moveis.length} itens cadastrados`} color={pendencias.length > 0 ? '#f59e0b' : '#10b981'} />
        </div>

        {/* Cronograma */}
        {marcos.length > 0 && (
          <Secao titulo="Cronograma">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '8pt' }}>
              {['pre_producao', 'producao', 'pos_producao'].map(faseId => {
                const fase = FASE_MAP[faseId]
                const lista = marcos.filter(m => m.fase === faseId)
                if (lista.length === 0) return <div key={faseId} />
                return (
                  <div key={faseId} style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ padding: '4px 8px', fontWeight: 600, fontSize: '8.5pt', backgroundColor: fase.cor + '20', color: fase.cor }}>
                      {fase.label}
                    </div>
                    <div style={{ padding: '4px 8px' }}>
                      {lista.map(m => {
                        const atr = isAtrasado(m)
                        const concluido = m.status === 'concluido'
                        const cor = concluido ? '#10b981' : atr ? '#ef4444' : '#9ca3af'
                        const icone = concluido ? '✓' : atr ? '⚠' : '○'
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', padding: '2px 0' }}>
                            <span style={{ color: cor, fontWeight: 700, lineHeight: 1.2 }}>{icone}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '8pt', textDecoration: concluido ? 'line-through' : 'none', color: concluido ? '#9ca3af' : '#374151' }}>
                                {m.marco}
                              </div>
                              {m.data_alvo && (
                                <div style={{ fontSize: '7pt', color: '#9ca3af' }}>
                                  {new Date(m.data_alvo).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </Secao>
        )}

        {/* Distribuição de peças */}
        {totalPecas > 0 && (
          <Secao titulo="Produção das peças">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '8.5pt' }}>
              {ETAPAS.map(e => {
                const count = distribuicao[e.id] || 0
                const pct = totalPecas > 0 ? (count / totalPecas) * 100 : 0
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '70px', color: '#6b7280' }}>{e.label}</span>
                    <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '3px', height: '14px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(pct, 0)}%`, backgroundColor: e.cor, height: '100%' }} />
                    </div>
                    <span style={{ width: '50px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{count} peça(s)</span>
                  </div>
                )
              })}
            </div>
          </Secao>
        )}

        {/* Pendências em aberto */}
        {pendencias.length > 0 && (
          <Secao titulo={`Pendências em aberto (${pendencias.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {Object.entries(pendPorTipo).map(([tipoId, lista]) => {
                const tipo = TIPO_PENDENCIA_MAP[tipoId]
                return (
                  <div key={tipoId}>
                    <div style={{ fontSize: '8pt', fontWeight: 600, color: tipo?.cor || '#6b7280', marginTop: '3px', marginBottom: '2px' }}>
                      {tipo?.label || tipoId} ({lista.length})
                    </div>
                    {lista.slice(0, 5).map(p => (
                      <div key={p.id} style={{ fontSize: '8pt', color: '#374151', paddingLeft: '8px', marginBottom: '1px' }}>
                        • {p.titulo}
                        {p.prazo && <span style={{ color: '#9ca3af', marginLeft: '6px' }}>({new Date(p.prazo).toLocaleDateString('pt-BR')})</span>}
                      </div>
                    ))}
                    {lista.length > 5 && <div style={{ fontSize: '7.5pt', color: '#9ca3af', paddingLeft: '8px' }}>+ {lista.length - 5} outra(s)</div>}
                  </div>
                )
              })}
            </div>
          </Secao>
        )}

        {/* Próximos passos - editável */}
        <Secao titulo="Próximos passos">
          <textarea
            className="no-print w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={4}
            value={proximos}
            onChange={e => setProximos(e.target.value)}
            onBlur={salvarProximos}
            placeholder="Descreva aqui os próximos passos da obra..."
          />
          <div className="print-only" style={{ display: 'none', whiteSpace: 'pre-wrap', fontSize: '9pt', color: '#374151', minHeight: '40px' }}>
            {proximos || 'Sem próximos passos definidos.'}
          </div>
        </Secao>

        {/* Footer */}
        <div style={{ marginTop: '14px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '7.5pt', color: '#9ca3af', textAlign: 'center' }}>
          Romaneio Pro · Gerado em {new Date().toLocaleString('pt-BR')} · Top Móveis
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-doc {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <h2 style={{ fontSize: '10pt', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px', paddingBottom: '2px', borderBottom: '1px solid #e5e7eb' }}>
        {titulo}
      </h2>
      {children}
    </div>
  )
}

function SecaoCard({ label, value, sub, color }) {
  return (
    <div style={{ border: `1px solid ${color}40`, backgroundColor: color + '10', borderRadius: '6px', padding: '8px 10px' }}>
      <div style={{ fontSize: '8pt', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ fontSize: '14pt', fontWeight: 700, color, marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '7.5pt', color: '#9ca3af' }}>{sub}</div>}
    </div>
  )
}
