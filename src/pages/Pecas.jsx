import { useState, useEffect } from 'react'
import { Search, Package, ChevronDown, RotateCcw } from 'lucide-react'
import { supabase, checarErros } from '../lib/supabase'
import { ETAPAS, MATERIAIS } from '../lib/constants'
import { Btn, Card, CardBody, Select, Modal, ErroCarga } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

const PAGE = 100
const ORIGENS_RETRABALHO = [
  { value: 'producao', label: 'Produção (fábrica)' },
  { value: 'montagem', label: 'Montagem (canteiro)' },
]

export default function Pecas() {
  const [pecas, setPecas] = useState([])
  const [total, setTotal] = useState(0)
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [erro, setErro] = useState(null)
  const [search, setSearch] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroMaterial, setFiltroMaterial] = useState('')

  // Registro de retrabalho (KPI do Modelo Ouro)
  const [retrabPeca, setRetrabPeca] = useState(null) // peça do modal
  const [retrabForm, setRetrabForm] = useState({ motivo: '', origem: 'producao', quantidade: 1 })
  const [retrabSalvando, setRetrabSalvando] = useState(false)
  const [retrabOk, setRetrabOk] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [])

  useEffect(() => { loadObras() }, [])

  // Filtros e busca são aplicados no servidor (lista paginada); busca com debounce
  useEffect(() => {
    const t = setTimeout(() => loadPecas(0), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtroEtapa, filtroObra, filtroMaterial])

  async function loadObras() {
    try {
      const res = await supabase.from('obras').select('id, codigo, cliente').order('codigo')
      checarErros(res)
      setObras(res.data || [])
    } catch (e) {
      setErro(e.message)
    }
  }

  async function loadPecas(offset) {
    setErro(null)
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      let q = supabase
        .from('pecas')
        .select(
          filtroObra
            ? '*, romaneios!inner(codigo, obras!inner(id, codigo, cliente))'
            : '*, romaneios(codigo, obras(id, codigo, cliente))',
          { count: 'exact' }
        )
      if (filtroObra) q = q.eq('romaneios.obras.id', filtroObra)
      if (filtroEtapa) q = q.eq('etapa', filtroEtapa)
      if (filtroMaterial) q = q.eq('material', filtroMaterial)
      const busca = search.trim().replace(/[%(),]/g, '')
      if (busca) q = q.or(`codigo.ilike.%${busca}%,nome.ilike.%${busca}%`)
      const res = await q.order('created_at', { ascending: false }).range(offset, offset + PAGE - 1)
      checarErros(res)
      setPecas(prev => (offset === 0 ? (res.data || []) : [...prev, ...(res.data || [])]))
      setTotal(res.count || 0)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function abrirRetrabalho(peca) {
    setRetrabForm({ motivo: '', origem: 'producao', quantidade: 1 })
    setRetrabOk('')
    setRetrabPeca(peca)
  }

  async function salvarRetrabalho(e) {
    e.preventDefault()
    if (!retrabPeca) return
    setRetrabSalvando(true)
    try {
      const res = await supabase.from('retrabalhos').insert({
        obra_id: retrabPeca.romaneios?.obras?.id || null,
        movel_id: retrabPeca.movel_id || null,
        peca_id: retrabPeca.id,
        quantidade: Math.max(1, parseInt(retrabForm.quantidade) || 1),
        motivo: retrabForm.motivo.trim() || null,
        origem: retrabForm.origem,
        registrado_por: userEmail || null,
      })
      checarErros(res)
      setRetrabOk(`Retrabalho da peça ${retrabPeca.codigo} registrado.`)
      setRetrabPeca(null)
    } catch (err) {
      alert('Erro ao registrar retrabalho: ' + err.message)
    } finally {
      setRetrabSalvando(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Peças</h2>
          <p className="text-sm text-gray-500">{pecas.length} de {total} peça(s)</p>
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
      {erro ? (
        <ErroCarga mensagem={erro} onRetry={() => loadPecas(0)} />
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : pecas.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma peça encontrada com os filtros selecionados</p>
          </CardBody>
        </Card>
      ) : (
        <>
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
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map(peca => (
                    <tr key={peca.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{peca.codigo}</td>
                      <td className="px-4 py-3 text-gray-700">{peca.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{peca.largura}×{peca.altura}×{peca.profundidade}</td>
                      <td className="px-4 py-3 text-gray-500">{peca.material}</td>
                      <td className="px-4 py-3 text-gray-500">{peca.romaneios?.obras?.cliente || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{peca.ambiente || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge etapa={peca.etapa} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirRetrabalho(peca)}
                          className="flex items-center gap-1 text-xs text-orange-600 hover:underline cursor-pointer"
                          title="Registrar retrabalho desta peça"
                        >
                          <RotateCcw size={13} /> Retrabalho
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {pecas.length < total && (
            <div className="text-center mt-4">
              <Btn variant="secondary" onClick={() => loadPecas(pecas.length)} disabled={loadingMore}>
                <ChevronDown size={16} /> {loadingMore ? 'Carregando...' : `Carregar mais (${total - pecas.length} restantes)`}
              </Btn>
            </div>
          )}
        </>
      )}

      {retrabOk && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          ✅ {retrabOk}
          <button onClick={() => setRetrabOk('')} className="ml-3 opacity-80 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* MODAL: registrar retrabalho */}
      <Modal open={!!retrabPeca} onClose={() => setRetrabPeca(null)} title={`Retrabalho — peça ${retrabPeca?.codigo || ''}`}>
        <form onSubmit={salvarRetrabalho} className="space-y-4">
          <p className="text-sm text-gray-600">
            {retrabPeca?.nome} · {retrabPeca?.romaneios?.obras?.cliente || 'sem obra'}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <textarea
              value={retrabForm.motivo}
              onChange={e => setRetrabForm(f => ({ ...f, motivo: e.target.value }))}
              rows={2}
              placeholder="Ex: risco na lâmina, medida errada, dano no transporte..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Onde foi detectado"
              value={retrabForm.origem}
              onChange={e => setRetrabForm(f => ({ ...f, origem: e.target.value }))}
              options={ORIGENS_RETRABALHO}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de peças</label>
              <input
                type="number" min="1" step="1"
                value={retrabForm.quantidade}
                onChange={e => setRetrabForm(f => ({ ...f, quantidade: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="secondary" onClick={() => setRetrabPeca(null)}>Cancelar</Btn>
            <Btn type="submit" disabled={retrabSalvando}>{retrabSalvando ? 'Salvando...' : 'Registrar retrabalho'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
