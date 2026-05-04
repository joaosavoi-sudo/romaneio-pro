import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { OBRA_STATUS, gerarCodigo } from '../lib/constants'
import { Btn, Input, Select, Modal, Card, CardBody, Badge } from '../components/ui'

export default function Obras() {
  const [obras, setObras] = useState([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ cliente: '', endereco: '', arquiteto: '', status: 'ativa' })
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
      await supabase.from('obras').update(form).eq('id', editing.id)
    } else {
      const { count } = await supabase.from('obras').select('id', { count: 'exact', head: true })
      const codigo = gerarCodigo('OBR', (count || 0) + 1)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('obras').insert({ ...form, codigo, user_id: user.id })
    }
    setModalOpen(false)
    setEditing(null)
    setForm({ cliente: '', endereco: '', arquiteto: '', status: 'ativa' })
    loadObras()
  }

  function openEdit(obra) {
    setEditing(obra)
    setForm({ cliente: obra.cliente, endereco: obra.endereco || '', arquiteto: obra.arquiteto || '', status: obra.status })
    setModalOpen(true)
  }

  function openNew() {
    setEditing(null)
    setForm({ cliente: '', endereco: '', arquiteto: '', status: 'ativa' })
    setModalOpen(true)
  }

  const filtered = obras.filter(o =>
    o.cliente?.toLowerCase().includes(search.toLowerCase()) ||
    o.codigo?.toLowerCase().includes(search.toLowerCase())
  )

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
          <p className="text-sm text-gray-500">{obras.length} obra(s) cadastrada(s)</p>
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
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{obra.codigo}</span>
                        <Badge color={statusInfo?.cor}>{statusInfo?.label}</Badge>
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
