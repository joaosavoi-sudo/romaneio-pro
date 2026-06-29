import { useState, useEffect } from 'react'
import { Upload, X, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadAnexo, deleteAnexoStorage } from '../lib/storage'
import { STATUS_ASSISTENCIA, prazoAgendarPadrao, prazoConcluirPadrao } from '../lib/assistencias'
import { Btn, Input, Select, Modal } from './ui'
import ResponsavelInput from './ResponsavelInput'
import { FotoThumb } from './AmostrasObra'

const EMPTY = {
  obra_id: '', externa: false, cliente_externo: '', obra_externa: '', contato: '',
  movel_id: '', titulo: '', descricao: '', em_garantia: true, valor_cobranca: '',
  responsavel: '', prazo_agendar: '', prazo_concluir: '', status: 'aberta',
  data_agendada: '', data_conclusao: '', resolucao: '', fotos: [],
}

// Modal reutilizável de assistência (criar/editar).
// Props:
//   - open, onClose, onSaved
//   - editing: registro de assistência ou null
//   - obraFixa: obra { id } quando aberto de dentro de uma obra (sem seletor)
//   - obras: lista [{id, codigo, cliente}] quando aberto do painel global (com seletor + opção externa)
export default function AssistenciaFormModal({ open, onClose, onSaved, editing, obraFixa, obras }) {
  const [form, setForm] = useState({ ...EMPTY })
  const [moveis, setMoveis] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const podeEscolherObra = !obraFixa

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        obra_id: editing.obra_id || '', externa: !editing.obra_id,
        cliente_externo: editing.cliente_externo || '', obra_externa: editing.obra_externa || '', contato: editing.contato || '',
        movel_id: editing.movel_id || '', titulo: editing.titulo || '', descricao: editing.descricao || '',
        em_garantia: editing.em_garantia !== false, valor_cobranca: editing.valor_cobranca ?? '',
        responsavel: editing.responsavel || '', prazo_agendar: editing.prazo_agendar || '', prazo_concluir: editing.prazo_concluir || '',
        status: editing.status || 'aberta', data_agendada: editing.data_agendada || '', data_conclusao: editing.data_conclusao || '',
        resolucao: editing.resolucao || '', fotos: Array.isArray(editing.fotos) ? editing.fotos : [],
      })
    } else {
      setForm({ ...EMPTY, obra_id: obraFixa?.id || '', prazo_agendar: prazoAgendarPadrao(), prazo_concluir: prazoConcluirPadrao() })
    }
  }, [open, editing, obraFixa])

  // Itens da obra selecionada/fixa (para o dropdown de item)
  const obraIdAtual = obraFixa?.id || (form.externa ? '' : form.obra_id)
  useEffect(() => {
    if (obraIdAtual) {
      supabase.from('moveis').select('id, codigo, nome, descricao').eq('obra_id', obraIdAtual).order('codigo')
        .then(({ data }) => setMoveis(data || []))
    } else {
      setMoveis([])
    }
  }, [obraIdAtual])

  function setObraSel(val) {
    if (val === '__externa__') setForm(f => ({ ...f, externa: true, obra_id: '', movel_id: '' }))
    else setForm(f => ({ ...f, externa: false, obra_id: val, movel_id: '' }))
  }

  async function handleFotos(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setSalvando(true)
    try {
      const novas = []
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) continue
        const meta = await uploadAnexo(obraIdAtual || 'externas', file)
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

  const faltaObra = podeEscolherObra && !form.externa && !form.obra_id
  const faltaCliente = form.externa && !form.cliente_externo.trim()
  const invalido = !form.titulo.trim() || faltaObra || faltaCliente

  async function handleSave(e) {
    e.preventDefault()
    if (invalido) return
    setSalvando(true)
    try {
      const payload = {
        obra_id: form.externa ? null : (obraFixa?.id || form.obra_id),
        cliente_externo: form.externa ? (form.cliente_externo.trim() || null) : null,
        obra_externa: form.externa ? (form.obra_externa || null) : null,
        contato: form.externa ? (form.contato || null) : null,
        movel_id: form.movel_id || null,
        titulo: form.titulo.trim(), descricao: form.descricao || null,
        em_garantia: form.em_garantia, valor_cobranca: form.em_garantia ? null : (parseFloat(form.valor_cobranca) || null),
        responsavel: form.responsavel || null,
        prazo_agendar: form.prazo_agendar || null, prazo_concluir: form.prazo_concluir || null,
        status: form.status, data_agendada: form.data_agendada || null, data_conclusao: form.data_conclusao || null,
        resolucao: form.resolucao || null, fotos: form.fotos, updated_at: new Date().toISOString(),
      }
      if (editing) await supabase.from('assistencias').update(payload).eq('id', editing.id)
      else await supabase.from('assistencias').insert({ ...payload, solicitante: userEmail || null })
      onClose()
      onSaved?.()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar assistência' : 'Nova solicitação de assistência'}>
      <form onSubmit={handleSave} className="space-y-3">
        {/* Seleção de obra (só no painel global) */}
        {podeEscolherObra && (
          <div>
            <Select
              label="Obra"
              value={form.externa ? '__externa__' : form.obra_id}
              onChange={e => setObraSel(e.target.value)}
              placeholder="Selecione a obra"
              options={[
                ...(obras || []).map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` })),
                { value: '__externa__', label: '➕ Obra não cadastrada (externa)' },
              ]}
            />
            {form.externa && (
              <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-100 space-y-2">
                <p className="text-xs text-amber-800 flex items-center gap-1"><Building2 size={12} /> Obra antiga não cadastrada — informe os dados do cliente.</p>
                <Input label="Cliente *" value={form.cliente_externo} onChange={e => setForm({ ...form, cliente_externo: e.target.value })} placeholder="Nome do cliente" required />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Obra / referência" value={form.obra_externa} onChange={e => setForm({ ...form, obra_externa: e.target.value })} placeholder="Código antigo, endereço..." />
                  <Input label="Contato" value={form.contato} onChange={e => setForm({ ...form, contato: e.target.value })} placeholder="Telefone / quem agendar" />
                </div>
              </div>
            )}
          </div>
        )}

        <Input label="Título *" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Porta da cozinha desregulada" required />

        {/* Item: só quando há obra cadastrada com itens */}
        {!form.externa && moveis.length > 0 && (
          <Select label="Item (opcional)" value={form.movel_id} onChange={e => setForm({ ...form, movel_id: e.target.value })}
            placeholder="— obra toda / não especificado —"
            options={moveis.map(m => ({ value: m.id, label: `${m.codigo} — ${m.descricao || m.nome}` }))} />
        )}

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
          <Btn type="button" variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={salvando || invalido}>{salvando ? 'Salvando...' : (editing ? 'Salvar' : 'Abrir chamado')}</Btn>
        </div>
      </form>
    </Modal>
  )
}
