import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Wrench, ShieldCheck, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { deleteAnexoStorage } from '../lib/storage'
import { STATUS_ASSISTENCIA, STATUS_ASSISTENCIA_MAP, assistenciaAtrasada } from '../lib/assistencias'
import { fmtData } from '../lib/cronograma'
import { Btn, Card, CardBody, Badge } from './ui'
import { FotoThumb } from './AmostrasObra'
import AssistenciaFormModal from './AssistenciaFormModal'

// Aba "Assistência" da obra. Props: obra, moveis (não usado direto; o modal carrega), onChange.
export default function AssistenciaObra({ obra, onChange }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { loadData() }, [obra.id])

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

  function openNew() { setEditing(null); setModalOpen(true) }
  function openEdit(a) { setEditing(a); setModalOpen(true) }

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

      <AssistenciaFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={() => { loadData(); onChange?.() }}
        editing={editing}
        obraFixa={obra}
      />
    </div>
  )
}
