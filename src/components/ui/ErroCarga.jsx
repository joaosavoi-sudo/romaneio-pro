import { AlertTriangle, RefreshCw } from 'lucide-react'
import Btn from './Btn'

export default function ErroCarga({ onRetry, mensagem }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center my-4">
      <AlertTriangle size={32} className="mx-auto text-red-500 mb-2" />
      <p className="text-red-700 font-medium">Não foi possível carregar os dados</p>
      <p className="text-sm text-red-500 mt-1">{mensagem || 'Verifique sua conexão com a internet e tente novamente.'}</p>
      {onRetry && (
        <Btn variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw size={16} /> Tentar novamente
        </Btn>
      )}
    </div>
  )
}
