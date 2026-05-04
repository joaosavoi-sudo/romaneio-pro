import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Package, ScanLine, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS } from '../lib/constants'
import { Card, CardBody } from '../components/ui'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="p-3 rounded-xl" style={{ backgroundColor: color + '15' }}>
          <Icon size={24} style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ obras: 0, pecas: 0, romaneios: 0 })
  const [etapaCounts, setEtapaCounts] = useState({})
  const [historico, setHistorico] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const [obrasRes, pecasRes, romaneiosRes, historicoRes] = await Promise.all([
      supabase.from('obras').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
      supabase.from('pecas').select('id, etapa'),
      supabase.from('romaneios').select('id', { count: 'exact', head: true }),
      supabase.from('peca_historico').select('*, pecas(codigo, nome)').order('created_at', { ascending: false }).limit(10),
    ])

    setStats({
      obras: obrasRes.count || 0,
      pecas: pecasRes.data?.length || 0,
      romaneios: romaneiosRes.count || 0,
    })

    const counts = {}
    ETAPAS.forEach(e => { counts[e.id] = 0 })
    pecasRes.data?.forEach(p => {
      if (counts[p.etapa] !== undefined) counts[p.etapa]++
    })
    setEtapaCounts(counts)
    setHistorico(historicoRes.data || [])
  }

  const totalPecas = Object.values(etapaCounts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Visão geral do romaneio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2} label="Obras ativas" value={stats.obras} color="#059669" />
        <StatCard icon={Package} label="Total de peças" value={stats.pecas} color="#3b82f6" />
        <StatCard icon={ScanLine} label="Romaneios" value={stats.romaneios} color="#8b5cf6" />
        <StatCard icon={TrendingUp} label="Expedidas" value={etapaCounts.expedicao || 0} color="#ef4444" />
      </div>

      {/* Peças por etapa */}
      <Card className="mb-8">
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Peças por Etapa</h3>
          <div className="space-y-3">
            {ETAPAS.map(etapa => {
              const count = etapaCounts[etapa.id] || 0
              const pct = totalPecas > 0 ? (count / totalPecas) * 100 : 0
              return (
                <div key={etapa.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 shrink-0">{etapa.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 0)}%`, backgroundColor: etapa.cor }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-10 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Últimas movimentações */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimas Movimentações</h3>
          {historico.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nenhuma movimentação registrada</p>
          ) : (
            <div className="space-y-2">
              {historico.map(h => {
                const etapaInfo = ETAPAS.find(e => e.id === h.etapa_nova)
                return (
                  <div key={h.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: etapaInfo?.cor || '#6b7280' }}
                    />
                    <div className="flex-1 text-sm">
                      <span className="font-medium text-gray-900">{h.pecas?.codigo}</span>
                      <span className="text-gray-500"> — {h.pecas?.nome}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      → {etapaInfo?.label || h.etapa_nova}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
