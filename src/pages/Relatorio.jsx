import { useState, useEffect } from 'react'
import { Printer, FileBarChart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS, ETAPA_MAP } from '../lib/constants'
import { Btn, Card, CardBody, Select } from '../components/ui'

export default function Relatorio() {
  const [obras, setObras] = useState([])
  const [obraId, setObraId] = useState('')
  const [pecas, setPecas] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('obras').select('id, codigo, cliente').order('codigo')
      .then(({ data }) => setObras(data || []))
  }, [])

  useEffect(() => { loadPecas() }, [obraId])

  async function loadPecas() {
    setLoading(true)
    let query = supabase
      .from('pecas')
      .select('*, romaneios(codigo, obra_id, obras(codigo, cliente)), moveis(codigo, nome, ambiente)')
      .order('codigo')

    const { data } = await query
    let result = data || []
    if (obraId) result = result.filter(p => p.romaneios?.obra_id === obraId)
    setPecas(result)
    setLoading(false)
  }

  const obraSelecionada = obras.find(o => o.id === obraId)

  // Agrupar por etapa
  const porEtapa = {}
  ETAPAS.forEach(e => { porEtapa[e.id] = [] })
  pecas.forEach(p => {
    if (porEtapa[p.etapa]) porEtapa[p.etapa].push(p)
  })

  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Relatório de Rastreio</h2>
          <p className="text-sm text-gray-500">Peças agrupadas por etapa do fluxo de produção</p>
        </div>
        <Btn onClick={() => window.print()} disabled={pecas.length === 0}>
          <Printer size={18} /> Imprimir / Salvar PDF
        </Btn>
      </div>

      {/* Filtros (não imprime) */}
      <Card className="no-print mb-6">
        <CardBody>
          <Select
            label="Obra"
            value={obraId}
            onChange={e => setObraId(e.target.value)}
            placeholder="Todas as obras"
            options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))}
          />
        </CardBody>
      </Card>

      {/* Documento de impressão */}
      <div className="print-doc bg-white rounded-xl shadow-sm border border-gray-200 mx-auto" style={{ maxWidth: '210mm', padding: '15mm' }}>
        {/* Cabeçalho */}
        <div style={{ borderBottom: '2px solid #059669', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileBarChart size={28} color="#059669" />
                <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 700, color: '#111827' }}>Relatório de Rastreio</h1>
              </div>
              <div style={{ fontSize: '11pt', color: '#374151', marginTop: '4px' }}>
                {obraSelecionada
                  ? <>Obra <strong>{obraSelecionada.codigo}</strong> — {obraSelecionada.cliente}</>
                  : 'Todas as obras'}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '9pt', color: '#6b7280' }}>
              <div>Emitido em: {new Date().toLocaleDateString('pt-BR')}</div>
              <div>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', fontSize: '8.5pt' }}>
            {ETAPAS.map(etapa => {
              const count = porEtapa[etapa.id].length
              return (
                <div key={etapa.id} style={{
                  background: etapa.cor + '15', border: `1px solid ${etapa.cor}40`,
                  padding: '8px 6px', borderRadius: '4px', textAlign: 'center',
                }}>
                  <div style={{ color: etapa.cor, fontWeight: 600 }}>{etapa.label}</div>
                  <div style={{ fontSize: '14pt', fontWeight: 700, color: '#111827' }}>{count}</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '8px', fontSize: '9pt', color: '#6b7280', textAlign: 'right' }}>
            Total: <strong>{pecas.length}</strong> peça(s)
          </div>
        </div>

        {/* Listas por etapa */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Carregando...</p>
        ) : pecas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>
            Nenhuma peça encontrada
          </p>
        ) : (
          ETAPAS.map(etapa => {
            const lista = porEtapa[etapa.id]
            if (lista.length === 0) return null
            return <EtapaSection key={etapa.id} etapa={etapa} pecas={lista} mostrarObra={!obraId} />
          })
        )}
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

function EtapaSection({ etapa, pecas, mostrarObra }) {
  return (
    <div style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
      <div style={{
        background: etapa.cor + '20', borderLeft: `4px solid ${etapa.cor}`,
        padding: '6px 10px', borderRadius: '4px 4px 0 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '11pt',
      }}>
        <strong style={{ color: '#111827' }}>{etapa.label}</strong>
        <span style={{ color: etapa.cor, fontWeight: 600 }}>{pecas.length} peça(s)</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', border: '1px solid #d1d5db', borderTop: 'none' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Código</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Nome</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Item</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Dimensões</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Material</th>
            {mostrarObra && <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Obra</th>}
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {pecas.map(p => (
            <tr key={p.id}>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 600 }}>{p.codigo}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nome}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                {p.moveis ? `${p.moveis.codigo} — ${p.moveis.nome}` : '—'}
              </td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.largura}×{p.altura}×{p.profundidade}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.material}</td>
              {mostrarObra && (
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                  {p.romaneios?.obras?.cliente || '—'}
                </td>
              )}
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                {p.updated_at ? new Date(p.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
