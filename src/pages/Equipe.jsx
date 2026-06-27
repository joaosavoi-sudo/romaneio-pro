import { useState, useEffect } from 'react'
import { Users, Plus, Pencil, Power } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PAPEIS_EQUIPE, PAPEL_EQUIPE_MAP } from '../lib/constants'
import { Btn, Input, Select, Modal, Card, CardBody, Badge } from '../components/ui'

const EMPTY = { nome: '', papel: 'producao', ativo: true }

export default function Equipe() {
  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [mostrarInativos, setMostrarInativos] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('equipe').select('*').order('nome', { ascending: true })
    setMembros(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY })
    setModalOpen(true)
  }

  function openEdit(m) {
    setEditing(m)
    setForm({ nome: m.nome, papel: m.papel || 'outro', ativo: m.ativo })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const payload = { nome: form.nome.trim(), papel: form.papel, ativo: form.ativo }
    if (editing) {
      await supabase.from('equipe').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('equipe').insert(payload)
    }
    setModalOpen(false)
    setEditing(null)
    setForm({ ...EMPTY })
    loadData()
  }

  async function toggleAtivo(m) {
    await supabase.from('equipe').update({ ativo: !m.ativo }).eq('id', m.id)
    loadData()
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>

  const visiveis = mostrarInativos ? membros : membros.filter(m => m.ativo)

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={26} className="text-primary-600" /> Equipe
          </h2>
          <p className="text-sm text-gray-500">Pessoas que aparecem como responsáveis em itens, pendências e romaneios.</p>
        </div>
        <Btn onClick={openNew}><Plus size={16} /> Nova pessoa</Btn>
      </div>

      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} className="w-4 h-4 cursor-pointer" />
          Mostrar inativos
        </label>
        <span className="text-xs text-gray-500">{visiveis.length} pessoa(s)</span>
      </div>

      {visiveis.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Nenhuma pessoa cadastrada ainda.</p>
          <Btn onClick={openNew}><Plus size={16} /> Cadastrar a primeira</Btn>
        </CardBody></Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Papel</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{m.nome}</td>
                  <td className="px-4 py-2.5"><Badge>{PAPEL_EQUIPE_MAP[m.papel]?.label || m.papel || '—'}</Badge></td>
                  <td className="px-4 py-2.5">
                    {m.ativo
                      ? <span className="text-xs text-emerald-700">Ativo</span>
                      : <span className="text-xs text-gray-400">Inativo</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button onClick={() => openEdit(m)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded cursor-pointer" title="Editar"><Pencil size={15} /></button>
                    <button onClick={() => toggleAtivo(m)} className={`p-1.5 rounded cursor-pointer ${m.ativo ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={m.ativo ? 'Desativar' : 'Reativar'}><Power size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar pessoa' : 'Nova pessoa'}>
        <form onSubmit={handleSave} className="space-y-3">
          <Input label="Nome *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" required />
          <Select
            label="Papel"
            value={form.papel}
            onChange={e => setForm({ ...form, papel: e.target.value })}
            options={PAPEIS_EQUIPE.map(p => ({ value: p.id, label: p.label }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} className="w-4 h-4 cursor-pointer" />
            Ativo (aparece nas listas de responsável)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit">{editing ? 'Salvar' : 'Cadastrar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
