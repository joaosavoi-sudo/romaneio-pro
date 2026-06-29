import { useState, useEffect, useMemo } from 'react'
import { Wrench, Search, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  STATUS_ASSISTENCIA_MAP, assistenciaAtrasada, assistenciaEmAberto,
} from '../lib/assistencias'
import { fmtData } from '../lib/cronograma'
import { Btn, Card, CardBody, Select, Badge } from '../components/ui'
import ResponsavelInput from '../components/ResponsavelInput'
import AssistenciaFormModal from '../components/AssistenciaFormModal'

export default function Assistencias() {
  const [lista, setLista] = useState([])
  const [obrasAll, setObrasAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const [foco, setFoco] = useState('') // '' | abertas | atrasadas | cobrar
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [{ data: assist }, { data: obs }] = await Promise.all([
        supabase.from('assistencias').select('*, obras(id, codigo, cliente), moveis(codigo)').order('created_at', { ascending: false }),
        supabase.from('obras').select('id, codigo, cliente').order('codigo', { ascending: true }),
      ])
      setLista(assist || [])
      setObrasAll(obs || [])
    } finally {
      setLoading(false)
    }
  }

  function openEdit(a) { setEditing(a); setModalOpen(true) }

  const obras = useMemo(() => {
    const map = new Map()
    lista.forEach(a => { if (a.obras && !map.has(a.obras.id)) map.set(a.obras.id, a.obras) })
    return Array.from(map.values()).sort((x, y) => (x.codigo || '').localeCompare(y.codigo || ''))
  }, [lista])

  const cont = { abertas: 0, atrasadas: 0, cobrar: 0 }
  lista.forEach(a => {
    if (assistenciaEmAberto(a)) cont.abertas++
    if (assistenciaAtrasada(a)) cont.atrasadas++
    if (a.em_garantia === false && a.status !== 'cancelada') cont.cobrar++
  })

  const filtrados = useMemo(() => {
    return lista.filter(a => {
      if (foco === 'abertas' && !assistenciaEmAberto(a)) return false
      if (foco === 'atrasadas' && !assistenciaAtrasada(a)) return false
      if (foco === 'cobrar' && !(a.em_garantia === false && a.status !== 'cancelada')) return false
      if (filtroObra && a.obras?.id !== filtroObra) return false
      if (filtroResp && !(a.responsavel || '').toLowerCase().includes(filtroResp.toLowerCase())) return false
      if (busca) {
        const q = busca.toLowerCase()
        const campos = [a.titulo, a.descricao, a.responsavel, a.obras?.codigo, a.obras?.cliente]
        if (!campos.some(c => (c || '').toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [lista, foco, filtroObra, filtroResp, busca])

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench size={26} className="text-primary-600" /> Assistência Técnica
          </h2>
          <p className="text-sm text-gray-500">Chamados de pós-venda — inclusive de obras antigas não cadastradas.</p>
        </div>
        <Btn onClick={() => { setEditing(null); setModalOpen(true) }}><Plus size={16} /> Nova solicitação</Btn>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Chip cor="#f59e0b" label="Abertas" count={cont.abertas} ativo={foco === 'abertas'} onClick={() => setFoco(foco === 'abertas' ? '' : 'abertas')} />
        <Chip cor="#ef4444" label="Atrasadas" count={cont.atrasadas} ativo={foco === 'atrasadas'} onClick={() => setFoco(foco === 'atrasadas' ? '' : 'atrasadas')} />
        <Chip cor="#8b5cf6" label="A cobrar" count={cont.cobrar} ativo={foco === 'cobrar'} onClick={() => setFoco(foco === 'cobrar' ? '' : 'cobrar')} />
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar chamado, obra, cliente..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        </div>
        <div className="w-52">
          <Select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} placeholder="Todas as obras"
            options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))} />
        </div>
        <ResponsavelInput label="" value={filtroResp} onChange={e => setFiltroResp(e.target.value)} placeholder="Responsável..." className="w-44" />
        <span className="text-xs text-gray-500 ml-auto">{filtrados.length} de {lista.length}</span>
      </div>

      {lista.length === 0 ? (
        <Card><CardBody className="text-center py-12 text-gray-500">
          <Wrench size={48} className="mx-auto text-gray-300 mb-3" />Nenhum chamado de assistência ainda.
        </CardBody></Card>
      ) : filtrados.length === 0 ? (
        <Card><CardBody className="text-center py-8 text-gray-500">Nenhum chamado bate com os filtros.</CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2.5 font-medium">Obra</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 font-medium">Chamado</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Garantia</th>
                  <th className="px-3 py-2.5 font-medium">Responsável</th>
                  <th className="px-3 py-2.5 font-medium">Concluir até</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(a => {
                  const st = STATUS_ASSISTENCIA_MAP[a.status]
                  const atrasada = assistenciaAtrasada(a)
                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => openEdit(a)}>
                      <td className="px-3 py-2.5 font-mono font-medium text-gray-900 whitespace-nowrap">
                        {a.obras?.codigo || <Badge color="#6b7280">externa</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[150px] truncate" title={a.obras?.cliente || a.cliente_externo}>
                        {a.obras?.cliente || a.cliente_externo || '—'}
                        {!a.obras && a.obra_externa && <span className="text-xs text-gray-400"> · {a.obra_externa}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{a.moveis?.codigo || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[220px] truncate" title={a.titulo}>{a.titulo}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{st && <Badge color={st.cor}>{st.label}</Badge>}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {a.em_garantia
                          ? <span className="text-emerald-700">Garantia</span>
                          : <span className="text-red-600">A cobrar{a.valor_cobranca ? ` · R$ ${a.valor_cobranca}` : ''}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{a.responsavel || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={atrasada ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          {a.prazo_concluir ? fmtData(a.prazo_concluir) : '—'}{atrasada ? ' ⚠' : ''}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AssistenciaFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={loadData}
        editing={editing}
        obras={obrasAll}
      />
    </div>
  )
}

function Chip({ cor, label, count, ativo, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer ${ativo ? 'border-2 shadow-sm' : 'border border-gray-200 hover:border-gray-300'}`}
      style={ativo ? { borderColor: cor, backgroundColor: cor + '10' } : {}}>
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
      <span className="text-gray-700">{label}</span>
      <span className="font-semibold ml-auto" style={{ color: cor }}>{count}</span>
    </button>
  )
}
