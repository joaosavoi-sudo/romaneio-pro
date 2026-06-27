import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, ClipboardList, Trash2, Box, Pencil,
  AlertCircle, Calendar, Paperclip, FileBarChart, LayoutGrid,
  ListChecks, Search, CheckCircle2, RotateCcw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gerarCodigo, SEMAFORO, STATUS_POS_EXPEDICAO, OBRA_STATUS } from '../lib/constants'
import {
  PENDENCIAS_SUGERIDAS, TIPOS_PENDENCIA, TIPO_PENDENCIA_MAP,
  STATUS_PENDENCIA_MAP,
} from '../lib/templates'
import { calcularEtapaItem, calcularSemaforo } from '../lib/itemStatus'
import { getFases, calcFases, temCronograma, dataEntregaDerivada, fmtData, cronogramaEfetivo, calcRealizado } from '../lib/cronograma'
import { Btn, Input, Select, Card, CardBody, Badge, Modal } from '../components/ui'
import StatusBadge from '../components/StatusBadge'
import AnexosObra from '../components/AnexosObra'
import CronogramaBar from '../components/CronogramaBar'
import CronogramaEditorModal from '../components/CronogramaEditorModal'
import ResponsavelInput from '../components/ResponsavelInput'

const EMPTY_MOVEL = {
  codigo: '', nome: '', ambiente: '', descricao: '', dimensoes: '',
  acabamento_interno: '', acabamento_externo: '', incluido: '', nao_incluido: '',
  quantidade: 1, observacoes: '', projeto_recebido: '',
  // Gestão (v6.1 — enxuto)
  responsavel: '',
  previsao_entrega: '',
  status_pos_expedicao: '',
  motivo_bloqueio: '',
}

const EMPTY_PENDENCIA = { tipo: 'cliente', titulo: '', descricao: '', responsavel: '', prazo: '', movel_id: '' }

// Monta o valor inicial do editor de cronograma a partir de uma fonte (obra ou item).
function buildCronoValor(src) {
  const fases = getFases(src)
  return {
    data_inicio: src?.data_inicio || '',
    prazo_dias: src?.prazo_dias || '',
    fases: fases.map(f => ({ chave: f.chave, label: f.label, cor: f.cor, pct: f.pct })),
  }
}

