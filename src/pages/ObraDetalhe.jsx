import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ClipboardList, Package, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gerarCodigo } from '../lib/constants'
import { Btn, Card, CardBody, Badge } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

export default function ObraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [obra, setObra] = useState(null)
  const [romaneios, setRomaneios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const [obraRes, romRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('romaneios').select('*, pecas(id, etapa)').eq('obra_id', id).order('created_at', { ascending: false }),
    ])
    setObra(obraRes.data)
    setRomaneios(romRes.data || [])
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

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (!obra) return <p className="text-center text-red-500 py-12">Obra não encontrada</p>

  return (
    <div>
      <button onClick={() => navigate('/obras')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Voltar para Obras
      </button>

      <div className="flex items-start justify-between mb-6">
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
        <Btn onClick={criarRomaneio}>
          <Plus size={18} /> Novo Romaneio
        </Btn>
      </div>

      {romaneios.length === 0 ? (
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
                    <div className="flex items-center gap-2">
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
      )}
    </div>
  )
}
