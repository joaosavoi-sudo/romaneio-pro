import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarCheck, Printer, Save, History } from 'lucide-react'
import { supabase, checarErros } from '../lib/supabase'
import { semanaDe, fmtSemana, montarPauta } from '../lib/reuniao'
import { fmtData } from '../lib/cronograma'
import { Btn, Input, Card, CardBody, Modal, ErroCarga } from '../components/ui'

export default function ReuniaoSemanal() {
  const navigate = useNavigate()
  const [dataRef, setDataRef] = useState(() => new Date())
  const [dados, setDados] = useState(null)
  const [atas, setAtas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [anotacoes, setAnotacoes] = useState({})
  const [participantes, setParticipantes] = useState('')
  const [decisoes, setDecisoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvaOk, setSalvaOk] = useState(false)
  const [ataAberta, setAtaAberta] = useState(null)
  const [userEmail, setUserEmail] = useState('')

  const semana = useMemo(() => semanaDe(dataRef), [dataRef])

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [])
  useEffect(() => { loadData() /* dados independem da semana */ }, [])

  async function loadData() {
    setErro(null)
    setLoading(true)
    try {
      const [obrasRes, moveisRes, pecasRes, pendRes, ajustesRes, reunioesRes] = await Promise.all([
        supabase.from('obras').select('id, codigo, cliente, status, etapa_atual, checklist, data_entrega_prometida'),
        supabase.from('moveis').select('id, obra_id, codigo, responsavel, responsavel_producao, motivo_bloqueio, status_pos_expedicao, previsao_entrega, data_inicio_producao, data_inicio_montagem'),
        supabase.from('pecas').select('id, etapa, movel_id').not('movel_id', 'is', null),
        supabase.from('pendencias').select('id, obra_id, tipo, titulo, status, prazo, created_at'),
        supabase.from('obra_prazo_ajustes').select('id, obra_id, dias_delta, justificativa, created_at'),
        supabase.from('reunioes').select('*').eq('tipo', 'semanal').order('data', { ascending: false }).limit(12),
      ])
      checarErros(obrasRes, moveisRes, pecasRes, pendRes, ajustesRes, reunioesRes)
      setDados({
        obras: obrasRes.data || [],
        moveis: moveisRes.data || [],
        pecas: pecasRes.data || [],
        pendencias: pendRes.data || [],
        prazoAjustes: ajustesRes.data || [],
      })
      setAtas(reunioesRes.data || [])
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  const pauta = useMemo(() => (dados ? montarPauta(dados, semana) : []), [dados, semana])

  function mudarSemana(delta) {
    setDataRef(d => {
      const n = new Date(d)
      n.setDate(n.getDate() + delta * 7)
      return n
    })
  }

  async function salvarAta() {
    setSalvando(true)
    setSalvaOk(false)
    try {
      const snapshot = pauta.map(item => ({
        id: item.id,
        titulo: item.titulo,
        linhas: item.linhas.map(l => l.texto),
        anotacoes: (anotacoes[item.id] || '').trim(),
      }))
      const res = await supabase.from('reunioes').insert({
        tipo: 'semanal',
        data: new Date().toISOString().slice(0, 10),
        semana_inicio: semana.inicio,
        semana_fim: semana.fim,
        participantes: participantes.trim() || null,
        pauta: snapshot,
        decisoes: decisoes.trim() || null,
        criado_por: userEmail || null,
      })
      checarErros(res)
      setSalvaOk(true)
      setAnotacoes({})
      setParticipantes('')
      setDecisoes('')
      loadData()
    } catch (e) {
      alert('Erro ao salvar a ata: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck size={24} className="text-primary-600" /> Reunião Semanal de Alinhamento
          </h2>
          <p className="text-sm text-gray-500">Comercial + PCP · segunda-feira · 45 min (Modelo Ouro — Seção 7.1)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
            <button onClick={() => mudarSemana(-1)} className="p-1 rounded hover:bg-gray-100 cursor-pointer" aria-label="Semana anterior">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-900 w-32 text-center">{fmtSemana(semana)}</span>
            <button onClick={() => mudarSemana(1)} className="p-1 rounded hover:bg-gray-100 cursor-pointer" aria-label="Próxima semana">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
          <Btn variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </Btn>
        </div>
      </div>

      {erro ? (
        <ErroCarga mensagem={erro} onRetry={loadData} />
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Pauta */}
          <div className="xl:col-span-2 space-y-3 print-doc">
            {/* Cabeçalho só na impressão */}
            <div className="hidden print:block mb-4" style={{ borderBottom: '2px solid #059669', paddingBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: '18pt', fontWeight: 700 }}>Reunião Semanal de Alinhamento</h1>
              <p style={{ margin: '4px 0 0', fontSize: '10pt', color: '#374151' }}>
                Semana {fmtSemana(semana)} · Comercial + PCP {participantes.trim() ? `· Participantes: ${participantes}` : ''}
              </p>
            </div>

            {pauta.map((item, idx) => (
              <Card key={item.id}>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
                      {item.linhas.length === 0 ? (
                        <p className="text-sm text-gray-400 mt-1">Nada registrado para esta semana.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {item.linhas.map((l, i) => (
                            <li key={i} className="text-sm flex items-start gap-1.5">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: l.cor || '#9ca3af' }} />
                              {l.obraId ? (
                                <button
                                  onClick={() => navigate(`/obras/${l.obraId}`)}
                                  className="text-left text-gray-700 hover:text-primary-700 hover:underline cursor-pointer"
                                >
                                  {l.texto}
                                </button>
                              ) : (
                                <span className="text-gray-700">{l.texto}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <textarea
                        value={anotacoes[item.id] || ''}
                        onChange={e => setAnotacoes(a => ({ ...a, [item.id]: e.target.value }))}
                        rows={2}
                        placeholder="Anotações / decisões deste item..."
                        className="no-print mt-3 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
                      />
                      {anotacoes[item.id]?.trim() && (
                        <p className="hidden print:block text-sm mt-2" style={{ color: '#374151' }}>
                          <strong>Anotações:</strong> {anotacoes[item.id]}
                        </p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}

            {/* Fechamento da ata */}
            <Card className="no-print">
              <CardBody className="space-y-3">
                <h3 className="font-semibold text-gray-900">Fechamento da reunião</h3>
                <Input
                  label="Participantes"
                  value={participantes}
                  onChange={e => setParticipantes(e.target.value)}
                  placeholder="Ex: João (Comercial), Maria (PCP), Pedro (G. Obra)"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Decisões e encaminhamentos gerais</label>
                  <textarea
                    value={decisoes}
                    onChange={e => setDecisoes(e.target.value)}
                    rows={3}
                    placeholder="O que ficou decidido, quem faz o quê até a próxima reunião..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {salvaOk ? <p className="text-sm text-emerald-700">✅ Ata salva no histórico.</p> : <span />}
                  <Btn onClick={salvarAta} disabled={salvando}>
                    <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar ata da reunião'}
                  </Btn>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Histórico de atas */}
          <div className="no-print">
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <History size={18} className="text-gray-400" /> Atas anteriores
                </h3>
                {atas.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma ata salva ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {atas.map(a => (
                      <li key={a.id}>
                        <button
                          onClick={() => setAtaAberta(a)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/40 cursor-pointer"
                        >
                          <p className="text-sm font-medium text-gray-900">Semana {a.semana_inicio ? fmtSemana({ inicio: a.semana_inicio, fim: a.semana_fim }) : fmtData(a.data)}</p>
                          <p className="text-xs text-gray-500">
                            Registrada em {fmtData(a.data)}{a.participantes ? ` · ${a.participantes}` : ''}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL: ata anterior (somente leitura) */}
      <Modal open={!!ataAberta} onClose={() => setAtaAberta(null)} title={ataAberta ? `Ata — semana ${ataAberta.semana_inicio ? fmtSemana({ inicio: ataAberta.semana_inicio, fim: ataAberta.semana_fim }) : fmtData(ataAberta.data)}` : ''}>
        {ataAberta && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-xs text-gray-500">
              Registrada em {fmtData(ataAberta.data)}{ataAberta.criado_por ? ` por ${ataAberta.criado_por}` : ''}
              {ataAberta.participantes ? ` · Participantes: ${ataAberta.participantes}` : ''}
            </p>
            {(Array.isArray(ataAberta.pauta) ? ataAberta.pauta : []).map((item, idx) => (
              <div key={item.id || idx}>
                <p className="text-sm font-semibold text-gray-900">{idx + 1}. {item.titulo}</p>
                {(item.linhas || []).length === 0 ? (
                  <p className="text-xs text-gray-400 ml-4">Nada registrado.</p>
                ) : (
                  <ul className="ml-4 list-disc list-inside">
                    {item.linhas.map((t, i) => <li key={i} className="text-sm text-gray-600">{t}</li>)}
                  </ul>
                )}
                {item.anotacoes && (
                  <p className="text-sm text-gray-700 ml-4 mt-1"><strong>Anotações:</strong> {item.anotacoes}</p>
                )}
              </div>
            ))}
            {ataAberta.decisoes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Decisões e encaminhamentos</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{ataAberta.decisoes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
