import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ClipboardList, Building2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gerarCodigo, ETAPAS } from '../lib/constants'
import { Btn, Card, CardBody, Modal, Select } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

export default function Romaneios() {
  const navigate = useNavigate()
  const [romaneios, setRomaneios] = useState([])
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroObra, setFiltroObra] = useState('')

  // Novo romaneio
  const [novoModalOpen, setNovoModalOpen] = useState(false)
  const [novoObraId, setNovoObraId] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [romsRes, obrasRes] = await Promise.all([
      supabase
        .from('romaneios')
        .select('*, obras(id, codigo, cliente), pecas(id, etapa)')
        .order('created_at', { ascending: false }),
      supabase.from('obras').select('id, codigo, cliente').order('codigo'),
    ])
    setRomaneios(romsRes.data || [])
    setObras(obrasRes.data || [])
    setLoading(false)
  }

  async function criarRomaneio(e) {
    e.preventDefault()
    if (!novoObraId) return
    setCriando(true)
    const { count } = await supabase.from('romaneios').select('id', { count: 'exact', head: true })
    const codigo = gerarCodigo('ROM', (count || 0) + 1)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('romaneios')
      .insert({ codigo, obra_id: novoObraId, user_id: user.id })
      .select()
      .single()
    setCriando(false)
    if (error) {
      alert('Erro ao criar romaneio: ' + error.message)
      return
    }
    setNovoModalOpen(false)
    setNovoObraId('')
    if (data) navigate(`/romaneio/${data.id}`)
  }

  const filtered = romaneios.filter(r => {
    if (filtroObra && r.obras?.id !== filtroObra) return false
    if (search) {
      const term = search.toLowerCase()
      if (
        !r.codigo?.toLowerCase().includes(term) &&
        !r.obras?.cliente?.toLowerCase().includes(term) &&
        !r.obras?.codigo?.toLowerCase().includes(term) &&
        !r.marceneiro?.toLowerCase().includes(term)
      ) return false
    }
    return true
  })

  function contarPorEtapa(pecas) {
    const counts = {}
    pecas?.forEach(p => { counts[p.etapa] = (counts[p.etapa] || 0) + 1 })
    return counts
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Romaneios</h2>
          <p className="text-sm text-gray-500">
            {romaneios.length} romaneio(s) — {filtered.length} exibido(s)
          </p>
        </div>
        <Btn onClick={() => setNovoModalOpen(true)} disabled={obras.length === 0}>
          <Plus size={18} /> Novo Romaneio
        </Btn>
      </div>

      {obras.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Nenhuma obra cadastrada. Crie uma obra primeiro em <button onClick={() => navigate('/obras')} className="underline cursor-pointer font-medium">Obras</button>.
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por código, cliente, marceneiro..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Select
              value={filtroObra}
              onChange={e => setFiltroObra(e.target.value)}
              placeholder="Todas as obras"
              options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))}
            />
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">Nenhum romaneio encontrado</p>
            {obras.length > 0 && (
              <Btn onClick={() => setNovoModalOpen(true)} size="sm">
                <Plus size={16} /> Criar primeiro romaneio
              </Btn>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Obra</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Marceneiro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Peças</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Distribuição</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Criado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rom => {
                  const counts = contarPorEtapa(rom.pecas)
                  const total = rom.pecas?.length || 0
                  return (
                    <tr
                      key={rom.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/romaneio/${rom.id}`)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{rom.codigo}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-gray-400" />
                          {rom.obras?.codigo || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{rom.obras?.cliente || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{rom.marceneiro || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{total}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ETAPAS.filter(e => counts[e.id]).map(e => (
                            <div key={e.id} className="flex items-center gap-1">
                              <StatusBadge etapa={e.id} />
                              <span className="text-xs text-gray-500">{counts[e.id]}</span>
                            </div>
                          ))}
                          {total === 0 && <span className="text-xs text-gray-400">vazio</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(rom.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={novoModalOpen} onClose={() => setNovoModalOpen(false)} title="Novo Romaneio">
        <form onSubmit={criarRomaneio} className="space-y-4">
          <Select
            label="Obra *"
            value={novoObraId}
            onChange={e => setNovoObraId(e.target.value)}
            placeholder="Selecione a obra..."
            options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))}
            required
          />
          <p className="text-xs text-gray-500">
            O romaneio será criado vinculado à obra escolhida. Você poderá adicionar peças e vinculá-las aos itens dessa obra.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setNovoModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={!novoObraId || criando}>
              {criando ? 'Criando...' : 'Criar Romaneio'}
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
