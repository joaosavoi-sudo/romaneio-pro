import { useState, useEffect } from 'react'
import { Btn, Input, Modal } from './ui'
import { CRONOGRAMA_FASES_PADRAO } from '../lib/constants'
import { calcFases, somaPct } from '../lib/cronograma'

// Ajusta o % da fase `idx` compensando na fase seguinte (mantém soma = 100). Pura.
function setFasePctPure(form, idx, valor) {
  const fases = form.fases.map(f => ({ ...f }))
  const novo = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)))
  const delta = novo - fases[idx].pct
  const proxIdx = idx + 1
  if (proxIdx < fases.length) {
    const ajustado = fases[proxIdx].pct - delta
    if (ajustado < 0) return form // não deixa a fase seguinte ficar negativa
    fases[idx].pct = novo
    fases[proxIdx].pct = ajustado
  } else {
    fases[idx].pct = novo
  }
  return { ...form, fases }
}

// Date → 'yyyy-mm-dd' para popular <input type="date">.
function toInputDate(d) {
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Editor reutilizável de cronograma (4 fases) — usado pela obra e por cada item.
// Props:
//   - open, onClose
//   - titulo
//   - valorInicial: { data_inicio, prazo_dias, fases: [{chave,label,cor,pct}] }
//   - onSave: (payload) => void  | payload = { data_inicio, prazo_dias, cronograma_fases }
export default function CronogramaEditorModal({ open, onClose, titulo = 'Cronograma', valorInicial, onSave }) {
  const [form, setForm] = useState({ data_inicio: '', prazo_dias: '', fases: [] })

  useEffect(() => {
    if (open && valorInicial) setForm(valorInicial)
  }, [open, valorInicial])

  function setFasePct(idx, valor) {
    setForm(prev => setFasePctPure(prev, idx, valor))
  }

  // Edita a data-fim de uma fase (boundary): converte para % e rebalanceia a seguinte.
  function setFaseDataFim(idx, dataStr) {
    setForm(prev => {
      const prazo = Number(prev.prazo_dias)
      if (!prev.data_inicio || !(prazo > 0) || !dataStr) return prev
      const ini = new Date(prev.data_inicio); ini.setHours(0, 0, 0, 0)
      const fim = new Date(dataStr); fim.setHours(0, 0, 0, 0)
      const diasDecorridos = Math.round((fim - ini) / 86400000)
      const fimPctAlvo = Math.max(0, Math.min(100, (diasDecorridos / prazo) * 100))
      const inicioPct = prev.fases.slice(0, idx).reduce((a, f) => a + f.pct, 0)
      const novoPct = Math.max(0, Math.round(fimPctAlvo - inicioPct))
      return setFasePctPure(prev, idx, novoPct)
    })
  }

  function restaurarPadrao() {
    setForm(prev => ({
      ...prev,
      fases: CRONOGRAMA_FASES_PADRAO.map(f => ({ chave: f.chave, label: f.label, cor: f.cor, pct: f.pct })),
    }))
  }

  function submit(e) {
    e.preventDefault()
    const prazo = Number(form.prazo_dias)
    if (!form.data_inicio || !(prazo > 0) || somaPct(form.fases) !== 100) return
    onSave({
      data_inicio: form.data_inicio,
      prazo_dias: prazo,
      cronograma_fases: form.fases.map(f => ({ chave: f.chave, pct: Number(f.pct) })),
    })
  }

  const prazo = Number(form.prazo_dias)
  const podeData = !!form.data_inicio && prazo > 0
  const calc = podeData
    ? calcFases({ data_inicio: form.data_inicio, prazo_dias: prazo, cronograma_fases: form.fases })
    : []
  const soma = somaPct(form.fases)
  const somaOk = soma === 100

  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Data de início *"
            type="date"
            value={form.data_inicio}
            onChange={e => setForm({ ...form, data_inicio: e.target.value })}
            required
          />
          <Input
            label="Prazo total (dias) *"
            type="number"
            min="1"
            value={form.prazo_dias}
            onChange={e => setForm({ ...form, prazo_dias: e.target.value })}
            placeholder="Ex: 120"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Fases (% do prazo)</label>
            <button type="button" onClick={restaurarPadrao} className="text-xs text-primary-600 hover:underline cursor-pointer">
              Restaurar padrão
            </button>
          </div>
          <div className="space-y-2">
            {form.fases.map((f, idx) => {
              const ultima = idx === form.fases.length - 1
              return (
                <div key={f.chave} className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.cor }} />
                  <span className="text-sm text-gray-700 flex-1 min-w-[140px]">{f.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={f.pct}
                      onChange={e => setFasePct(idx, e.target.value)}
                      className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  {podeData && (
                    <input
                      type="date"
                      value={calc[idx]?.dataFim ? toInputDate(calc[idx].dataFim) : ''}
                      onChange={e => setFaseDataFim(idx, e.target.value)}
                      disabled={ultima}
                      title={ultima ? 'A última fase termina na data de entrega' : 'Data-fim desta fase'}
                      className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  )}
                </div>
              )
            })}
          </div>
          <p className={`text-xs mt-2 font-medium ${somaOk ? 'text-emerald-600' : 'text-red-600'}`}>
            Soma: {soma}% {somaOk ? '✓' : '— ajuste para fechar 100%'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={!somaOk || !form.data_inicio || !(prazo > 0)}>
            Salvar cronograma
          </Btn>
        </div>
      </form>
    </Modal>
  )
}
