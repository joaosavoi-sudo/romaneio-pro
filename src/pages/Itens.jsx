import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ListChecks, Search, Download, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SEMAFORO } from '../lib/constants'
import { calcularEtapaItem, calcularSemaforo } from '../lib/itemStatus'
import { Btn, Card, CardBody, Select } from '../components/ui'
import StatusBadge from '../components/StatusBadge'
import ResponsavelInput from '../components/ResponsavelInput'

export default function Itens() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [moveis, setMoveis] = useState([])
  const [pecasPorMovel, setPecasPorMovel] = useState({})
  const [pendenciasPorMovel, setPendenciasPorMovel] = useState({})
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroSemaforo, setFiltroSemaforo] = useState(() => {
    const s = searchParams.get('semaforo')
    return ['verde', 'amarelo', 'vermelho'].includes(s) ? s : ''
  })
  const [filtroResp, setFiltroResp] = useState('')
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState({ campo: 'codigo', dir: 'asc' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: movRes } = await supabase
      .from('moveis')
      .select('*, obras(id, codigo, cliente, arquiteto, construtora, status)')
      .order('codigo', { ascending: true })

    const { data: pecasRes } = await supabase
      .from('pecas')
      .select('id, etapa, movel_id')
      .not('movel_id', 'is', null)

    const { data: pendRes } = await supabase
      .from('pendencias')
      .select('id, status, prazo, movel_id')
      .not('movel_id', 'is', null)

    const idxPecas = {}
    ;(pecasRes || []).forEach(p => {
      if (!idxPecas[p.movel_id]) idxPecas[p.movel_id] = []
      idxPecas[p.movel_id].push(p)
    })

    const idxPend = {}
    ;(pendRes || []).forEach(p => {
      if (!idxPend[p.movel_id]) idxPend[p.movel_id] = []
      idxPend[p.movel_id].push(p)
    })

    setMoveis(movRes || [])
    setPecasPorMovel(idxPecas)
    setPendenciasPorMovel(idxPend)
    setLoading(false)
  }

  const obras = useMemo(() => {
    const map = new Map()
    moveis.forEach(m => {
      if (m.obras && !map.has(m.obras.id)) map.set(m.obras.id, m.obras)
    })
    return Array.from(map.values()).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
  }, [moveis])

  const filtrados = useMemo(() => {
    let arr = moveis.filter(m => {
      if (filtroObra && m.obras?.id !== filtroObra) return false
      if (filtroSemaforo) {
        const cor = calcularSemaforo(m, pendenciasPorMovel[m.id] || [])
        if (cor !== filtroSemaforo) return false
      }
      if (filtroResp) {
        const r = filtroResp.toLowerCase()
        if (!(m.responsavel || '').toLowerCase().includes(r)) return false
      }
      if (busca) {
        const q = busca.toLowerCase()
        const campos = [
          m.codigo, m.nome, m.ambiente, m.descricao,
          m.obras?.codigo, m.obras?.cliente, m.obras?.arquiteto,
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
  }, [moveis, pendenciasPorMovel, filtroObra, filtroSemaforo, filtroResp, busca, ordenacao])

  const cont = { verde: 0, amarelo: 0, vermelho: 0 }
  filtrados.forEach(m => {
    const cor = calcularSemaforo(m, pendenciasPorMovel[m.id] || [])
    cont[cor]++
  })

  function ordenarPor(campo) {
    setOrdenacao(prev => prev.campo === campo
      ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { campo, dir: 'asc' }
    )
  }

  function exportarCSV() {
    const colunas = [
      'GUIA', 'CLIENTE', 'ARQ./CONSTRUTORA', 'ITEM', 'AMBIENTE', 'DESCRIÇÃO',
      'INTERNO', 'EXTERIOR', 'INCLUÍDO', 'NÃO INCLUÍDO', 'QTDE',
      'RESPONSÁVEL', 'PREVISÃO ENTREGA', 'STATUS', 'SEMÁFORO', 'MOTIVO BLOQUEIO', 'OBSERVAÇÕES',
    ]
    const linhas = filtrados.map(m => {
      const etapa = calcularEtapaItem(m, pecasPorMovel[m.id] || [])
      const cor = calcularSemaforo(m, pendenciasPorMovel[m.id] || [])
      return [
        m.obras?.codigo, m.obras?.cliente,
        [m.obras?.arquiteto, m.obras?.construtora].filter(Boolean).join(' / '),
        m.codigo, m.ambiente, m.descricao || m.nome,
        m.acabamento_interno, m.acabamento_externo, m.incluido, m.nao_incluido, m.quantidade,
        m.responsavel, m.previsao_entrega, etapa.label, SEMAFORO[cor]?.label || cor,
        m.motivo_bloqueio, m.observacoes,
      ]
    })
    const csv = [colunas, ...linhas]
      .map(row => row.map(escaparCsv).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `controle-itens-${new Date().toISOString().substring(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks size={26} className="text-primary-600" /> Itens
          </h2>
          <p className="text-sm text-gray-500">Controle global de todos os itens de todas as obras.</p>
        </div>
        <Btn variant="secondary" onClick={exportarCSV} disabled={filtrados.length === 0}>
          <Download size={16} /> Exportar CSV
        </Btn>
      </div>

      {/* KPIs semáforo */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <SemaforoChip cor="#10b981" label="Verde" count={cont.verde} ativo={filtroSemaforo === 'verde'} onClick={() => setFiltroSemaforo(filtroSemaforo === 'verde' ? '' : 'verde')} />
        <SemaforoChip cor="#f59e0b" label="Amarelo" count={cont.amarelo} ativo={filtroSemaforo === 'amarelo'} onClick={() => setFiltroSemaforo(filtroSemaforo === 'amarelo' ? '' : 'amarelo')} />
        <SemaforoChip cor="#ef4444" label="Vermelho" count={cont.vermelho} ativo={filtroSemaforo === 'vermelho'} onClick={() => setFiltroSemaforo(filtroSemaforo === 'vermelho' ? '' : 'vermelho')} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar item, obra, cliente, arquiteto..."
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
        <ResponsavelInput
          label=""
          value={filtroResp}
          onChange={e => setFiltroResp(e.target.value)}
          placeholder="Responsável..."
          className="w-48"
        />
        {(filtroObra || filtroSemaforo || filtroResp || busca) && (
          <button onClick={() => { setFiltroObra(''); setFiltroSemaforo(''); setFiltroResp(''); setBusca('') }} className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer">
            Limpar filtros
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {filtrados.length} de {moveis.length} item(ns)
        </span>
      </div>

      {/* Tabela */}
      {moveis.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <Building2 size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhum item cadastrado em nenhuma obra ainda.</p>
        </CardBody></Card>
      ) : filtrados.length === 0 ? (
        <Card><CardBody className="text-center py-8 text-gray-500">Nenhum item bate com os filtros.</CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  <ThSort label="Guia" campo="obra_codigo" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Cliente" campo="obra_cliente" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Arq." campo="obra_arquiteto" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Item" campo="codigo" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Ambiente" campo="ambiente" ordenacao={ordenacao} onClick={ordenarPor} />
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Status</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Progresso</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Sem.</th>
                  <ThSort label="Responsável" campo="responsavel" ordenacao={ordenacao} onClick={ordenarPor} />
                  <ThSort label="Prev. entrega" campo="previsao_entrega" ordenacao={ordenacao} onClick={ordenarPor} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map(m => {
                  const etapa = calcularEtapaItem(m, pecasPorMovel[m.id] || [])
                  const cor = calcularSemaforo(m, pendenciasPorMovel[m.id] || [])
                  const semInfo = SEMAFORO[cor]
                  const pecasItem = pecasPorMovel[m.id] || []
                  const totPecas = pecasItem.length
                  const expedidas = pecasItem.filter(p => p.etapa === 'expedicao').length
                  const pctItem = totPecas > 0 ? Math.round((expedidas / totPecas) * 100) : null
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/obras/${m.obras?.id}?item=${m.id}`)}
                    >
                      <td className="px-3 py-2.5 font-mono font-medium text-gray-900 whitespace-nowrap">{m.obras?.codigo || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[180px] truncate" title={m.obras?.cliente}>{m.obras?.cliente || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={m.obras?.arquiteto}>{m.obras?.arquiteto || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-900 whitespace-nowrap">{m.codigo}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{m.ambiente || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[280px] truncate" title={m.descricao || m.nome}>{m.descricao || m.nome}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <StatusBadge label={etapa.label} cor={etapa.cor} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {pctItem === null ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-2" title={`${expedidas}/${totPecas} peças expedidas`}>
                            <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pctItem}%`, backgroundColor: pctItem === 100 ? '#10b981' : '#3b82f6' }} />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums">{pctItem}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-base" title={semInfo.label}>
                        {semInfo.label.split(' ')[0]}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{m.responsavel || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {m.previsao_entrega ? new Date(m.previsao_entrega).toLocaleDateString('pt-BR') : '—'}
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

function getCampoOrdem(m, campo) {
  if (campo === 'obra_codigo') return m.obras?.codigo || ''
  if (campo === 'obra_cliente') return m.obras?.cliente || ''
  if (campo === 'obra_arquiteto') return m.obras?.arquiteto || ''
  return m[campo] ?? ''
}

function escaparCsv(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
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
