import { QRCodeSVG } from 'qrcode.react'

export default function QRLabel({ peca, obra, movel, forPrint = false }) {
  const dims = `${peca.largura || 0} × ${peca.altura || 0} × ${peca.profundidade || 0} mm`
  const enderecoLinha = obra?.endereco

  // Etiqueta 150x100mm em paisagem - identifica a embalagem na entrega
  const baseStyle = forPrint
    ? {
        width: '150mm', height: '100mm', padding: '4mm',
        boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
        background: 'white', display: 'flex', flexDirection: 'column',
      }
    : {
        width: '600px', height: '400px', padding: '16px',
        boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
        background: 'white', display: 'flex', flexDirection: 'column',
        border: '1px solid #e5e7eb', borderRadius: '8px',
      }

  // Escala proporcional ao tamanho de impressão (1mm ≈ 3.78px na tela, mas usamos px diretos no preview)
  const px = forPrint ? (mm) => `${mm}mm` : (mm) => `${mm * 4}px`

  return (
    <div className={forPrint ? 'etiqueta' : ''} style={baseStyle}>
      {/* Cabeçalho - cliente em destaque */}
      <div style={{
        borderBottom: '2px solid #059669', paddingBottom: px(2), marginBottom: px(2),
      }}>
        <div style={{
          fontSize: forPrint ? '7pt' : '11px', color: '#059669',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Romaneio Pro · Entrega
        </div>
        <div style={{
          fontSize: forPrint ? '14pt' : '22px', fontWeight: 700, color: '#111827',
          lineHeight: 1.1, marginTop: px(0.5),
        }}>
          {obra?.cliente || 'Cliente'}
        </div>
        {enderecoLinha && (
          <div style={{
            fontSize: forPrint ? '8pt' : '12px', color: '#374151',
            marginTop: px(0.5), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {enderecoLinha}
          </div>
        )}
      </div>

      {/* Corpo - QR + dados da peça */}
      <div style={{ display: 'flex', gap: px(3), flex: 1, alignItems: 'center' }}>
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={peca.codigo || peca.id} size={forPrint ? 200 : 165} level="M" />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: px(1) }}>
          <div>
            <div style={{
              fontSize: forPrint ? '10pt' : '15px', color: '#6b7280',
              fontWeight: 500, lineHeight: 1,
            }}>
              Peça
            </div>
            <div style={{
              fontSize: forPrint ? '16pt' : '26px', fontWeight: 700, color: '#111827',
              fontFamily: 'monospace', lineHeight: 1.1,
            }}>
              {peca.codigo}
            </div>
            <div style={{
              fontSize: forPrint ? '11pt' : '17px', color: '#374151', fontWeight: 500,
              lineHeight: 1.2, marginTop: px(0.5),
            }}>
              {peca.nome}
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: px(1),
            fontSize: forPrint ? '8pt' : '12px', color: '#374151',
          }}>
            <div>
              <div style={{ color: '#9ca3af', fontSize: forPrint ? '7pt' : '11px' }}>Dimensões</div>
              <div style={{ fontWeight: 600 }}>{dims}</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', fontSize: forPrint ? '7pt' : '11px' }}>Material</div>
              <div style={{ fontWeight: 600 }}>{peca.material || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', fontSize: forPrint ? '7pt' : '11px' }}>Acabamento</div>
              <div style={{ fontWeight: 600 }}>{peca.cor_acabamento || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', fontSize: forPrint ? '7pt' : '11px' }}>Ambiente</div>
              <div style={{ fontWeight: 600 }}>{movel?.ambiente || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé - móvel/contrato + obra */}
      <div style={{
        borderTop: '1px dashed #d1d5db', paddingTop: px(1.5), marginTop: px(1.5),
        fontSize: forPrint ? '8pt' : '12px', color: '#374151',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <div>
          {movel ? <><strong>Item {movel.codigo}</strong> — {movel.nome}</> : 'Peça avulsa'}
        </div>
        <div style={{ color: '#6b7280' }}>
          Obra {obra?.codigo}
        </div>
      </div>
    </div>
  )
}
