import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Wrench } from 'lucide-react'
import { supabase, checarErros } from '../lib/supabase'
import { STATUS_ASSISTENCIA_MAP } from '../lib/assistencias'
import { fmtData } from '../lib/cronograma'
import { Btn, ErroCarga } from '../components/ui'
import { FotoThumb } from '../components/AmostrasObra'

export default function AssistenciaImprimir() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [assist, setAssist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setErro(null)
    setLoading(true)
    try {
      const res = await supabase
        .from('assistencias')
        .select('*, obras(codigo, cliente, endereco), moveis(codigo, nome, descricao, ambiente)')
        .eq('id', id)
        .single()
      checarErros(res)
      setAssist(res.data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (erro) return <ErroCarga mensagem={erro} onRetry={loadData} />
  if (!assist) return <p className="text-center text-red-500 py-12">Chamado não encontrado</p>

  const st = STATUS_ASSISTENCIA_MAP[assist.status]
  const numeroOS = (assist.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  const fotos = (Array.isArray(assist.fotos) ? assist.fotos : []).slice(0, 6)

  const rotulo = { fontSize: '8pt', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }
  const valor = { fontSize: '10.5pt', color: '#111827', marginTop: '2px' }

  return (
    <div>
      {/* Toolbar (não imprime) */}
      <div className="no-print mb-4 flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-3">
          {fotos.length > 0 && (
            <span className="text-xs text-gray-400">Aguarde as fotos carregarem antes de imprimir</span>
          )}
          <Btn onClick={() => window.print()}>
            <Printer size={18} /> Imprimir / Salvar PDF
          </Btn>
        </div>
      </div>

      {/* Documento */}
      <div className="print-doc bg-white rounded-xl shadow-sm border border-gray-200 mx-auto" style={{ maxWidth: '210mm', padding: '15mm' }}>
        {/* Cabeçalho */}
        <div style={{ borderBottom: '2px solid #059669', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={26} color="#059669" />
                <h1 style={{ margin: 0, fontSize: '19pt', fontWeight: 700, color: '#111827' }}>
                  Ordem de Serviço — Assistência Técnica
                </h1>
              </div>
              <div style={{ fontSize: '10pt', color: '#374151', marginTop: '4px' }}>
                OS <strong>#{numeroOS}</strong>
                {st && (
                  <span style={{
                    marginLeft: '10px', padding: '1px 8px', borderRadius: '999px',
                    fontSize: '8.5pt', fontWeight: 600, backgroundColor: st.cor + '20', color: st.cor,
                  }}>
                    {st.label}
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '9pt', color: '#6b7280' }}>
              <div style={{ fontWeight: 700, color: '#059669', fontSize: '10pt' }}>TMObras · Top Móveis</div>
              <div>Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>

        {/* Cliente / Obra */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: '14px' }}>
          <div>
            <div style={rotulo}>Cliente</div>
            <div style={valor}>{assist.obras?.cliente || assist.cliente_externo || '—'}</div>
          </div>
          <div>
            <div style={rotulo}>Obra</div>
            <div style={valor}>
              {assist.obras?.codigo || assist.obra_externa || '—'}
              {!assist.obras && <span style={{ color: '#6b7280', fontSize: '9pt' }}> (não cadastrada)</span>}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={rotulo}>Endereço / Contato</div>
            <div style={valor}>
              {assist.obras?.endereco || assist.contato || '—'}
              {assist.obras && assist.contato ? ` · ${assist.contato}` : ''}
            </div>
          </div>
          {assist.moveis && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={rotulo}>Item / Móvel</div>
              <div style={valor}>
                <strong>{assist.moveis.codigo}</strong> — {assist.moveis.descricao || assist.moveis.nome}
                {assist.moveis.ambiente ? ` · ${assist.moveis.ambiente}` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Dados do chamado */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 20px',
          padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: '6px', marginBottom: '14px',
        }}>
          <div>
            <div style={rotulo}>Solicitado em</div>
            <div style={valor}>{fmtData(assist.data_solicitacao)}</div>
          </div>
          <div>
            <div style={rotulo}>Data agendada</div>
            <div style={valor}>{assist.data_agendada ? fmtData(assist.data_agendada) : '____/____/____'}</div>
          </div>
          <div>
            <div style={rotulo}>Concluir até</div>
            <div style={valor}>{fmtData(assist.prazo_concluir)}</div>
          </div>
          <div>
            <div style={rotulo}>Responsável (equipe)</div>
            <div style={valor}>{assist.responsavel || '—'}</div>
          </div>
          <div>
            <div style={rotulo}>Solicitante</div>
            <div style={valor}>{assist.solicitante || '—'}</div>
          </div>
          <div>
            <div style={rotulo}>Cobrança</div>
            <div style={valor}>
              {assist.em_garantia
                ? <span style={{ color: '#059669', fontWeight: 600 }}>Em garantia</span>
                : <span style={{ color: '#dc2626', fontWeight: 700 }}>A COBRAR{assist.valor_cobranca ? ` · R$ ${assist.valor_cobranca}` : ''}</span>}
            </div>
          </div>
        </div>

        {/* Demanda */}
        <div style={{ marginBottom: '14px' }}>
          <div style={rotulo}>Demanda relatada pelo cliente</div>
          <div style={{
            marginTop: '4px', padding: '10px 12px', border: '1px solid #e5e7eb',
            borderLeft: '4px solid #059669', borderRadius: '4px', fontSize: '11pt', color: '#111827',
          }}>
            <strong>{assist.titulo}</strong>
            {assist.descricao && (
              <div style={{ marginTop: '6px', fontSize: '10pt', color: '#374151', whiteSpace: 'pre-wrap' }}>
                {assist.descricao}
              </div>
            )}
          </div>
        </div>

        {/* Fotos */}
        {fotos.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={rotulo}>Fotos do problema</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {fotos.map(f => (
                <FotoThumb key={f.path} path={f.path} className="rounded border border-gray-200 w-[45mm] h-[45mm]" />
              ))}
            </div>
          </div>
        )}

        {/* Preenchimento em campo */}
        <div style={{ pageBreakInside: 'avoid', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
          <div style={rotulo}>Serviço executado / materiais utilizados (preencher em campo)</div>
          <div style={{ marginTop: '8px' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ borderBottom: '1px solid #d1d5db', height: '26px' }} />
            ))}
          </div>
          <div style={{ marginTop: '14px', fontSize: '10pt', color: '#111827' }}>
            Data da execução: ____/____/____
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '34px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #111827', paddingTop: '4px', fontSize: '9pt', color: '#374151' }}>
                Técnico responsável
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #111827', paddingTop: '4px', fontSize: '9pt', color: '#374151' }}>
                Cliente
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-doc {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
