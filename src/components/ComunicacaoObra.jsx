import { useState, useEffect } from 'react'
import { MessageCircle, Plus, Copy, Check, Send, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  MOMENTOS_CONTATO, MOMENTO_MAP, CANAIS_CONTATO, INTERVALO_CONTATO_DIAS,
  diasDesde, addDias, fmtData, gerarUpdateQuinzenal,
} from '../lib/comunicacao'
import { Btn, Input, Select, Modal, Card, CardBody, Badge } from './ui'

// Aba "Comunicação" da obra: cadência de contatos com o cliente + update quinzenal.
// Props: obra, pctConcluido (número|null), pendencias (array da obra).
export default function ComunicacaoObra({ obra, pctConcluido, pendencias = [] }) {
  const [contatos, setContatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ momento: 'quinzenal', canal: 'WhatsApp', data: hoje(), resumo: '' })
  const [genOpen, setGenOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => { loadContatos(); supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || '')) }, [obra.id])

  async function loadContatos() {
    const { data } = await supabase
      .from('obra_contatos')
      .select('*')
      .eq('obra_id', obra.id)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    setContatos(data || [])
    setLoading(false)
  }

  const ultimo = contatos[0]
  const baseUltima = ultimo?.data || obra.data_inicio || null
  const proximoPrevisto = baseUltima ? addDias(baseUltima, INTERVALO_CONTATO_DIAS) : new Date()
  const atraso = diasDesde(proximoPrevisto) // >0 = vencido há N dias

  const pendenciasCliente = pendencias
    .filter(p => p.status === 'aberta' && (p.tipo === 'cliente' || p.tipo === 'medicao'))
    .map(p => p.titulo)

  async function salvarContato(e) {
    e.preventDefault()
    await supabase.from('obra_contatos').insert({
      obra_id: obra.id,
      data: form.data || hoje(),
      momento: form.momento,
      canal: form.canal,
      resumo: form.resumo,
      por: userEmail || null,
    })
    setAddOpen(false)
    setForm({ momento: 'quinzenal', canal: 'WhatsApp', data: hoje(), resumo: '' })
    loadContatos()
  }

  function abrirGerador() {
    setMsg(gerarUpdateQuinzenal({
      obra,
      pct: pctConcluido,
      previsao: obra.data_entrega_prometida ? fmtData(obra.data_entrega_prometida) : null,
      pendenciasCliente,
      proximosPassos: obra.proximos_passos,
      gestor: userEmail,
    }))
    setCopiado(false)
    setGenOpen(true)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(msg)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard pode falhar sem https; usuário copia manual */ }
  }

  async function registrarComoEnviado() {
    await supabase.from('obra_contatos').insert({
      obra_id: obra.id, data: hoje(), momento: 'quinzenal',
      canal: 'WhatsApp/E-mail', resumo: 'Update quinzenal enviado ao cliente.', por: userEmail || null,
    })
    setGenOpen(false)
    loadContatos()
  }

  if (loading) return <p className="text-center text-gray-500 py-8">Carregando...</p>

  return (
    <div className="space-y-4">
      {/* Banner de próximo contato */}
      <Card>
        <CardBody className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: atraso > 0 ? '#fef2f2' : '#ecfdf5' }}>
              <Clock size={20} style={{ color: atraso > 0 ? '#ef4444' : '#10b981' }} />
            </div>
            <div>
              {ultimo ? (
                <p className="text-sm text-gray-700">
                  Último contato: <strong>{fmtData(ultimo.data)}</strong> ({MOMENTO_MAP[ultimo.momento]?.label || ultimo.momento})
                </p>
              ) : (
                <p className="text-sm text-gray-700">Nenhum contato registrado ainda.</p>
              )}
              <p className={`text-xs mt-0.5 ${atraso > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {atraso > 0
                  ? `Contato com o cliente atrasado há ${atraso} dia(s) — recomendado a cada ${INTERVALO_CONTATO_DIAS} dias`
                  : `Próximo contato previsto: ${fmtData(proximoPrevisto)}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={abrirGerador}><Send size={15} /> Gerar update</Btn>
            <Btn onClick={() => setAddOpen(true)}><Plus size={15} /> Registrar contato</Btn>
          </div>
        </CardBody>
      </Card>

      {/* Guia de cadência (Seção 5.1) */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Cadência obrigatória</h3>
          <div className="flex flex-wrap gap-2">
            {MOMENTOS_CONTATO.filter(m => !['outro', 'pendencia'].includes(m.id)).map(m => {
              const feito = contatos.some(c => c.momento === m.id)
              return (
                <span key={m.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${feito ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                  {feito ? <Check size={12} /> : <span className="w-2 h-2 rounded-full bg-gray-300" />}
                  {m.label}
                </span>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Histórico de contatos */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Histórico de contatos</h3>
          {contatos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhum contato registrado. Comece registrando o primeiro.</p>
          ) : (
            <div className="space-y-2">
              {contatos.map(c => (
                <div key={c.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <MessageCircle size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{MOMENTO_MAP[c.momento]?.label || c.momento || 'Contato'}</span>
                      {c.canal && <Badge color="#6b7280">{c.canal}</Badge>}
                      <span className="text-xs text-gray-400">{fmtData(c.data)}</span>
                    </div>
                    {c.resumo && <p className="text-sm text-gray-600 mt-0.5">{c.resumo}</p>}
                    {c.por && <p className="text-[10px] text-gray-400 mt-0.5">por {c.por}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal: registrar contato */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Registrar contato com o cliente">
        <form onSubmit={salvarContato} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select label="Momento" value={form.momento} onChange={e => setForm({ ...form, momento: e.target.value })}
              options={MOMENTOS_CONTATO.map(m => ({ value: m.id, label: m.label }))} />
            <Select label="Canal" value={form.canal} onChange={e => setForm({ ...form, canal: e.target.value })}
              options={CANAIS_CONTATO.map(c => ({ value: c, label: c }))} />
          </div>
          <Input label="Data" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resumo do que foi comunicado</label>
            <textarea value={form.resumo} onChange={e => setForm({ ...form, resumo: e.target.value })} rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: Enviado update de andamento, cliente ciente da previsão." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancelar</Btn>
            <Btn type="submit">Registrar</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal: gerar update quinzenal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Update para o cliente">
        <p className="text-xs text-gray-500 mb-2">Gerado a partir dos dados da obra. Edite se quiser antes de enviar.</p>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div className="flex justify-between gap-2 pt-3 flex-wrap">
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={copiar}>{copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}</Btn>
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
              <Btn variant="secondary" type="button"><Send size={15} /> WhatsApp</Btn>
            </a>
          </div>
          <Btn onClick={registrarComoEnviado}>Registrar como enviado</Btn>
        </div>
      </Modal>
    </div>
  )
}

function hoje() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
