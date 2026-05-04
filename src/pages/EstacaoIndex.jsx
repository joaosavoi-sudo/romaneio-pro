import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, ScanLine, ArrowLeft } from 'lucide-react'
import { ESTACOES } from '../lib/constants'

export default function EstacaoIndex() {
  const [showPrint, setShowPrint] = useState(false)

  const baseUrl = window.location.origin

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toolbar (não imprime) */}
      <div className="no-print bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
          <ArrowLeft size={18} /> Voltar ao app
        </Link>
        <button
          onClick={() => { setShowPrint(true); setTimeout(() => window.print(), 100) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium cursor-pointer"
        >
          <Printer size={18} /> Imprimir QR Codes
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <div className="no-print mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Estações Móveis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cole os QR Codes na parede de cada estação. O operador escaneia o QR com o celular para abrir a tela
            de scanner correta. Sem login necessário.
          </p>
        </div>

        {/* Grid de QR Codes */}
        <div className="print-area grid grid-cols-1 sm:grid-cols-2 gap-6">
          {ESTACOES.map(est => {
            const url = `${baseUrl}/estacao/${est.slug}`
            return (
              <div
                key={est.slug}
                className="bg-white rounded-xl border-2 shadow-sm p-6 flex flex-col items-center text-center"
                style={{ borderColor: est.cor }}
              >
                <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: est.cor }}>
                  Estação
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{est.label}</h2>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <QRCodeSVG value={url} size={200} level="M" />
                </div>
                <div className="mt-4 text-xs text-gray-400 break-all max-w-full">{url}</div>
                <Link
                  to={`/estacao/${est.slug}`}
                  className="no-print mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
                  style={{ backgroundColor: est.cor }}
                >
                  <ScanLine size={16} /> Abrir esta estação
                </Link>
              </div>
            )
          })}
        </div>

        {/* Instruções (não imprime) */}
        <div className="no-print mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
          <h3 className="font-semibold mb-2">Como usar:</h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-800">
            <li>Imprima esta página e recorte os QR Codes</li>
            <li>Cole o QR Code de cada estação na parede da área correspondente</li>
            <li>O operador abre a câmera do celular e aponta para o QR da parede</li>
            <li>Abre direto a tela de scanner da estação - sem login, sem menus</li>
            <li>Ao escanear uma peça, ela é movida automaticamente para a etapa da estação</li>
          </ol>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area {
            grid-template-columns: 1fr 1fr !important;
            gap: 8mm !important;
          }
        }
      `}</style>
    </div>
  )
}
