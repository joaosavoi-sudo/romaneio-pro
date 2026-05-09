import { Routes, Route, Navigate } from 'react-router-dom'
import useAuth from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Obras from './pages/Obras'
import ObraDetalhe from './pages/ObraDetalhe'
import RomaneioEditor from './pages/RomaneioEditor'
import RomaneioImprimir from './pages/RomaneioImprimir'
import Romaneios from './pages/Romaneios'
import Itens from './pages/Itens'
import RelatorioObra from './pages/RelatorioObra'
import Pecas from './pages/Pecas'
import Scanner from './pages/Scanner'
import Etiquetas from './pages/Etiquetas'
import Relatorio from './pages/Relatorio'
import EstacaoIndex from './pages/EstacaoIndex'
import EstacaoScanner from './pages/EstacaoScanner'
import ImportarGuia from './pages/ImportarGuia'

function ProtectedRoute({ children, user }) {
  if (!user) return <Navigate to="/login" replace />
  return <Layout user={user}>{children}</Layout>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Rotas públicas (sem login) - estações móveis no chão de fábrica */}
      <Route path="/estacao" element={<EstacaoIndex />} />
      <Route path="/estacao/:nome" element={<EstacaoScanner />} />

      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
      <Route path="/importar" element={<ProtectedRoute user={user}><ImportarGuia /></ProtectedRoute>} />
      <Route path="/obras" element={<ProtectedRoute user={user}><Obras /></ProtectedRoute>} />
      <Route path="/obras/:id" element={<ProtectedRoute user={user}><ObraDetalhe /></ProtectedRoute>} />
      <Route path="/obras/:id/relatorio" element={<ProtectedRoute user={user}><RelatorioObra /></ProtectedRoute>} />
      <Route path="/itens" element={<ProtectedRoute user={user}><Itens /></ProtectedRoute>} />
      <Route path="/romaneios" element={<ProtectedRoute user={user}><Romaneios /></ProtectedRoute>} />
      <Route path="/romaneio/:id" element={<ProtectedRoute user={user}><RomaneioEditor /></ProtectedRoute>} />
      <Route path="/romaneio/:id/imprimir" element={<ProtectedRoute user={user}><RomaneioImprimir /></ProtectedRoute>} />
      <Route path="/pecas" element={<ProtectedRoute user={user}><Pecas /></ProtectedRoute>} />
      <Route path="/scanner" element={<ProtectedRoute user={user}><Scanner /></ProtectedRoute>} />
      <Route path="/etiquetas" element={<ProtectedRoute user={user}><Etiquetas /></ProtectedRoute>} />
      <Route path="/relatorio" element={<ProtectedRoute user={user}><Relatorio /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
