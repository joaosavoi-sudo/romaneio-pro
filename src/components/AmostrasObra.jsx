import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Upload, Palette, MapPin, FlaskConical, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadAnexo, getSignedUrl, deleteAnexoStorage } from '../lib/storage'
import {
  TIPOS_AMOSTRA, TIPO_AMOSTRA_MAP, STATUS_AMOSTRA, STATUS_AMOSTRA_MAP,
  prazoPadrao, amostraAtrasada,
} from '../lib/amostras'
import { fmtData } from '../lib/cronograma'
import { Btn, Input, Select, Modal, Card, CardBody, Badge } from './ui'
import ResponsavelInput from './ResponsavelInput'

const EMPTY = {
  tipo: 'cor_laca', titulo: '', formula: '', solicitante: '', responsavel: '', prazo: '',
  localizacao_fisica: '', observacoes: '', status: 'solicitada', itemIds: [], fotos: [],
}

// Aba "Amostras" da obra. Props: obra, moveis (itens da obra), onChange (recarrega a obra).
export default function AmostrasObra({ obra, moveis = [], onChange }) {
  const [amostras, setAmostras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [salvando, setSalvando] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => { loadAmostras() }, [obra.id])
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [])

  async function loadAmostras() {
    try {
      const { data } = await supabase
        .from('amostras')
        .select('*, amostra_itens(movel_id)')
        .eq('obra_id', obra.id)
        .order('created_at', { ascending: false })
      setAmostras(data || [])
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, prazo: prazoPadrao('cor_laca'), solicitante: userEmail || '' })
    setModalOpen(true)
  }

  function openEdit(a) {
    setEditing(a)
    setForm({
      tipo: a.tipo || 'outro', titulo: a.titulo || '', formula: a.formula || '',
      solicitante: a.solicitante || '', responsavel: a.responsavel || '', prazo: a.prazo || '',
      localizacao_fisica: a.localizacao_fisica || '', observacoes: a.observacoes || '',
      status: a.status || 'solicitada',
      itemIds: (a.amostra_itens || []).map(x => x.movel_id),
      fotos: Array.isArray(a.fotos) ? a.fotos : [],
    })
    setModalOpen(true)
  }

  function setTipo(tipo) {
    // ao trocar o tipo, sugere o prazo padrão (só se ainda não personalizou muito)
    setForm(f => ({ ...f, tipo, prazo: editing ? f.prazo : prazoPadrao(tipo) }))
  }

  function toggleItem(id) {
    setForm(f => ({
      ...f,
      itemIds: f.itemIds.includes(id) ? f.itemIds.filter(x => x !== id) : [...f.itemIds, id],
    }))
  }

  async function handleFotos(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setSalvando(true)
    try {
      const novas = []
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) continue
        const meta = await uploadAnexo(obra.id, file)
        novas.push({ path: meta.storage_path, nome: file.name })
      }
      setForm(f => ({ ...f, fotos: [...f.fotos, ...novas] }))
    } finally {
      setSalvando(false)
      e.target.value = ''
    }
  }

  async function removerFoto(path) {
    await deleteAnexoStorage(path).catch(() => {})
    setForm(f => ({ ...f, fotos: f.fotos.filter(x => x.path !== path) }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)
    try {
      const payload = {
        obra_id: obra.id, tipo: form.tipo, titulo: form.titulo.trim(),
        formula: form.formula || null, solicitante: form.solicitante || null,
        responsavel: form.responsavel || null,
        prazo: form.prazo || null, localizacao_fisica: form.localizacao_fisica || null,
        observacoes: form.observacoes || null, status: form.status,
        fotos: form.fotos, updated_at: new Date().toISOString(),
      }
      let amostraId = editing?.id
      if (editing) {
        await supabase.from('amostras').update(payload).eq('id', editing.id)
      } else {
        const { data } = await supabase.from('amostras')
          .insert({ ...payload, criado_por: userEmail || null })
          .select('id').single()
        amostraId = data?.id
      }
      // sincroniza vínculo amostra ↔ itens
      if (amostraId) {
        await supabase.from('amostra_itens').delete().eq('amostra_id', amostraId)
        if (form.itemIds.length > 0) {
          await supabase.from('amostra_itens').insert(form.itemIds.map(movel_id => ({ amostra_id: amostraId, movel_id })))
        }
      }
      setModalOpen(false)
      setEditing(null)
      loadAmostras()
      onChange?.()
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(a, novo) {
    const upd = { status: novo, updated_at: new Date().toISOString() }
    const hoje = new Date().toISOString().substring(0, 10)
    if (novo === 'enviada' && !a.data_envio) upd.data_envio = hoje
    if (novo === 'aprovada' && !a.data_aprovacao) upd.data_aprovacao = hoje
    await supabase.from('amostras').update(upd).eq('id', a.id)
    loadAmostras()
    onChange?.()
  }

  async function excluir(a) {
    if (!confirm(`Excluir a amostra "${a.titulo}"?`)) return
    for (const f of (a.fotos || [])) await deleteAnexoStorage(f.path).catch(() => {})
    await supabase.from('amostras').delete().eq('id', a.id)
    loadAmostras()
    onChange?.()
  }

  function codigosItens(a) {
    const ids = (a.amostra_itens || []).map(x => x.movel_id)
    return moveis.filter(m => ids.includes(m.id)).map(m => m.codigo).join(', ')
  }

  if (loading) return <p className="text-center text-gray-500 py-8">Carregando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-500">{amostras.length} amostra(s)</p>
        <Btn onClick={openNew}><Plus size={16} /> Nova amostra</Btn>
      </div>

      {amostras.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <Palette size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Nenhuma amostra solicitada nesta obra.</p>
          <Btn onClick={openNew}><Plus size={16} /> Solicitar a primeira</Btn>
        </CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {amostras.map(a => {
            const tipo = TIPO_AMOSTRA_MAP[a.tipo]
            const atrasada = amostraAtrasada(a)
            const itens = codigosItens(a)
            return (
              <Card key={a.id}>
                <div className="flex">
                  <FotoThumb path={a.fotos?.[0]?.path} className="w-24 h-24 shrink-0 rounded-l-xl" />
                  <CardBody className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {tipo && <Badge color={tipo.cor}>{tipo.label}</Badge>}
                          <span className="font-medium text-gray-900 truncate">{a.titulo}</span>
                        </div>
                        {itens && <p className="text-xs text-blue-600 mt-0.5">📦 {itens}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(a)} className="p-1 text-gray-400 hover:text-primary-600 cursor-pointer"><Pencil size={14} /></button>
                        <button onClick={() => excluir(a)} className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {a.formula && <p className="text-xs text-gray-600 mt-1 flex items-start gap-1"><FlaskConical size={12} className="mt-0.5 shrink-0" /> {a.formula}</p>}
                    {a.localizacao_fisica && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin size={12} /> {a.localizacao_fisica}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <select
                        value={a.status}
                        onChange={e => mudarStatus(a, e.target.value)}
                        className="text-xs rounded border border-gray-200 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        style={{ color: STATUS_AMOSTRA_MAP[a.status]?.cor }}
                      >
                        {STATUS_AMOSTRA.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <span className={`text-xs ${atrasada ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {a.prazo ? `prazo ${fmtData(a.prazo)}${atrasada ? ' (vencido)' : ''}` : 'sem prazo'}
                      </span>
                      {a.responsavel && <span className="text-xs text-gray-400" title="Responsável (executa)">· resp: {a.responsavel}</span>}
                      {a.solicitante && <span className="text-xs text-gray-400" title="Solicitante (acompanha)">· sol: {a.solicitante}</span>}
                    </div>
                  </CardBody>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal nova/editar amostra */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar amostra' : 'Nova amostra'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select label="Tipo" value={form.tipo} onChange={e => setTipo(e.target.value)}
              options={TIPOS_AMOSTRA.map(t => ({ value: t.id, label: t.label }))} />
            <Input label="Prazo (SLA)" type="date" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} />
          </div>
          <Input label="Título *" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Laca branca acetinada" required />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Itens vinculados</label>
            {moveis.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Esta obra ainda não tem itens.</p>
            ) : (
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {moveis.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.itemIds.includes(m.id)} onChange={() => toggleItem(m.id)} className="w-4 h-4 cursor-pointer" />
                    <span className="font-mono text-xs text-gray-500">{m.codigo}</span>
                    <span className="text-gray-700 truncate">{m.descricao || m.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fórmula (código de tinta/tingimento)</label>
            <textarea value={form.formula} onChange={e => setForm({ ...form, formula: e.target.value })} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: Laca PU RAL 9003 + 3% preto · ou receita de tingimento" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ResponsavelInput label="Solicitante" value={form.solicitante} onChange={e => setForm({ ...form, solicitante: e.target.value })} placeholder="Quem pediu / acompanha" />
            <ResponsavelInput label="Responsável (executa · SLA)" value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} placeholder="Quem faz a amostra" />
          </div>
          <Input label="Localização física" value={form.localizacao_fisica} onChange={e => setForm({ ...form, localizacao_fisica: e.target.value })} placeholder="Onde a amostra fica guardada" />

          {editing && (
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={STATUS_AMOSTRA.map(s => ({ value: s.id, label: s.label }))} />
          )}

          {/* Fotos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fotos da amostra</label>
            <div className="flex items-center gap-2 flex-wrap">
              {form.fotos.map(f => (
                <div key={f.path} className="relative">
                  <FotoThumb path={f.path} className="w-16 h-16 rounded-lg border border-gray-200" />
                  <button type="button" onClick={() => removerFoto(f.path)} className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full p-0.5 text-gray-500 hover:text-red-600 cursor-pointer"><X size={12} /></button>
                </div>
              ))}
              <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-400 text-gray-400">
                <Upload size={18} />
                <input type="file" accept="image/*" multiple onChange={handleFotos} className="hidden" />
              </label>
            </div>
          </div>

          <Input label="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando || !form.titulo.trim()}>{salvando ? 'Salvando...' : (editing ? 'Salvar' : 'Criar amostra')}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Thumbnail de foto do storage (busca URL assinada).
export function FotoThumb({ path, className = '' }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let active = true
    if (path) getSignedUrl(path, 3600).then(u => { if (active) setUrl(u) })
    else setUrl(null)
    return () => { active = false }
  }, [path])
  return (
    <div className={`bg-gray-100 flex items-center justify-center overflow-hidden ${className}`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <Palette size={20} className="text-gray-300" />}
    </div>
  )
}
