import { useState } from 'react'
import { CheckCircle2, Circle, ChevronRight, ChevronLeft, Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  OBRA_ETAPAS, itensDaEtapa, etapaInfo, indiceEtapa, proximaEtapa, etapaAnterior,
  itemMarcado, progressoEtapa, gateCompleto, etapaAtual,
} from '../lib/processo'
import { Btn, Card, CardBody, Badge } from './ui'

// Formata data BR com segurança (evita "Invalid Date" se o valor estiver corrompido).
function fmtDataBR(v) {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

// Aba "Processo" da obra: ciclo de 8 etapas com checklist e gate de transição.
// Props: obra, onChange (recarrega a obra após gravar).
export default function ProcessoObra({ obra, onChange }) {
  const atual = etapaAtual(obra)
  const [etapaVista, setEtapaVista] = useState(atual)
  const [salvando, setSalvando] = useState(false)

  const idxAtual = indiceEtapa(atual)
  const info = etapaInfo(etapaVista)
  const itens = itensDaEtapa(etapaVista)
  const { marcados, total } = progressoEtapa(obra, etapaVista)
  const gateOk = gateCompleto(obra, etapaVista)
  const isAtual = etapaVista === atual
  const prox = proximaEtapa(atual)
  const ant = etapaAnterior(atual)

  async function toggleItem(key, marcadoAgora) {
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const checklist = { ...(obra.checklist || {}) }
      const etapaObj = { ...(checklist[etapaVista] || {}) }
      etapaObj[key] = marcadoAgora
        ? { ok: false }
        : { ok: true, por: user?.email || null, em: new Date().toISOString() }
      checklist[etapaVista] = etapaObj
      await supabase.from('obras').update({ checklist }).eq('id', obra.id)
      onChange?.()
    } finally {
      setSalvando(false)
    }
  }

  async function avancar() {
    if (!prox) return
    await supabase.from('obras').update({ etapa_atual: prox.id }).eq('id', obra.id)
    setEtapaVista(prox.id)
    onChange?.()
  }

  async function voltar() {
    if (!ant) return
    await supabase.from('obras').update({ etapa_atual: ant.id }).eq('id', obra.id)
    setEtapaVista(ant.id)
    onChange?.()
  }

  async function concluirObra() {
    await supabase.from('obras').update({ status: 'concluida' }).eq('id', obra.id)
    onChange?.()
  }

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <Card>
        <CardBody className="overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {OBRA_ETAPAS.map((e, i) => {
              const concluida = i < idxAtual
              const corrente = i === idxAtual
              const vista = e.id === etapaVista
              const prog = progressoEtapa(obra, e.id)
              return (
                <div key={e.id} className="flex items-center">
                  <button
                    onClick={() => setEtapaVista(e.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors ${vista ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                    style={vista ? { boxShadow: `inset 0 0 0 2px ${e.cor}` } : {}}
                  >
                    <div className="flex items-center gap-1.5">
                      {concluida
                        ? <CheckCircle2 size={18} style={{ color: e.cor }} />
                        : <Circle size={18} style={{ color: corrente ? e.cor : '#d1d5db' }} fill={corrente ? e.cor : 'none'} fillOpacity={corrente ? 0.15 : 0} />}
                      <span className={`text-xs font-medium ${corrente ? 'text-gray-900' : concluida ? 'text-gray-600' : 'text-gray-400'}`}>
                        {i + 1}. {e.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">{prog.marcados}/{prog.total}</span>
                  </button>
                  {i < OBRA_ETAPAS.length - 1 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Checklist da etapa vista */}
      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: info.cor }} />
                {info.label}
                {isAtual && <Badge color={info.cor}>etapa atual</Badge>}
              </h3>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Flag size={12} /> Gate: {info.gate}
              </p>
            </div>
            <div className="text-sm text-gray-500">{marcados}/{total} itens</div>
          </div>

          <div className="space-y-1.5">
            {itens.map(item => {
              const marcado = itemMarcado(obra, etapaVista, item.key)
              const meta = obra?.checklist?.[etapaVista]?.[item.key]
              return (
                <label
                  key={item.key}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={salvando}
                    onChange={() => toggleItem(item.key, marcado)}
                    className="w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${marcado ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.label}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge color="#6b7280">{item.papel}</Badge>
                      {marcado && meta?.em && (
                        <span className="text-[10px] text-gray-400">
                          ✓ {meta.por ? `${meta.por} · ` : ''}{fmtDataBR(meta.em)}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>

          {/* Ações de gate — só na etapa atual */}
          {isAtual && (
            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 flex-wrap">
              <div>
                {ant && (
                  <button onClick={voltar} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer">
                    <ChevronLeft size={14} /> Voltar para {ant.label}
                  </button>
                )}
              </div>
              {prox ? (
                <Btn onClick={avancar} disabled={!gateOk}>
                  {gateOk ? <>Avançar para {prox.label} <ChevronRight size={16} /></> : `Avançar (faltam ${total - marcados})`}
                </Btn>
              ) : (
                <Btn onClick={concluirObra} disabled={!gateOk || obra.status === 'concluida'}>
                  {obra.status === 'concluida' ? 'Obra concluída' : gateOk ? <><CheckCircle2 size={16} /> Concluir obra</> : `Concluir (faltam ${total - marcados})`}
                </Btn>
              )}
            </div>
          )}
          {!isAtual && (
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
              Visualizando uma etapa {indiceEtapa(etapaVista) < idxAtual ? 'concluída' : 'futura'}. As ações de avanço ficam na etapa atual.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
