import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Palette, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  TIPOS_AMOSTRA, TIPO_AMOSTRA_MAP, STATUS_AMOSTRA, STATUS_AMOSTRA_MAP,
  amostraAtrasada, amostraEmAberto,
} from '../lib/amostras'
import { fmtData } from '../lib/cronograma'
import { Card, CardBody, Select, Badge } from '../components/ui'
import ResponsavelInput from '../components/ResponsavelInput'

export default function Amostras() {
  const navigate = useNavigate()
  const [amostras, setAmostras] = useState([])
  const [loading, setLoading] = useState(true)

  const [foco, setFoco] = useState('') // '' | aberto | vencidas | aprovadas
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data } = await supabase
        .from('amostras')
        .select('*, obras(id, codigo, cliente), amostra_itens(moveis(codigo))')
        .order('created_at', { ascending: false })
      setAmostras(data || [])
    } finally {
      setLoading(false)
    }
  }

  const obras = useMemo(() => {
    const map = new Map()
    amostras.forEach(a => { if (a.obras && !map.has(a.obras.id)) map.set(a.obras.id, a.obras) })
    return Array.from(map.values()).sort((x, y) => (x.codigo || '').localeCompare(y.codigo || ''))
  }, [amostras])

  const cont = { aberto: 0, vencidas: 0, aprovadas: 0 }
  amostras.forEach(a => {
    if (amostraEmAberto(a)) cont.aberto++
    if (amostraAtrasada(a)) cont.vencidas++
    if (a.status === 'aprovada') cont.aprovadas++
  })

  const filtrados = useMemo(() => {
    return amostras.filter(a => {
      if (foco === 'aberto' && !amostraEmAberto(a)) return false
      if (foco === 'vencidas' && !amostraAtrasada(a)) return false
      if (foco === 'aprovadas' && a.status !== 'aprovada') return false
      if (filtroObra && a.obras?.id !== filtroObra) return false
      if (filtroTipo && a.tipo !== filtroTipo) return false
      if (filtroResp && !(a.responsavel || '').toLowerCase().includes(filtroResp.toLowerCase())) return false
      if (busca) {
        const q = busca.toLowerCase()
        const campos = [a.titulo, a.formula, a.responsavel, a.localizacao_fisica, a.obras?.codigo, a.obras?.cliente]
        if (!campos.some(c => (c || '').toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [amostras, foco, filtroObra, filtroTipo, filtroResp, busca])

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Palette size={26} className="text-primary-600" /> Amostras
        </h2>
        <p className="text-sm text-gray-500">Cor/laca, lâmina, madeira e protótipos — de todas as obras.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Chip cor="#3b82f6" label="Em aberto" count={cont.aberto} ativo={foco === 'aberto'} onClick={() => setFoco(foco === 'aberto' ? '' : 'aberto')} />
        <Chip cor="#ef4444" label="Vencidas" count={cont.vencidas} ativo={foco === 'vencidas'} onClick={() => setFoco(foco === 'vencidas' ? '' : 'vencidas')} />
        <Chip cor="#10b981" label="Aprovadas" count={cont.aprovadas} ativo={foco === 'aprovadas'} onClick={() => setFoco(foco === 'aprovadas' ? '' : 'aprovadas')} />
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar amostra, fórmula, obra..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        </div>
        <div className="w-52">
          <Select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} placeholder="Todas as obras"
            options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))} />
        </div>
        <div className="w-44">
          <Select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} placeholder="Todos os tipos"
            options={TIPOS_AMOSTRA.map(t => ({ value: t.id, label: t.label }))} />
        </div>
        <ResponsavelInput label="" value={filtroResp} onChange={e => setFiltroResp(e.target.value)} placeholder="Responsável..." className="w-44" />
        <span className="text-xs text-gray-500 ml-auto">{filtrados.length} de {amostras.length}</span>
      </div>

      {amostras.length === 0 ? (
        <Card><CardBody className="text-center py-12 text-gray-500">
          <Palette size={48} className="mx-auto text-gray-300 mb-3" />Nenhuma amostra cadastrada ainda.
        </CardBody></Card>
      ) : filtrados.length === 0 ? (
        <Card><CardBody className="text-center py-8 text-gray-500">Nenhuma amostra bate com os filtros.</CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2.5 font-medium">Obra</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Título</th>
                  <th className="px-3 py-2.5 font-medium">Itens</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Responsável</th>
                  <th className="px-3 py-2.5 font-medium">Solicitante</th>
                  <th className="px-3 py-2.5 font-medium">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(a => {
                  const tipo = TIPO_AMOSTRA_MAP[a.tipo]
                  const st = STATUS_AMOSTRA_MAP[a.status]
                  const atrasada = amostraAtrasada(a)
                  const itens = (a.amostra_itens || []).map(x => x.moveis?.codigo).filter(Boolean).join(', ')
                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/obras/${a.obras?.id}?tab=amostras`)}>
                      <td className="px-3 py-2.5 font-mono font-medium text-gray-900 whitespace-nowrap">{a.obras?.codigo || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{tipo && <Badge color={tipo.cor}>{tipo.label}</Badge>}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[220px] truncate" title={a.titulo}>{a.titulo}</td>
                      <td className="px-3 py-2.5 text-gray-500 font-mono text-xs max-w-[120px] truncate" title={itens}>{itens || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{st && <Badge color={st.cor}>{st.label}</Badge>}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{a.responsavel || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{a.solicitante || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={atrasada ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          {a.prazo ? fmtData(a.prazo) : '—'}{atrasada ? ' ⚠' : ''}
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
