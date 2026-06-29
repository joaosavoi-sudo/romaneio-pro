import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Upload, Wrench, X, ShieldCheck, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadAnexo, deleteAnexoStorage } from '../lib/storage'
import {
  STATUS_ASSISTENCIA, STATUS_ASSISTENCIA_MAP, prazoAgendarPadrao, prazoConcluirPadrao,
  assistenciaAtrasada,
} from '../lib/assistencias'
import { fmtData } from '../lib/cronograma'
import { Btn, Input, Select, Modal, Card, CardBody, Badge } from './ui'
import ResponsavelInput from './ResponsavelInput'
import { FotoThumb } from './AmostrasObra'

const EMPTY = {
  movel_id: '', titulo: '', descricao: '', em_garantia: true, valor_cobranca: '',
  responsavel: '', prazo_agendar: '', prazo_concluir: '', status: 'aberta',
  data_agendada: '', data_conclusao: '', resolucao: '', fotos: [],
}

// Aba "Assistência" da obra. Props: obra, moveis, onChange.
export default function AssistenciaObra({ obra, moveis = [], onChange }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [salvando, setSalvando] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => { loadData() }, [obra.id])
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [])

  async function loadData() {
    try {
      const { data } = await supabase
        .from('assistencias')
        .select('*, moveis(codigo, nome)')
        .eq('obra_id', obra.id)
        .order('created_at', { ascending: false })
      setLista(data || [])
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, prazo_agendar: prazoAgendarPadrao(), prazo_concluir: prazoConcluirPadrao() })
    setModalOpen(true)
  }

  function openEdit(a) {
    setEditing(a)
    setForm({
      movel_id: a.movel_id || '', titulo: a.titulo || '', descricao: a.descricao || '',
      em_garantia: a.em_garantia !== false, valor_cobranca: a.valor_cobranca ?? '',
      responsavel: a.responsavel || '', prazo_agendar: a.prazo_agendar || '',
      prazo_concluir: a.prazo_concluir || '', status: a.status || 'aberta',
      data_agendada: a.data_agendada || '', data_conclusao: a.data_conclusao || '',
      resolucao: a.resolucao || '', fotos: Array.isArray(a.fotos) ? a.fotos : [],
    })
    setModalOpen(true)
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
        obra_id: obra.id, movel_id: form.movel_id || null, titulo: form.titulo.trim(),
        descricao: form.descricao || null, em_garantia: form.em_garantia,
        valor_cobranca: form.em_garantia ? null : (parseFloat(form.valor_cobranca) || null),
        responsavel: form.responsavel || null, prazo_agendar: form.prazo_agendar || null,
        prazo_concluir: form.prazo_concluir || null, status: form.status,
        data_agendada: form.data_agendada || null, data_conclusao: form.data_conclusao || null,
        resolucao: form.resolucao || null, fotos: form.fotos, updated_at: new Date().toISOString(),
      }
      if (editing) {
        await supabase.from('assistencias').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('assistencias').insert({ ...payload, solicitante: userEmail || null })
      }
      setModalOpen(false)
      setEditing(null)
      loadData()
      onChange?.()
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(a, novo) {
    const upd = { status: novo, updated_at: new Date().toISOString() }
    const hoje = new Date().toISOString().substring(0, 10)
    if (novo === 'agendada' && !a.data_agendada) upd.data_agendada = hoje
    if (novo === 'concluida' && !a.data_conclusao) upd.data_conclusao = hoje
    await supabase.from('assistencias').update(upd).eq('id', a.id)
    loadData()
    onChange?.()
  }

  async function excluir(a) {
    if (!confirm(`Excluir a assistência "${a.titulo}"?`)) return
    for (const f of (a.fotos || [])) await deleteAnexoStorage(f.path).catch(() => {})
    await supabase.from('assistencias').delete().eq('id', a.id)
    loadData()
    onChange?.()
  }

  if (loading) return <p className="text-center text-gray-500 py-8">Carregando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-500">{lista.length} chamado(s)</p>
        <Btn onClick={openNew}><Plus size={16} /> Nova solicitação</Btn>
      </div>

      {lista.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <Wrench size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Nenhuma assistência aberta para esta obra.</p>
          <Btn onClick={openNew}><Plus size={16} /> Abrir solicitação</Btn>
        </CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.map(a => {
            const st = STATUS_ASSISTENCIA_MAP[a.status]
            const atrasada = assistenciaAtrasada(a)
            return (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{a.titulo}</span>
                        {a.em_garantia
                          ? <Badge color="#10b981"><ShieldCheck size={11} className="inline" /> garantia</Badge>
                          : <Badge color="#ef4444"><ShieldAlert size={11} className="inline" /> a cobrar{a.valor_cobranca ? ` R$ ${a.valor_cobranca}` : ''}</Badge>}
                      </div>
                      {a.moveis && <p className="text-xs text-blue-600 mt-0.5">📦 {a.moveis.codigo} — {a.moveis.nome}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(a)} className="p-1 text-gray-400 hover:text-primary-600 cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => excluir(a)} className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {a.descricao && <p className="text-sm text-gray-600 mt-1">{a.descricao}</p>}
                  {a.fotos?.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {a.fotos.map(f => <FotoThumb key={f.path} path={f.path} className="w-12 h-12 rounded-md border border-gray-200" />)}
                    </div>
                  )}
                  {a.resolucao && <p className="text-xs text-emerald-700 mt-1 bg-emerald-50 rounded px-2 py-1">✓ {a.resolucao}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <select value={a.status} onChange={e => mudarStatus(a, e.target.value)}
                      className="text-xs rounded border border-gray-200 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      style={{ color: st?.cor }}>
                      {STATUS_ASSISTENCIA.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    {a.prazo_concluir && (
                      <span className={`text-xs ${atrasada ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        concluir até {fmtData(a.prazo_concluir)}{atrasada ? ' ⚠' : ''}
                      </span>
                    )}
                    {a.responsavel && <span className="text-xs text-gray-400">· {a.responsavel}</span>}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal nova/editar assistência */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar assistência' : 'Nova solicitação de assistência'}>
        <form onSubmit={handleSave} className="space-y-3">
          <Input label="Título *" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Porta da cozinha desregulada" required />
          <Select label="Item (opcional)" value={form.movel_id} onChange={e => setForm({ ...form, movel_id: e.target.value })}
            placeholder="— obra toda / não especificado —"
            options={moveis.map(m => ({ value: m.id, label: `${m.codigo} — ${m.descricao || m.nome}` }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Demanda (o que o cliente relatou)</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Descreva o problema relatado pelo cliente." />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.em_garantia} onChange={e => setForm({ ...form, em_garantia: e.target.checked })} className="w-4 h-4 cursor-pointer" />
              Em garantia
            </label>
            {!form.em_garantia && (
              <Input label="Valor a cobrar (R$)" type="number" min="0" step="0.01" value={form.valor_cobranca}
                onChange={e => setForm({ ...form, valor_cobranca: e.target.value })} className="w-40" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ResponsavelInput value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} placeholder="Quem vai atender" />
            <Input label="Prazo p/ agendar" type="date" value={form.prazo_agendar} onChange={e => setForm({ ...form, prazo_agendar: e.target.value })} />
          </div>
          <Input label="Prazo p/ concluir" type="date" value={form.prazo_concluir} onChange={e => setForm({ ...form, prazo_concluir: e.target.value })} />

          {editing && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                options={STATUS_ASSISTENCIA.map(s => ({ value: s.id, label: s.label }))} />
              <Input label="Data agendada" type="date" value={form.data_agendada} onChange={e => setForm({ ...form, data_agendada: e.target.value })} />
              <Input label="Data conclusão" type="date" value={form.data_conclusao} onChange={e => setForm({ ...form, data_conclusao: e.target.value })} />
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolução (o que foi feito)</label>
                <textarea value={form.resolucao} onChange={e => setForm({ ...form, resolucao: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          )}

          {/* Fotos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fotos</label>
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

          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando || !form.titulo.trim()}>{salvando ? 'Salvando...' : (editing ? 'Salvar' : 'Abrir chamado')}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