export default function ObraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [obra, setObra] = useState(null)
  const [romaneios, setRomaneios] = useState([])
  const [moveis, setMoveis] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [pecaHistorico, setPecaHistorico] = useState([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState('overview')

  // Modais
  const [movelModalOpen, setMovelModalOpen] = useState(false)
  const [editingMovel, setEditingMovel] = useState(null)
  const [movelForm, setMovelForm] = useState({ ...EMPTY_MOVEL })

  const [pendModalOpen, setPendModalOpen] = useState(false)
  const [editingPend, setEditingPend] = useState(null)
  const [pendForm, setPendForm] = useState({ ...EMPTY_PENDENCIA })

  const [cronoModalOpen, setCronoModalOpen] = useState(false)
  const [cronoTarget, setCronoTarget] = useState({ tipo: 'obra' }) // { tipo:'obra' } | { tipo:'item', movel }
  const [cronoValor, setCronoValor] = useState({ data_inicio: '', prazo_dias: '', fases: [] })

  const [aplicarTemplateOpen, setAplicarTemplateOpen] = useState(false)

  // Filtros aba Itens
  const [filtroSemaforo, setFiltroSemaforo] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [buscaItem, setBuscaItem] = useState('')

  useEffect(() => { loadData() }, [id])

  // Auto-abrir modal do item via ?item=<id> (vindo de /itens)
  useEffect(() => {
    const itemId = searchParams.get('item')
    if (itemId && moveis.length > 0) {
      const m = moveis.find(x => x.id === itemId)
      if (m) {
        openEditMovel(m)
        setTab('moveis')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveis, searchParams])

  async function loadData() {
    const [obraRes, romRes, movRes, pendRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('romaneios').select('*, pecas(id, etapa, movel_id, created_at)').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('moveis').select('*').eq('obra_id', id).order('codigo', { ascending: true }),
      supabase.from('pendencias').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    ])
    setObra(obraRes.data)
    setRomaneios(romRes.data || [])
    setMoveis(movRes.data || [])
    setPendencias(pendRes.data || [])

    // Histórico das peças da obra → base do "realizado" no cronograma
    const pecaIds = (romRes.data || []).flatMap(r => (r.pecas || []).map(p => p.id))
    if (pecaIds.length > 0) {
      const { data: hist } = await supabase
        .from('peca_historico')
        .select('peca_id, etapa_nova, created_at')
        .in('peca_id', pecaIds)
      setPecaHistorico(hist || [])
    } else {
      setPecaHistorico([])
    }
    setLoading(false)
  }

  // Helpers de derivação por item
  const todasPecas = romaneios.flatMap(r => r.pecas || [])
  const realizadoObra = calcRealizado(todasPecas, pecaHistorico)
  function pecasDoItem(movelId) { return todasPecas.filter(p => p.movel_id === movelId) }
  function pendenciasDoItem(movelId) { return pendencias.filter(p => p.movel_id === movelId) }

  // ===== Romaneios =====
  async function criarRomaneio() {
    const { count } = await supabase.from('romaneios').select('id', { count: 'exact', head: true })
    const codigo = gerarCodigo('ROM', (count || 0) + 1)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('romaneios')
      .insert({ codigo, obra_id: id, user_id: user.id })
      .select()
      .single()
    if (data) navigate(`/romaneio/${data.id}`)
  }

  async function excluirRomaneio(romId) {
    if (!confirm('Excluir este romaneio e todas as suas peças?')) return
    await supabase.from('pecas').delete().eq('romaneio_id', romId)
    await supabase.from('romaneios').delete().eq('id', romId)
    loadData()
  }

  // ===== Móveis =====
  function openNewMovel() {
    setEditingMovel(null)
    setMovelForm({ ...EMPTY_MOVEL })
    setMovelModalOpen(true)
  }

  function openEditMovel(m) {
    setEditingMovel(m)
    setMovelForm({
      codigo: m.codigo || '', nome: m.nome || '', ambiente: m.ambiente || '',
      descricao: m.descricao || '', dimensoes: m.dimensoes || '',
      acabamento_interno: m.acabamento_interno || '', acabamento_externo: m.acabamento_externo || '',
      incluido: m.incluido || '', nao_incluido: m.nao_incluido || '',
      quantidade: m.quantidade || 1, observacoes: m.observacoes || '',
      projeto_recebido: m.projeto_recebido || '',
      responsavel: m.responsavel || '',
      previsao_entrega: m.previsao_entrega || '',
      status_pos_expedicao: m.status_pos_expedicao || '',
      motivo_bloqueio: m.motivo_bloqueio || '',
    })
    setMovelModalOpen(true)
  }

  function closeMovelModal() {
    setMovelModalOpen(false)
    setEditingMovel(null)
    setMovelForm({ ...EMPTY_MOVEL })
    if (searchParams.get('item')) {
      searchParams.delete('item')
      setSearchParams(searchParams, { replace: true })
    }
  }

  async function handleSaveMovel(e) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      ...movelForm,
      quantidade: parseInt(movelForm.quantidade) || 1,
      previsao_entrega: movelForm.previsao_entrega || null,
      status_pos_expedicao: movelForm.status_pos_expedicao || null,
      motivo_bloqueio: movelForm.motivo_bloqueio || null,
      ultima_atualizacao_por: user?.email || 'desconhecido',
    }
    if (editingMovel) {
      await supabase.from('moveis').update(payload).eq('id', editingMovel.id)
    } else {
      await supabase.from('moveis').insert({ ...payload, obra_id: id })
    }
    closeMovelModal()
    loadData()
  }

  async function deleteMovel(movelId) {
    if (!confirm('Excluir este item? Peças vinculadas em romaneios ficarão sem item.')) return
    await supabase.from('moveis').delete().eq('id', movelId)
    loadData()
  }

  // ===== Pendências =====
  function openNewPend(movelId = '') {
    setEditingPend(null)
    setPendForm({ ...EMPTY_PENDENCIA, movel_id: movelId })
    setPendModalOpen(true)
  }

  function openEditPend(p) {
    setEditingPend(p)
    setPendForm({
      tipo: p.tipo, titulo: p.titulo, descricao: p.descricao || '',
      responsavel: p.responsavel || '', prazo: p.prazo || '',
      movel_id: p.movel_id || '',
    })
    setPendModalOpen(true)
  }

  async function handleSavePend(e) {
    e.preventDefault()
    const payload = {
      ...pendForm,
      prazo: pendForm.prazo || null,
      movel_id: pendForm.movel_id || null,
      updated_at: new Date().toISOString(),
    }
    if (editingPend) {
      await supabase.from('pendencias').update(payload).eq('id', editingPend.id)
    } else {
      await supabase.from('pendencias').insert({ ...payload, obra_id: id })
    }
    setPendModalOpen(false)
    setEditingPend(null)
    setPendForm({ ...EMPTY_PENDENCIA })
    loadData()
  }

  async function togglePend(p) {
    const novo = p.status === 'aberta' ? 'resolvida' : 'aberta'
    await supabase.from('pendencias').update({
      status: novo,
      resolvida_em: novo === 'resolvida' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    loadData()
  }

  async function deletePend(pendId) {
    if (!confirm('Excluir esta pendência?')) return
    await supabase.from('pendencias').delete().eq('id', pendId)
    loadData()
  }

  // ===== Cronograma (barra de fases) =====
  function openCronoModal() {
    setCronoTarget({ tipo: 'obra' })
    setCronoValor(buildCronoValor(obra))
    setCronoModalOpen(true)
  }

  // Abre o editor para um item — herda o cronograma da obra se o item ainda não tiver o seu.
  function openCronoModalItem(movel) {
    setCronoTarget({ tipo: 'item', movel })
    setCronoValor(buildCronoValor(cronogramaEfetivo(movel, obra)))
    setCronoModalOpen(true)
  }

  async function handleSaveCrono(payload) {
    const entrega = dataEntregaDerivada(payload.data_inicio, payload.prazo_dias)
    if (cronoTarget.tipo === 'item') {
      const novo = {
        data_inicio: payload.data_inicio,
        prazo_dias: payload.prazo_dias,
        cronograma_fases: payload.cronograma_fases,
        previsao_entrega: entrega, // mantém semáforo/Dashboard em sync
      }
      await supabase.from('moveis').update(novo).eq('id', cronoTarget.movel.id)
      // Reflete na hora no modal do item aberto
      setEditingMovel(prev => (prev && prev.id === cronoTarget.movel.id ? { ...prev, ...novo } : prev))
      setMovelForm(prev => ({ ...prev, previsao_entrega: entrega }))
    } else {
      await supabase.from('obras').update({
        data_inicio: payload.data_inicio,
        prazo_dias: payload.prazo_dias,
        cronograma_fases: payload.cronograma_fases,
        data_entrega_prometida: entrega,
      }).eq('id', id)
      // Aplica aos itens — só preenche os que ainda não têm cronograma próprio.
      const semCrono = moveis.filter(m => !temCronograma(m))
      await Promise.all(semCrono.map(m => {
        const upd = {
          data_inicio: payload.data_inicio,
          prazo_dias: payload.prazo_dias,
          cronograma_fases: payload.cronograma_fases,
        }
        if (!m.previsao_entrega) upd.previsao_entrega = entrega
        return supabase.from('moveis').update(upd).eq('id', m.id)
      }))
    }
    setCronoModalOpen(false)
    loadData()
  }

  // ===== Aplicar templates (só pendências) =====
  async function aplicarTemplates() {
    const existentes = new Set(pendencias.map(p => p.titulo))
    const pendInserts = PENDENCIAS_SUGERIDAS
      .filter(t => !existentes.has(t.titulo))
      .map(t => ({ obra_id: id, tipo: t.tipo, titulo: t.titulo }))
    if (pendInserts.length > 0) {
      await supabase.from('pendencias').insert(pendInserts)
    }
    setAplicarTemplateOpen(false)
    loadData()
  }

  // ===== Status da obra (concluir/reabrir) =====
  async function mudarStatusObra(novo) {
    await supabase.from('obras').update({ status: novo }).eq('id', id)
    loadData()
  }

  // ===== Renderização =====
  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (!obra) return <p className="text-center text-red-500 py-12">Obra não encontrada</p>

  const pendAbertas = pendencias.filter(p => p.status === 'aberta')
  const statusObraInfo = OBRA_STATUS.find(s => s.id === obra.status)
  const todosEntregues = moveis.length > 0 && moveis.every(m => m.status_pos_expedicao === 'entregue')
  const fasesCronograma = calcFases(obra)
  const dataFimObra = fasesCronograma[fasesCronograma.length - 1]?.dataFim

  // KPIs
  const totalPecas = romaneios.reduce((sum, r) => sum + (r.pecas?.length || 0), 0)
  const pecasExpedidas = romaneios.reduce(
    (sum, r) => sum + (r.pecas?.filter(p => p.etapa === 'expedicao').length || 0),
    0
  )
  const pctConcluido = totalPecas > 0 ? Math.round((pecasExpedidas / totalPecas) * 100) : 0

  return (
    <div>
      <button
        onClick={() => navigate('/obras')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
      >
        <ArrowLeft size={16} /> Voltar para Obras
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900">{obra.codigo}</h2>
            <Badge color={statusObraInfo?.cor || '#6b7280'}>{statusObraInfo?.label || obra.status}</Badge>
            {pendAbertas.length > 0 && (
              <Badge color="#f59e0b">{pendAbertas.length} pendência(s)</Badge>
            )}
          </div>
          <p className="text-gray-600 mt-1">{obra.cliente}</p>
          {obra.endereco && <p className="text-sm text-gray-400">{obra.endereco}</p>}
          {obra.arquiteto && <p className="text-sm text-gray-400">Arquiteto: {obra.arquiteto}</p>}
        </div>
        <div className="flex items-center gap-2">
          {obra.status === 'ativa' ? (
            <Btn size="sm" variant="secondary" onClick={() => mudarStatusObra('concluida')}>
              <CheckCircle2 size={15} /> Concluir obra
            </Btn>
          ) : (
            <Btn size="sm" variant="secondary" onClick={() => mudarStatusObra('ativa')}>
              <RotateCcw size={15} /> Reabrir obra
            </Btn>
          )}
        </div>
      </div>

      {/* Sugestão: tudo entregue → concluir */}
      {obra.status === 'ativa' && todosEntregues && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex-wrap">
          <p className="text-sm text-emerald-800">✅ Todos os itens foram entregues. Deseja concluir esta obra?</p>
          <Btn size="sm" onClick={() => mudarStatusObra('concluida')}>Concluir obra</Btn>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        <TabBtn current={tab} value="overview" onClick={setTab} icon={LayoutGrid} label="Visão Geral" />
        <TabBtn current={tab} value="pendencias" onClick={setTab} icon={AlertCircle} label={`Pendências${pendAbertas.length > 0 ? ` (${pendAbertas.length})` : ''}`} />
        <TabBtn current={tab} value="cronograma" onClick={setTab} icon={Calendar} label="Cronograma" />
        <TabBtn current={tab} value="moveis" onClick={setTab} icon={Box} label={`Itens (${moveis.length})`} />
        <TabBtn current={tab} value="romaneios" onClick={setTab} icon={ClipboardList} label={`Romaneios (${romaneios.length})`} />
        <TabBtn current={tab} value="anexos" onClick={setTab} icon={Paperclip} label="Anexos" />
        <TabBtn current={tab} value="relatorio" onClick={setTab} icon={FileBarChart} label="Relatório" />
      </div>

      {/* TAB: Visão Geral */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard label="Conclusão" value={`${pctConcluido}%`} sub={`${pecasExpedidas}/${totalPecas} peças expedidas`} cor="#10b981" />
            <KpiCard label="Itens" value={moveis.length} sub="cadastrados na obra" cor="#3b82f6" />
            <KpiCard label="Pendências" value={pendAbertas.length} sub="em aberto" cor={pendAbertas.length > 0 ? '#f59e0b' : '#10b981'} />
          </div>

          {temCronograma(obra) && (
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Cronograma</h3>
                  <button onClick={() => setTab('cronograma')} className="text-xs text-primary-600 hover:underline cursor-pointer">Ver tudo</button>
                </div>
                <CronogramaBar obra={obra} compact realizado={realizadoObra} />
              </CardBody>
            </Card>
          )}

          {pendAbertas.length > 0 && (
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Pendências em aberto</h3>
                  <button onClick={() => setTab('pendencias')} className="text-xs text-primary-600 hover:underline cursor-pointer">Ver tudo</button>
                </div>
                <div className="space-y-2">
                  {pendAbertas.slice(0, 5).map(p => <PendLine key={p.id} pend={p} onToggle={() => togglePend(p)} />)}
                </div>
              </CardBody>
            </Card>
          )}

          {!temCronograma(obra) && pendencias.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <ListChecks size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">Esta obra ainda não tem cronograma nem pendências cadastradas.</p>
                <div className="flex justify-center gap-2">
                  <Btn variant="secondary" onClick={() => setTab('cronograma')}><Calendar size={16} /> Definir cronograma</Btn>
                  <Btn onClick={() => setAplicarTemplateOpen(true)}><ListChecks size={16} /> Aplicar pendências sugeridas</Btn>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* TAB: Pendências */}
      {tab === 'pendencias' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm text-gray-500">
              {pendencias.length} total — {pendAbertas.length} aberta(s)
            </p>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setAplicarTemplateOpen(true)}>
                <ListChecks size={16} /> Aplicar template
              </Btn>
              <Btn onClick={openNewPend}><Plus size={16} /> Nova Pendência</Btn>
            </div>
          </div>

          {pendencias.length === 0 ? (
            <Card><CardBody className="text-center py-12">
              <AlertCircle size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Nenhuma pendência cadastrada</p>
            </CardBody></Card>
          ) : (
            <div className="space-y-2">
              {TIPOS_PENDENCIA.map(t => {
                const lista = pendencias.filter(p => p.tipo === t.id)
                if (lista.length === 0) return null
                return (
                  <Card key={t.id}>
                    <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: t.cor + '10' }}>
                      <span className="font-semibold text-sm" style={{ color: t.cor }}>{t.label}</span>
                      <span className="text-xs text-gray-500">({lista.length})</span>
                    </div>
                    <div>
                      {lista.map(p => (
                        <div key={p.id} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-start gap-3 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={p.status === 'resolvida'}
                            onChange={() => togglePend(p)}
                            className="w-4 h-4 mt-0.5 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${p.status === 'resolvida' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                {p.titulo}
                              </span>
                              {p.status !== 'aberta' && <Badge color={STATUS_PENDENCIA_MAP[p.status]?.cor}>{STATUS_PENDENCIA_MAP[p.status]?.label}</Badge>}
                            </div>
                            {p.descricao && <p className="text-xs text-gray-500 mt-1">{p.descricao}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                              {p.responsavel && <span>👤 {p.responsavel}</span>}
                              {p.prazo && <span>📅 {new Date(p.prazo).toLocaleDateString('pt-BR')}</span>}
                              {p.movel_id && (() => {
                                const mv = moveis.find(x => x.id === p.movel_id)
                                return mv ? <span className="text-blue-600">📦 {mv.codigo} — {mv.nome}</span> : null
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditPend(p)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded cursor-pointer"><Pencil size={14} /></button>
                            <button onClick={() => deletePend(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Cronograma */}
      {tab === 'cronograma' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              {temCronograma(obra) ? (
                <p className="text-sm text-gray-500">
                  Prazo: <strong className="text-gray-900">{obra.prazo_dias} dias</strong>
                  {' · '}{fmtData(obra.data_inicio)} → {fmtData(dataFimObra)}
                </p>
              ) : (
                <p className="text-sm text-gray-500">Cronograma ainda não definido.</p>
              )}
            </div>
            <Btn onClick={openCronoModal}>
              <Pencil size={16} /> {temCronograma(obra) ? 'Editar cronograma' : 'Definir cronograma'}
            </Btn>
          </div>

          {temCronograma(obra) ? (
            <Card><CardBody><CronogramaBar obra={obra} realizado={realizadoObra} /></CardBody></Card>
          ) : (
            <Card><CardBody className="text-center py-12">
              <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">Defina a data de início e o prazo total para montar a barra de fases.</p>
              <Btn onClick={openCronoModal}><Plus size={16} /> Definir cronograma</Btn>
            </CardBody></Card>
          )}
        </div>
      )}

      {/* TAB: Itens */}
      {tab === 'moveis' && (
        <div>
          {/* KPIs por semáforo (calculado) */}
          {moveis.length > 0 && (() => {
            const cont = { verde: 0, amarelo: 0, vermelho: 0 }
            moveis.forEach(m => {
              const cor = calcularSemaforo(m, pendenciasDoItem(m.id))
              cont[cor]++
            })
            return (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <SemaforoChip cor="#10b981" label="Verde" count={cont.verde} ativo={filtroSemaforo === 'verde'} onClick={() => setFiltroSemaforo(filtroSemaforo === 'verde' ? '' : 'verde')} />
                <SemaforoChip cor="#f59e0b" label="Amarelo" count={cont.amarelo} ativo={filtroSemaforo === 'amarelo'} onClick={() => setFiltroSemaforo(filtroSemaforo === 'amarelo' ? '' : 'amarelo')} />
                <SemaforoChip cor="#ef4444" label="Vermelho" count={cont.vermelho} ativo={filtroSemaforo === 'vermelho'} onClick={() => setFiltroSemaforo(filtroSemaforo === 'vermelho' ? '' : 'vermelho')} />
              </div>
            )
          })()}

          {/* Filtros + Ações */}
          <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={buscaItem}
                  onChange={e => setBuscaItem(e.target.value)}
                  placeholder="Buscar código ou nome..."
                  className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 w-56"
                />
              </div>
              <input
                type="text"
                value={filtroResp}
                onChange={e => setFiltroResp(e.target.value)}
                placeholder="Responsável..."
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
              />
              {(filtroSemaforo || filtroResp || buscaItem) && (
                <button onClick={() => { setFiltroSemaforo(''); setFiltroResp(''); setBuscaItem('') }} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer underline">
                  Limpar filtros
                </button>
              )}
            </div>
            <Btn onClick={openNewMovel}><Plus size={16} /> Novo Item</Btn>
          </div>

          {moveis.length === 0 ? (
            <Card><CardBody className="text-center py-12">
              <Box size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">Nenhum item cadastrado nesta obra</p>
              <Btn onClick={openNewMovel} size="sm"><Plus size={16} /> Adicionar primeiro item</Btn>
            </CardBody></Card>
          ) : (() => {
            const filtrados = moveis.filter(m => {
              if (filtroSemaforo) {
                const cor = calcularSemaforo(m, pendenciasDoItem(m.id))
                if (cor !== filtroSemaforo) return false
              }
              if (filtroResp) {
                const r = filtroResp.toLowerCase()
                if (!(m.responsavel || '').toLowerCase().includes(r)) return false
              }
              if (buscaItem) {
                const q = buscaItem.toLowerCase()
                const c = (m.codigo || '').toLowerCase()
                const n = (m.nome || '').toLowerCase()
                const amb = (m.ambiente || '').toLowerCase()
                if (!c.includes(q) && !n.includes(q) && !amb.includes(q)) return false
              }
              return true
            })
            if (filtrados.length === 0) {
              return <Card><CardBody className="text-center py-8 text-gray-500">Nenhum item bate com os filtros.</CardBody></Card>
            }
            return (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Cód</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Ambiente</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Item</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Status</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Sem.</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Responsável</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Prev. entrega</th>
                        <th className="text-right px-3 py-2.5 font-medium text-gray-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map(m => {
                        const etapa = calcularEtapaItem(m, pecasDoItem(m.id))
                        const cor = calcularSemaforo(m, pendenciasDoItem(m.id))
                        const semInfo = SEMAFORO[cor]
                        return (
                          <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEditMovel(m)}>
                            <td className="px-3 py-2.5 font-mono font-medium text-gray-900 whitespace-nowrap">{m.codigo}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{m.ambiente || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate" title={m.nome}>{m.nome}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <StatusBadge label={etapa.label} cor={etapa.cor} />
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-base" title={semInfo.label}>
                              {semInfo.label.split(' ')[0]}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{m.responsavel || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                              {m.previsao_entrega ? new Date(m.previsao_entrega).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={e => { e.stopPropagation(); openEditMovel(m) }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded cursor-pointer"><Pencil size={14} /></button>
                                <button onClick={e => { e.stopPropagation(); deleteMovel(m.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })()}
        </div>
      )}

      {/* TAB: Romaneios */}
      {tab === 'romaneios' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{romaneios.length} romaneio(s)</p>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => navigate('/romaneios')}>Ver lista global</Btn>
              <Btn onClick={criarRomaneio}><Plus size={16} /> Novo Romaneio</Btn>
            </div>
          </div>

          {romaneios.length === 0 ? (
            <Card><CardBody className="text-center py-12">
              <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Nenhum romaneio nesta obra</p>
              <Btn onClick={criarRomaneio} className="mt-4" size="sm"><Plus size={16} /> Criar primeiro romaneio</Btn>
            </CardBody></Card>
          ) : (
            <div className="space-y-3">
              {romaneios.map(rom => {
                const pecas = rom.pecas || []
                const etapas = {}
                pecas.forEach(p => { etapas[p.etapa] = (etapas[p.etapa] || 0) + 1 })
                return (
                  <Card key={rom.id} className="hover:border-primary-300 transition-colors">
                    <CardBody>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/romaneio/${rom.id}`)}>
                          <div className="p-2 bg-blue-50 rounded-lg shrink-0"><ClipboardList size={20} className="text-blue-600" /></div>
                          <div>
                            <span className="font-semibold text-gray-900">{rom.codigo}</span>
                            <p className="text-sm text-gray-500">
                              {pecas.length} peça(s) — {new Date(rom.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {Object.entries(etapas).map(([etapa, count]) => (
                            <div key={etapa} className="flex items-center gap-1">
                              <StatusBadge etapa={etapa} />
                              <span className="text-xs text-gray-500">{count}</span>
                            </div>
                          ))}
                          <button onClick={() => excluirRomaneio(rom.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer ml-2"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Anexos */}
      {tab === 'anexos' && <AnexosObra obraId={id} />}

      {/* TAB: Relatório */}
      {tab === 'relatorio' && (
        <Card><CardBody className="text-center py-12">
          <FileBarChart size={48} className="mx-auto text-primary-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">One Page Report</h3>
          <p className="text-gray-500 mb-4 max-w-md mx-auto">
            Página A4 com status, cronograma, produção e pendências — pronta pra enviar a cliente, arquiteto ou construtora.
          </p>
          <Btn onClick={() => navigate(`/obras/${id}/relatorio`)} size="lg">
            <FileBarChart size={18} /> Abrir relatório
          </Btn>
        </CardBody></Card>
      )}

      {/* MODAL: Item (scroll único) */}
      <Modal open={movelModalOpen} onClose={closeMovelModal} title={editingMovel ? `Editar Item ${editingMovel.codigo || ''}` : 'Novo Item'} size="lg">
        {/* Status + semáforo (modo edição) */}
        {editingMovel && (() => {
          const etapa = calcularEtapaItem(movelForm, pecasDoItem(editingMovel.id))
          const cor = calcularSemaforo(movelForm, pendenciasDoItem(editingMovel.id))
          const semInfo = SEMAFORO[cor]
          return (
            <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-500 uppercase">Status:</span>
              <StatusBadge label={etapa.label} cor={etapa.cor} />
              <span className="text-xs text-gray-500 uppercase ml-2">Semáforo:</span>
              <span className="text-base" title={semInfo.label}>{semInfo.label.split(' ')[0]}</span>
              {etapa.id === 'bloqueado' && etapa.motivo && (
                <span className="text-xs text-red-600 ml-auto">⚠ {etapa.motivo}</span>
              )}
            </div>
          )
        })()}

        <form onSubmit={handleSaveMovel} className="space-y-4">
          {/* === Identificação === */}
          <div className="grid grid-cols-3 gap-2">
            <Input label="Código *" value={movelForm.codigo} onChange={e => setMovelForm({ ...movelForm, codigo: e.target.value })} required />
            <Input label="Ambiente" value={movelForm.ambiente} onChange={e => setMovelForm({ ...movelForm, ambiente: e.target.value })} />
            <Input label="Quantidade" type="number" min="1" value={movelForm.quantidade} onChange={e => setMovelForm({ ...movelForm, quantidade: e.target.value })} />
          </div>
          <Input label="Nome (curto) *" value={movelForm.nome} onChange={e => setMovelForm({ ...movelForm, nome: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea value={movelForm.descricao} onChange={e => setMovelForm({ ...movelForm, descricao: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <Input label="Dimensões" value={movelForm.dimensoes} onChange={e => setMovelForm({ ...movelForm, dimensoes: e.target.value })} placeholder="4,45x2,80m" />

          {/* === Acabamentos === */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acabamento Interno</label>
              <textarea value={movelForm.acabamento_interno} onChange={e => setMovelForm({ ...movelForm, acabamento_interno: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acabamento Externo</label>
              <textarea value={movelForm.acabamento_externo} onChange={e => setMovelForm({ ...movelForm, acabamento_externo: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incluído</label>
              <textarea value={movelForm.incluido} onChange={e => setMovelForm({ ...movelForm, incluido: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Não Incluído</label>
              <textarea value={movelForm.nao_incluido} onChange={e => setMovelForm({ ...movelForm, nao_incluido: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* === Acompanhamento === */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs uppercase tracking-wide font-medium text-gray-500 mb-2">Acompanhamento</p>
            <div className="grid grid-cols-2 gap-2">
              <ResponsavelInput value={movelForm.responsavel} onChange={e => setMovelForm({ ...movelForm, responsavel: e.target.value })} placeholder="Marceneiro / equipe" />
              <Input label="Previsão entrega" type="date" value={movelForm.previsao_entrega} onChange={e => setMovelForm({ ...movelForm, previsao_entrega: e.target.value })} />
            </div>
            <div className="mt-2">
              <Select
                label="Status pós-expedição (sobrescreve status das peças)"
                value={movelForm.status_pos_expedicao}
                onChange={e => setMovelForm({ ...movelForm, status_pos_expedicao: e.target.value })}
                placeholder="— ainda em produção —"
                options={Object.values(STATUS_POS_EXPEDICAO).map(s => ({ value: s.id, label: s.label }))}
              />
            </div>
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de bloqueio (vazio = não bloqueado)</label>
              <textarea
                value={movelForm.motivo_bloqueio}
                onChange={e => setMovelForm({ ...movelForm, motivo_bloqueio: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ex: Aguardando aprovação do cliente"
              />
            </div>
          </div>

          {/* === Cronograma do item === */}
          {editingMovel && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide font-medium text-gray-500">Cronograma do item</p>
                <Btn type="button" size="sm" variant="secondary" onClick={() => openCronoModalItem(editingMovel)}>
                  <Calendar size={14} /> {temCronograma(editingMovel) ? 'Editar' : 'Personalizar'}
                </Btn>
              </div>
              {temCronograma(editingMovel) ? (
                <CronogramaBar obra={editingMovel} compact />
              ) : temCronograma(obra) ? (
                <>
                  <p className="text-xs text-gray-500 mb-2 italic">Seguindo o cronograma da obra.</p>
                  <CronogramaBar obra={obra} compact />
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Defina o cronograma da obra primeiro, ou clique em Personalizar para criar um específico do item.</p>
              )}
            </div>
          )}

          {/* === Notas === */}
          <Input label="Projeto recebido" value={movelForm.projeto_recebido} onChange={e => setMovelForm({ ...movelForm, projeto_recebido: e.target.value })} />
          <Input label="Observações" value={movelForm.observacoes} onChange={e => setMovelForm({ ...movelForm, observacoes: e.target.value })} />

          {/* === Pendências do item === */}
          {editingMovel && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide font-medium text-gray-500">
                  Pendências do item ({pendenciasDoItem(editingMovel.id).length})
                </p>
                <Btn type="button" size="sm" onClick={() => openNewPend(editingMovel.id)}>
                  <Plus size={14} /> Nova
                </Btn>
              </div>
              {pendenciasDoItem(editingMovel.id).length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhuma pendência vinculada</p>
              ) : (
                <div className="space-y-1.5">
                  {pendenciasDoItem(editingMovel.id).map(p => {
                    const tipo = TIPO_PENDENCIA_MAP[p.tipo]
                    return (
                      <div key={p.id} className="flex items-start gap-2 p-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                        <input type="checkbox" checked={p.status === 'resolvida'} onChange={() => togglePend(p)} className="w-4 h-4 mt-0.5 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {tipo && <Badge color={tipo.cor}>{tipo.label}</Badge>}
                            <span className={`text-sm ${p.status === 'resolvida' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{p.titulo}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                            {p.responsavel && <span>👤 {p.responsavel}</span>}
                            {p.prazo && <span>📅 {new Date(p.prazo).toLocaleDateString('pt-BR')}</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => openEditPend(p)} className="p-1 text-gray-400 hover:text-primary-600 cursor-pointer"><Pencil size={13} /></button>
                        <button type="button" onClick={() => deletePend(p.id)} className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {editingMovel?.ultima_atualizacao_por && (
            <p className="text-xs text-gray-400 pt-1">
              Última atualização: {editingMovel.ultima_atualizacao_por}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Btn type="button" variant="secondary" onClick={closeMovelModal}>Cancelar</Btn>
            <Btn type="submit">{editingMovel ? 'Salvar' : 'Criar Item'}</Btn>
          </div>
        </form>
      </Modal>

      {/* MODAL: Pendência */}
      <Modal open={pendModalOpen} onClose={() => setPendModalOpen(false)} title={editingPend ? 'Editar Pendência' : 'Nova Pendência'}>
        <form onSubmit={handleSavePend} className="space-y-3">
          <Select
            label="Tipo *"
            value={pendForm.tipo}
            onChange={e => setPendForm({ ...pendForm, tipo: e.target.value })}
            options={TIPOS_PENDENCIA.map(t => ({ value: t.id, label: t.label }))}
            required
          />
          <Select
            label="Item vinculado (opcional)"
            value={pendForm.movel_id}
            onChange={e => setPendForm({ ...pendForm, movel_id: e.target.value })}
            placeholder="— pendência geral da obra —"
            options={moveis.map(m => ({ value: m.id, label: `${m.codigo} — ${m.nome}` }))}
          />
          <Input label="Título *" value={pendForm.titulo} onChange={e => setPendForm({ ...pendForm, titulo: e.target.value })} placeholder="Ex: Cliente aprovar projeto" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea value={pendForm.descricao} onChange={e => setPendForm({ ...pendForm, descricao: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ResponsavelInput value={pendForm.responsavel} onChange={e => setPendForm({ ...pendForm, responsavel: e.target.value })} />
            <Input label="Prazo" type="date" value={pendForm.prazo} onChange={e => setPendForm({ ...pendForm, prazo: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setPendModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit">{editingPend ? 'Salvar' : 'Criar Pendência'}</Btn>
          </div>
        </form>
      </Modal>

      {/* MODAL: Cronograma (obra ou item) */}
      <CronogramaEditorModal
        open={cronoModalOpen}
        onClose={() => setCronoModalOpen(false)}
        titulo={cronoTarget.tipo === 'item' ? `Cronograma do item ${cronoTarget.movel?.codigo || ''}` : 'Cronograma da obra'}
        valorInicial={cronoValor}
        onSave={handleSaveCrono}
      />

      {/* MODAL: Aplicar pendências sugeridas */}
      <Modal open={aplicarTemplateOpen} onClose={() => setAplicarTemplateOpen(false)} title="Aplicar pendências sugeridas">
        <p className="text-sm text-gray-600 mb-4">
          O sistema vai criar pendências comuns pra obras de marcenaria.
          Pendências já existentes (mesmo título) serão puladas.
        </p>
        <div className="p-3 bg-gray-50 rounded-lg mb-4">
          <p className="font-medium text-sm text-gray-900 mb-1">📋 Pendências sugeridas ({PENDENCIAS_SUGERIDAS.length} itens)</p>
          <p className="text-xs text-gray-500">Definições do cliente, medições, compras, canteiro</p>
        </div>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={() => setAplicarTemplateOpen(false)}>Cancelar</Btn>
          <Btn onClick={aplicarTemplates}>Aplicar pendências</Btn>
        </div>
      </Modal>
    </div>
  )
}

function TabBtn({ current, value, onClick, icon: Icon, label }) {
  const active = current === value
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
        active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  )
}

function SemaforoChip({ cor, label, count, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer ${
        ativo ? 'border-2 shadow-sm' : 'border border-gray-200 hover:border-gray-300'
      }`}
      style={ativo ? { borderColor: cor, backgroundColor: cor + '10' } : {}}
    >
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
      <span className="text-gray-700">{label}</span>
      <span className="font-semibold ml-auto" style={{ color: cor }}>{count}</span>
    </button>
  )
}

function KpiCard({ label, value, sub, cor }) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</div>
        <div className="text-2xl font-bold mt-1" style={{ color: cor }}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </CardBody>
    </Card>
  )
}

function PendLine({ pend, onToggle }) {
  const tipo = TIPO_PENDENCIA_MAP[pend.tipo]
  return (
    <div className="flex items-start gap-3">
      <input type="checkbox" checked={pend.status === 'resolvida'} onChange={onToggle} className="w-4 h-4 mt-0.5 cursor-pointer" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={tipo?.cor}>{tipo?.label}</Badge>
          <span className="text-sm text-gray-900">{pend.titulo}</span>
        </div>
        {pend.prazo && <p className="text-xs text-gray-500 mt-0.5">📅 {new Date(pend.prazo).toLocaleDateString('pt-BR')}</p>}
      </div>
    </div>
  )
}
