import { useState, useEffect } from 'react'
import { Search, Package, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS, MATERIAIS } from '../lib/constants'
import { Card, CardBody, Select } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

export default function Pecas() {
  const [pecas, setPecas] = useState([])
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroMaterial, setFiltroMaterial] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [pecasRes, obrasRes] = await Promise.all([
      supabase.from('pecas').select('*, romaneios(codigo, obras(id, codigo, cliente))').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, codigo, cliente').order('codigo'),
    ])
    setPecas(pecasRes.data || [])
    setObras(obrasRes.data || [])
    setLoading(false)
  }

  const filtered = pecas.filter(p => {
    if (search && !p.codigo?.toLowerCase().includes(search.toLowerCase()) && !p.nome?.toLowerCase().includes(search.toLowerCase())) return false
    if (filtroEtapa && p.etapa !== filtroEtapa) return false
    if (filtroObra && p.romaneios?.obras?.id !== filtroObra) return false
    if (filtroMaterial && p.material !== filtroMaterial) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Peças</h2>
          <p className="text-sm text-gray-500">{pecas.length} peça(s) no total — {filtered.length} exibida(s)</p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar código ou nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Select
              value={filtroEtapa}
              onChange={e => setFiltroEtapa(e.target.value)}
              placeholder="Todas as etapas"
              options={ETAPAS.map(e => ({ value: e.id, label: e.label }))}
            />
            <Select
              value={filtroObra}
              onChange={e => setFiltroObra(e.target.value)}
              placeholder="Todas as obras"
              options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))}
            />
            <Select
              value={filtroMaterial}
              onChange={e => setFiltroMaterial(e.target.value)}
              placeholder="Todos os materiais"
              options={MATERIAIS.map(m => ({ value: m, label: m }))}
            />
          </div>
        </CardBody>
      </Card>

      {/* Tabela */}
      {loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma peça encontrada com os filtros selecionados</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Dimensões</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Material</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Obra</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ambiente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Etapa</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(peca => (
                  <tr key={peca.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{peca.codigo}</td>
                    <td className="px-4 py-3 text-gray-700">{peca.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{peca.largura}×{peca.altura}×{peca.profundidade}</td>
                    <td className="px-4 py-3 text-gray-500">{peca.material}</td>
                    <td className="px-4 py-3 text-gray-500">{peca.romaneios?.obras?.cliente || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{peca.ambiente || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge etapa={peca.etapa} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
