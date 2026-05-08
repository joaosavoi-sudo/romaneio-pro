import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ClipboardList, Trash2, Box, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gerarCodigo } from '../lib/constants'
import { Btn, Input, Card, CardBody, Badge, Modal } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

const EMPTY_MOVEL = {
  codigo: '', nome: '', ambiente: '', descricao: '', dimensoes: '',
  acabamento_interno: '', acabamento_externo: '', incluido: '', nao_incluido: '',
  quantidade: 1, observacoes: '', projeto_recebido: '',
}

export default function ObraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [obra, setObra] = useState(null)
  const [romaneios, setRomaneios] = useState([])
  const [moveis, setMoveis] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal de móvel
  const [movelModalOpen, setMovelModalOpen] = useState(false)
  const [editingMovel, setEditingMovel] = useState(null)
  const [movelForm, setMovelForm] = useState({ ...EMPTY_MOVEL })

  // Tab atual
  const [tab, setTab] = useState('moveis') // moveis | romaneios

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const [obraRes, romRes, movRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('romaneios').select('*, pecas(id, etapa)').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('moveis').select('*').eq('obra_id', id).order('codigo', { ascending: true }),
    ])
    setObra(obraRes.data)
    setRomaneios(romRes.data || [])
    setMoveis(movRes.data || [])
    setLoading(false)
  }

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

  function openNewMovel() {
    setEditingMovel(null)
    setMovelForm({ ...EMPTY_MOVEL })
    setMovelModalOpen(true)
  }

  function openEditMovel(m) {
    setEditingMovel(m)
    setMovelForm({
      codigo: m.codigo || '',
      nome: m.nome || '',
      ambiente: m.ambiente || '',
      descricao: m.descricao || '',
      dimensoes: m.dimensoes || '',
      acabamento_interno: m.acabamento_interno || '',
      acabamento_externo: m.acabamento_externo || '',
      incluido: m.incluido || '',
      nao_incluido: m.nao_incluido || '',
      quantidade: m.quantidade || 1,
      observacoes: m.observacoes || '',
      projeto_recebido: m.projeto_recebido || '',
    })
    setMovelModalOpen(true)
  }

  async function handleSaveMovel(e) {
    e.preventDefault()
    const payload = {
      ...movelForm,
      quantidade: parseInt(movelForm.quantidade) || 1,
    }
    if (editingMovel) {
      await supabase.from('moveis').update(payload).eq('id', editingMovel.id)
    } else {
      await supabase.from('moveis').insert({ ...payload, obra_id: id })
    }
    setMovelModalOpen(false)
    setEditingMovel(null)
    setMovelForm({ ...EMPTY_MOVEL })
    loadData()
  }

  async function deleteMovel(movelId) {
    if (!confirm('Excluir este móvel? Peças vinculadas em romaneios ficarão sem móvel.')) return
    await supabase.from('moveis').delete().eq('id', movelId)
    loadData()
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (!obra) return <p className="text-center text-red-500 py-12">Obra não encontrada</p>

  return (
    <div>
      <button onClick={() => navigate('/obras')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Voltar para Obras
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{obra.codigo}</h2>
            <Badge color={obra.status === 'ativa' ? '#10b981' : obra.status === 'concluida' ? '#3b82f6' : '#ef4444'}>
              {obra.status}
            </Badge>
          </div>
          <p className="text-gray-600 mt-1">{obra.cliente}</p>
          {obra.endereco && <p className="text-sm text-gray-400">{obra.endereco}</p>}
          {obra.arquiteto && <p className="text-sm text-gray-400">Arquiteto: {obra.arquiteto}</p>}
        </div>
        <div className="flex gap-2">
          {tab === 'moveis' && (
            <Btn variant="secondary" onClick={openNewMovel}>
              <Box size={18} /> Novo Móvel
            </Btn>
          )}
          {tab === 'romaneios' && (
            <Btn onClick={criarRomaneio}>
              <Plus size={18} /> Novo Romaneio
            </Btn>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setTab('moveis')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px cursor-pointer ${
            tab === 'moveis'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Box size={16} className="inline mr-1.5 -mt-0.5" /> Móveis ({moveis.length})
        </button>
        <button
          onClick={() => setTab('romaneios')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px cursor-pointer ${
            tab === 'romaneios'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList size={16} className="inline mr-1.5 -mt-0.5" /> Romaneios ({romaneios.length})
        </button>
      </div>

      {/* TAB: Móveis */}
      {tab === 'moveis' && (
        moveis.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Box size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">Nenhum móvel cadastrado nesta obra</p>
              <Btn onClick={openNewMovel} size="sm"><Plus size={16} /> Adicionar primeiro móvel</Btn>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Ambiente</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Dimensões</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Qtd</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {moveis.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEditMovel(m)}>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{m.codigo}</td>
                      <td className="px-4 py-3 text-gray-500">{m.ambiente || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{m.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{m.dimensoes || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{m.quantidade || 1}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={e => { e.stopPropagation(); openEditMovel(m) }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded cursor-pointer" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteMovel(m.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* TAB: Romaneios */}
      {tab === 'romaneios' && (
        romaneios.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Nenhum romaneio nesta obra</p>
              <Btn onClick={criarRomaneio} className="mt-4" size="sm">
                <Plus size={16} /> Criar primeiro romaneio
              </Btn>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {romaneios.map(rom => {
              const pecas = rom.pecas || []
              const etapas = {}
              pecas.forEach(p => { etapas[p.etapa] = (etapas[p.etapa] || 0) + 1 })
              return (
                <Card key={rom.id} className="hover:border-primary-300 transition-colors">
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => navigate(`/romaneio/${rom.id}`)}
                      >
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <ClipboardList size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <span className="font-semibold text-gray-900">{rom.codigo}</span>
                          <p className="text-sm text-gray-500">
                            {pecas.length} peça(s) — Criado em {new Date(rom.created_at).toLocaleDateString('pt-BR')}
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
                        <button
                          onClick={() => excluirRomaneio(rom.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer ml-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {rom.observacoes && (
                      <p className="text-xs text-gray-400 mt-2">{rom.observacoes}</p>
                    )}
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )
      )}

      {/* Modal de móvel */}
      <Modal open={movelModalOpen} onClose={() => setMovelModalOpen(false)} title={editingMovel ? 'Editar Móvel' : 'Novo Móvel'} size="lg">
        <form onSubmit={handleSaveMovel} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Input label="Código *" value={movelForm.codigo} onChange={e => setMovelForm({ ...movelForm, codigo: e.target.value })} placeholder="17.1" required />
            <Input label="Ambiente" value={movelForm.ambiente} onChange={e => setMovelForm({ ...movelForm, ambiente: e.target.value })} placeholder="Hall" />
            <Input label="Quantidade" type="number" min="1" value={movelForm.quantidade} onChange={e => setMovelForm({ ...movelForm, quantidade: e.target.value })} />
          </div>
          <Input label="Nome (curto) *" value={movelForm.nome} onChange={e => setMovelForm({ ...movelForm, nome: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={movelForm.descricao}
              onChange={e => setMovelForm({ ...movelForm, descricao: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Input label="Dimensões" value={movelForm.dimensoes} onChange={e => setMovelForm({ ...movelForm, dimensoes: e.target.value })} placeholder="4,45x2,80m" />
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
          <Input label="Projeto recebido" value={movelForm.projeto_recebido} onChange={e => setMovelForm({ ...movelForm, projeto_recebido: e.target.value })} />
          <Input label="Observações" value={movelForm.observacoes} onChange={e => setMovelForm({ ...movelForm, observacoes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setMovelModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit">{editingMovel ? 'Salvar' : 'Criar Móvel'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
