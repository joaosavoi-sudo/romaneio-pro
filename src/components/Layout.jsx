import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, ClipboardList, ScanLine,
  Tag, Package, LogOut, Menu, X, FileBarChart, Smartphone, FileUp, ListChecks, AlertCircle, Users
} from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/importar', icon: FileUp, label: 'Importar Guia' },
  { to: '/obras', icon: Building2, label: 'Obras' },
  { to: '/itens', icon: ListChecks, label: 'Itens' },
  { to: '/pendencias', icon: AlertCircle, label: 'Pendências' },
  { to: '/romaneios', icon: ClipboardList, label: 'Romaneios' },
  { to: '/pecas', icon: Package, label: 'Peças' },
  { to: '/scanner', icon: ScanLine, label: 'Scanner' },
  { to: '/etiquetas', icon: Tag, label: 'Etiquetas' },
  { to: '/relatorio', icon: FileBarChart, label: 'Rastreio' },
  { to: '/estacao', icon: Smartphone, label: 'Estações Móveis' },
  { to: '/equipe', icon: Users, label: 'Equipe' },
]

function SidebarLink({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${isActive
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  )
}

export default function Layout({ children, user }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-primary-700 flex items-center gap-2">
            <ClipboardList size={24} />
            Romaneio Pro
          </h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => <SidebarLink key={item.to} {...item} />)}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 text-xs text-gray-500 truncate mb-2">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors cursor-pointer"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary-700 flex items-center gap-2">
          <ClipboardList size={20} />
          Romaneio Pro
        </h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 cursor-pointer">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100">
              <h1 className="text-xl font-bold text-primary-700 flex items-center gap-2">
                <ClipboardList size={24} />
                Romaneio Pro
              </h1>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map(item => (
                <SidebarLink key={item.to} {...item} onClick={() => setMobileOpen(false)} />
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 w-full cursor-pointer"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="pt-16 lg:pt-0 p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
