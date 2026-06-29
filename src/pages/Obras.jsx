import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { OBRA_STATUS, gerarCodigo } from '../lib/constants'
import { OBRA_ETAPA_MAP, etapaAtual } from '../lib/processo'
import { Btn, Input, Select, Modal, Card, CardBody, Badge } from '../components/ui'

export default function Obras() {
  const [obras, setObras] = useState([])
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativa') // '' = todas
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ codigo: '', cliente: '', endereco: '', arquiteto: '', status: 'ativa' })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadObras() }, [])

  async function loadObras() {
    const { data } = await supabase
      .from('obras')
      .select('*, romaneios(id), pecas:romaneios(pecas(id))')
      .order('created_at', { ascending: false })
    setObras(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (editing) {
      const { codigo, ...rest } = form
      const update = codigo?.trim() ? { ...rest, codigo: codigo.trim() } : rest
      await supabase.from('obras').update(update).eq('id', editing.id)
    } else {
      let codigo = form.codigo?.trim()
      if (!codigo) {
        const { count } = await supabase.from('obras').select('id', { count: 'exact', head: true })
        codigo = gerarCodigo('OBR', (count || 0) + 1)
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { codigo: _, ...rest } = form
      await supabase.from('obras').insert({ ...rest, codigo, user_id: user.id })
    }
    setModalOpen(false)
    setEditing(null)
    setForm({ codigo: '', cliente: '', endereco: '', arquiteto: '', status: 'ativa' })
    loadObras()
  }

  function openEdit(obra) {
    setEditing(obra)
    setForm({
      codigo: obra.codigo || '',
      cliente: obra.cliente,
      endereco: obra.endereco || '',
      arquiteto: obra.arquiteto || '',
      status: obra.status,
    })
    setModalOpen(true)
  }

  function openNew() {
    setEditing(null)
    setForm({ codigo: '', cliente: '', endereco: '', arquiteto: '', status: 'ativa' })
    setModalOpen(true)
  }

  const filtered = obras.filter(o => {
    if (filtroStatus && o.status !== filtroStatus) return false
    const q = search.toLowerCase()
    return (o.cliente?.toLowerCase().includes(q) || o.codigo?.toLowerCase().includes(q))
  })

  const statusCounts = obras.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  function countPecas(obra) {
    let total = 0
    obra.pecas?.forEach(r => { total += r.pecas?.length || 0 })
    return total
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Obras</h2>
          <p className="text-sm text-gray-500">{filtered.length} de {obras.length} obra(s)</p>
        </div>
        <Btn onClick={openNew}>
          <Plus size={18} /> Nova Obra
        </Btn>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <StatusTab label="Ativas" count={statusCounts.ativa || 0} ativo={filtroStatus === 'ativa'} onClick={() => setFiltroStatus('ativa')} />
          <StatusTab label="Concluídas" count={statusCounts.concluida || 0} ativo={filtroStatus === 'concluida'} onClick={() => setFiltroStatus('concluida')} />
          <StatusTab label="Canceladas" count={statusCounts.cancelada || 0} ativo={filtroStatus === 'cancelada'} onClick={() => setFiltroStatus('cancelada')} />
          <StatusTab label="Todas" count={obras.length} ativo={filtroStatus === ''} onClick={() => setFiltroStatus('')} />
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma obra encontrada</p>
            <Btn onClick={openNew} className="mt-4" size="sm">
              <Plus size={16} /> Criar primeira obra
            </Btn>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(obra => {
            const statusInfo = OBRA_STATUS.find(s => s.id === obra.status)
            const etapaInf = OBRA_ETAPA_MAP[etapaAtual(obra)]
            return (
              <Card
                key={obra.id}
                className="hover:border-primary-300 transition-colors cursor-pointer"
                onClick={() => navigate(`/obras/${obra.id}`)}
              >
                <CardBody className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary-50 rounded-lg">
                      <Building2 size={20} className="text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{obra.codigo}</span>
                        <Badge color={statusInfo?.cor}>{statusInfo?.label}</Badge>
                        {obra.status === 'ativa' && etapaInf && <Badge color={etapaInf.cor}>{etapaInf.label}</Badge>}
                      </div>
                      <p className="text-sm text-gray-600">{obra.cliente}</p>
                      {obra.endereco && <p className="text-xs text-gray-400">{obra.endereco}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-gray-500">{obra.romaneios?.length || 0} romaneio(s)</p>
                      <p className="text-gray-400">{countPecas(obra)} peça(s)</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(obra) }}
                      className="text-xs text-primary-600 hover:underline cursor-pointer"
                    >
                      Editar
                    </button>
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Obra' : 'Nova Obra'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Código (deixe em branco para gerar OBR-XXX)"
            id="codigo"
            value={form.codigo}
            onChange={e => setForm({ ...form, codigo: e.target.value })}
            placeholder="Ex: 695-2025 ou OBR-001 (auto)"
          />
          <Input label="Cliente *" id="cliente" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} required />
          <Input label="Endereço" id="endereco" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
          <Input label="Arquiteto" id="arquiteto" value={form.arquiteto} onChange={e => setForm({ ...form, arquiteto: e.target.value })} />
          <Select
            label="Status"
            id="status"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
            options={OBRA_STATUS.map(s => ({ value: s.id, label: s.label }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit">{editing ? 'Salvar' : 'Criar Obra'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function StatusTab({ label, count, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
        ativo
          ? 'bg-primary-50 border-primary-300 text-primary-700'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label} <span className={ativo ? 'text-primary-500' : 'text-gray-400'}>({count})</span>
    </button>
  )
}
