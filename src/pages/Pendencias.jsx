import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Search, Building2, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { diasAte } from '../lib/itemStatus'
import { TIPOS_PENDENCIA, TIPO_PENDENCIA_MAP, STATUS_PENDENCIA_MAP } from '../lib/templates'
import { Btn, Card, CardBody, Select, Badge } from '../components/ui'
import ResponsavelInput from '../components/ResponsavelInput'

export default function Pendencias() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pendencias, setPendencias] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [filtroFoco, setFiltroFoco] = useState(() => {
    const f = searchParams.get('foco')
    return ['vencidas', 'sem_prazo'].includes(f) ? f : ''
  })
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState({ campo: 'prazo', dir: 'asc' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase
      .from('pendencias')
      .select('*, obras(id, codigo, cliente, arquiteto, construtora), moveis(id, codigo, nome, descricao)')
      .eq('status', 'aberta')
      .order('created_at', { ascending: false })
    setPendencias(data || [])
    setLoading(false)
  }

  async function resolver(p, e) {
    e.stopPropagation()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('pendencias').update({
      status: 'resolvida',
      resolvida_em: new Date().toISOString(),
      resolvida_por: user?.email || null,
    }).eq('id', p.id)
    loadData()
  }

  const obras = useMemo(() => {
    const map = new Map()
    pendencias.forEach(p => {
      if (p.obras && !map.has(p.obras.id)) map.set(p.obras.id, p.obras)
    })
    return Array.from(map.values()).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
  }, [pendencias])

  // Classificação de prazo de cada pendência
  function focoDe(p) {
    if (!p.prazo) return 'sem_prazo'
    const d = diasAte(p.prazo)
    if (d !== null && d < 0) return 'vencidas'
    return 'no_prazo'
  }

  const cont = { vencidas: 0, sem_prazo: 0, no_prazo: 0 }
  pendencias.forEach(p => { cont[focoDe(p)]++ })

  const filtrados = useMemo(() => {
    let arr = pendencias.filter(p => {
      if (filtroObra && p.obras?.id !== filtroObra) return false
      if (filtroTipo && p.tipo !== filtroTipo) return false
      if (filtroFoco && focoDe(p) !== filtroFoco) return false
      if (filtroResp) {
        if (!(p.responsavel || '').toLowerCase().includes(filtroResp.toLowerCase())) return false
      }
      if (busca) {
        const q = busca.toLowerCase()
        const campos = [
          p.titulo, p.descricao, p.responsavel,
          p.obras?.codigo, p.obras?.cliente, p.moveis?.codigo,
        ].map(x => (x || '').toLowerCase())
        if (!campos.some(c => c.includes(q))) return false
      }
      return true
    })
    arr.sort((a, b) => {
      const va = getCampoOrdem(a, ordenacao.campo)
      const vb = getCampoOrdem(b, ordenacao.campo)
      const cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
      return ordenacao.dir === 'asc' ? cmp : -cmp
    })
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendencias, filtroObra, filtroTipo, filtroResp, filtroFoco, busca, ordenacao])

  function ordenarPor(campo) {
    setOrdenacao(prev => prev.campo === campo
      ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { campo, dir: 'asc' })
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle size={26} className="text-primary-600" /> Pendências
        </h2>
        <p className="text-sm text-gray-500">Todas as pendências em aberto, de todas as obras.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <FocoChip cor="#ef4444" label="Vencidas" count={cont.vencidas} ativo={filtroFoco === 'vencidas'} onClick={() => setFiltroFoco(filtroFoco === 'vencidas' ? '' : 'vencidas')} />
        <FocoChip cor="#f59e0b" label="Sem prazo" count={cont.sem_prazo} ativo={filtroFoco === 'sem_prazo'} onClick={() => setFiltroFoco(filtroFoco === 'sem_prazo' ? '' : 'sem_prazo')} />
        <FocoChip cor="#10b981" label="No prazo" count={cont.no_prazo} ativo={filtroFoco === 'no_prazo'} onClick={() => setFiltroFoco(filtroFoco === 'no_prazo' ? '' : 'no_prazo')} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar pendência, obra, responsável..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 w-72"
          />
        </div>
        <div className="w-56">
          <Select
            value={filtroObra}
            onChange={e => setFiltroObra(e.target.value)}
            placeholder="Todas as obras"
            options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))}
          />
        </div>
        <div className="w-48">
          <Select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            placeholder="Todos os tipos"
            options={TIPOS_PENDENCIA.map(t => ({ value: t.id, label: t.label }))}
          />
        </div>
        <ResponsavelInput
          label=""
          value={filtroResp}
          onChange={e => setFiltroResp(e.target.value)}
          placeholder="Responsável..."
          className="w-44"
        />
        {(filtroObra || filtroTipo || filtroResp || filtroFoco || busca) && (
          <button onClick={() => { setFiltroObra(''); setFiltroTipo(''); setFiltroResp(''); setFiltroFoco(''); setBusca('') }} className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer">
            Limpar filtros
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {filtrados.length} de {pendencias.length} pendência(s)
        </span>
      </div>

      {/* Tabela */}
      {pendencias.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <Check size={48} className="mx-auto text-emerald-300 mb-3" />
          <p className="text-gray-500">Nenhuma pendência em aberto. 🎉</p>
        </CardBody></Card>
      ) : filtrados.length === 0 ? (
        <Card><CardBody className="text-center py-8 text-gray-500">Nenhuma pendência bate com os filtros.</CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  <ThSort label="Obra" campo="obra_codigo" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Cliente" campo="obra_cliente" ordenacao={ordenacao} onClick={ordenarPor} />
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Item</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Pendência</th>
                  <ThSort label="Responsável" campo="responsavel" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Prazo" campo="prazo" ordenacao={ordenacao} onClick={ordenarPor} />
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const tipo = TIPO_PENDENCIA_MAP[p.tipo]
                  const dias = p.prazo ? diasAte(p.prazo) : null
                  const vencida = dias !== null && dias < 0
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/obras/${p.obras?.id}${p.movel_id ? `?item=${p.movel_id}` : ''}`)}
                    >
                      <td className="px-3 py-2.5 font-mono font-medium text-gray-900 whitespace-nowrap">{p.obras?.codigo || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[160px] truncate" title={p.obras?.cliente}>{p.obras?.cliente || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap font-mono text-xs">{p.moveis?.codigo || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap"><Badge color={tipo?.cor}>{tipo?.label || p.tipo}</Badge></td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[280px] truncate" title={p.titulo}>{p.titulo}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.responsavel || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {p.prazo ? (
                          <span className={vencida ? 'text-red-600 font-medium' : 'text-gray-500'}>
                            {new Date(p.prazo).toLocaleDateString('pt-BR')}
                            {vencida && <span className="text-xs"> ({Math.abs(dias)}d)</span>}
                          </span>
                        ) : <span className="text-amber-600 text-xs">sem prazo</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <button
                          onClick={e => resolver(p, e)}
                          title="Marcar como resolvida"
                          className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 cursor-pointer"
                        >
                          <Check size={13} /> Resolver
                        </button>
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

function getCampoOrdem(p, campo) {
  if (campo === 'obra_codigo') return p.obras?.codigo || ''
  if (campo === 'obra_cliente') return p.obras?.cliente || ''
  if (campo === 'prazo') return p.prazo || '9999-12-31' // sem prazo vai pro fim
  return p[campo] ?? ''
}

function ThSort({ label, campo, ordenacao, onClick }) {
  const ativo = ordenacao.campo === campo
  return (
    <th
      onClick={() => onClick(campo)}
      className="text-left px-3 py-2.5 font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
    >
      {label}{ativo && (ordenacao.dir === 'asc' ? ' ↑' : ' ↓')}
    </th>
  )
}

function FocoChip({ cor, label, count, ativo, onClick }) {
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
