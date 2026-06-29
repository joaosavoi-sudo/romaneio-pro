import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Btn } from '../components/ui'

export default function RomaneioImprimir() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [romaneio, setRomaneio] = useState(null)
  const [obra, setObra] = useState(null)
  const [pecas, setPecas] = useState([])
  const [moveis, setMoveis] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: rom } = await supabase.from('romaneios').select('*, obras(*)').eq('id', id).single()
    if (rom) {
      setRomaneio(rom)
      setObra(rom.obras)
    }
    const [pecasRes, moveisRes] = await Promise.all([
      supabase.from('pecas').select('*').eq('romaneio_id', id).order('created_at', { ascending: true }),
      rom?.obras?.id
        ? supabase.from('moveis').select('*').eq('obra_id', rom.obras.id).order('codigo', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])
    setPecas(pecasRes.data || [])
    setMoveis(moveisRes.data || [])
    setLoading(false)
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (!romaneio) return <p className="text-center text-red-500 py-12">Romaneio não encontrado</p>

  // Agrupa só os itens que têm peças neste romaneio.
  const moveisComPecas = moveis
    .map(m => ({ ...m, pecas: pecas.filter(p => p.movel_id === m.id) }))
    .filter(m => m.pecas.length > 0)
  // "Avulsas" = qualquer peça não agrupada (movel_id nulo OU órfão) — nunca derruba peça.
  const agrupadas = new Set(moveisComPecas.flatMap(m => m.pecas.map(p => p.id)))
  const pecasSemMovel = pecas.filter(p => !agrupadas.has(p.id))

  return (
    <div>
      {/* Toolbar (não imprime) */}
      <div className="no-print flex items-center justify-between mb-6">
        <button onClick={() => navigate(`/romaneio/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          <ArrowLeft size={16} /> Voltar para edição
        </button>
        <Btn onClick={() => window.print()}>
          <Printer size={18} /> Imprimir / Salvar PDF
        </Btn>
      </div>

      {/* Documento (imprime) */}
      <div className="print-doc bg-white rounded-xl shadow-sm border border-gray-200 mx-auto" style={{ maxWidth: '210mm', padding: '15mm' }}>
        {/* Cabeçalho */}
        <div style={{ borderBottom: '2px solid #059669', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={28} color="#059669" />
                <h1 style={{ margin: 0, fontSize: '24pt', fontWeight: 700, color: '#111827' }}>Romaneio</h1>
              </div>
              <div style={{ fontSize: '14pt', fontWeight: 600, color: '#059669', marginTop: '4px' }}>{romaneio.codigo}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '9pt', color: '#6b7280' }}>
              <div>Emitido em: {new Date().toLocaleDateString('pt-BR')}</div>
              <div>Criado: {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
        </div>

        {/* Dados da obra */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '11pt', fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Obra</h2>
          <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '6px', fontSize: '10pt' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
              <div><strong>Código:</strong> {obra?.codigo}</div>
              <div><strong>Cliente:</strong> {obra?.cliente}</div>
              {obra?.endereco && <div style={{ gridColumn: 'span 2' }}><strong>Endereço:</strong> {obra.endereco}</div>}
              {obra?.arquiteto && <div><strong>Arquiteto:</strong> {obra.arquiteto}</div>}
            </div>
          </div>
        </div>

        {/* Responsáveis */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '11pt', fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Responsáveis</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '10pt' }}>
            <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '6px' }}>
              <div style={{ color: '#6b7280', fontSize: '9pt' }}>Marceneiro</div>
              <div style={{ fontWeight: 600 }}>{romaneio.marceneiro || '—'}</div>
            </div>
            <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '6px' }}>
              <div style={{ color: '#6b7280', fontSize: '9pt' }}>Responsável pelo romaneio</div>
              <div style={{ fontWeight: 600 }}>{romaneio.responsavel || '—'}</div>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div style={{ marginBottom: '20px', padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '10pt' }}>
          <strong>Total: {pecas.length} peça(s)</strong> distribuída(s) em {moveisComPecas.length} item(ns)
          {pecasSemMovel.length > 0 && ` + ${pecasSemMovel.length} peça(s) avulsa(s)`}
        </div>

        {/* Móveis e peças */}
        {moveisComPecas.map(movel => (
          <MovelTable key={movel.id} movel={movel} />
        ))}

        {pecasSemMovel.length > 0 && (
          <MovelTable
            movel={{ codigo: '—', nome: 'Peças avulsas (sem item)', ambiente: '', pecas: pecasSemMovel }}
          />
        )}

        {romaneio.observacoes && (
          <div style={{ marginTop: '20px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '9pt' }}>
            <strong>Observações:</strong> {romaneio.observacoes}
          </div>
        )}

        {/* Assinaturas */}
        <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: '9pt' }}>
          <div style={{ textAlign: 'center', borderTop: '1px solid #9ca3af', paddingTop: '6px' }}>
            Marceneiro<br />
            <strong>{romaneio.marceneiro || ' '}</strong>
          </div>
          <div style={{ textAlign: 'center', borderTop: '1px solid #9ca3af', paddingTop: '6px' }}>
            Responsável<br />
            <strong>{romaneio.responsavel || ' '}</strong>
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

function MovelTable({ movel }) {
  return (
    <div style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
      <div style={{ background: '#dbeafe', padding: '6px 10px', borderRadius: '4px 4px 0 0', fontSize: '10pt' }}>
        <strong>Item {movel.codigo}</strong> — {movel.nome}
        {movel.ambiente && <span style={{ color: '#6b7280' }}> ({movel.ambiente})</span>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', border: '1px solid #d1d5db', borderTop: 'none' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Código</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Nome / Descrição</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Dimensões (mm)</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Material</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #d1d5db' }}>Acabamento</th>
          </tr>
        </thead>
        <tbody>
          {movel.pecas.map(p => (
            <tr key={p.id}>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 600 }}>{p.codigo}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nome}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.largura}×{p.altura}×{p.profundidade}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.material}</td>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.cor_acabamento || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
