import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer, Check, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Btn, Card, CardBody, Select } from '../components/ui'
import QRLabel from '../components/QRLabel'

export default function Etiquetas() {
  const [searchParams] = useSearchParams()
  const romaneioParam = searchParams.get('romaneio')
  const [obras, setObras] = useState([])
  const [romaneios, setRomaneios] = useState([])
  const [pecas, setPecas] = useState([])
  const [moveis, setMoveis] = useState([])
  const [obraId, setObraId] = useState('')
  const [romaneioId, setRomaneioId] = useState(romaneioParam || '')
  const [selected, setSelected] = useState(new Set())
  const printRef = useRef()

  useEffect(() => {
    supabase.from('obras').select('id, codigo, cliente, endereco').eq('status', 'ativa').order('codigo')
      .then(({ data }) => setObras(data || []))
  }, [])

  useEffect(() => {
    if (obraId) {
      supabase.from('romaneios').select('id, codigo').eq('obra_id', obraId).order('codigo')
        .then(({ data }) => {
          setRomaneios(data || [])
          if (!data?.find(r => r.id === romaneioId)) setRomaneioId('')
        })
    }
  }, [obraId])

  useEffect(() => {
    if (romaneioParam && !obraId) {
      supabase.from('romaneios').select('obra_id').eq('id', romaneioParam).single()
        .then(({ data }) => {
          if (data) setObraId(data.obra_id)
        })
    }
  }, [romaneioParam])

  useEffect(() => {
    if (romaneioId) {
      Promise.all([
        supabase.from('pecas').select('*').eq('romaneio_id', romaneioId).order('codigo'),
        supabase.from('moveis').select('*').eq('romaneio_id', romaneioId),
      ]).then(([pecasRes, moveisRes]) => {
        setPecas(pecasRes.data || [])
        setMoveis(moveisRes.data || [])
        setSelected(new Set((pecasRes.data || []).map(p => p.id)))
      })
    } else {
      setPecas([])
      setMoveis([])
      setSelected(new Set())
    }
  }, [romaneioId])

  function toggleAll() {
    if (selected.size === pecas.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pecas.map(p => p.id)))
    }
  }

  function toggle(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function handlePrint() {
    window.print()
  }

  const obra = obras.find(o => o.id === obraId)
  const movelMap = Object.fromEntries(moveis.map(m => [m.id, m]))
  const selectedPecas = pecas.filter(p => selected.has(p.id))

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Etiquetas</h2>
        <p className="text-sm text-gray-500">Etiquetas QR Code 150×100mm para identificação na entrega</p>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Obra"
              value={obraId}
              onChange={e => setObraId(e.target.value)}
              placeholder="Selecione a obra..."
              options={obras.map(o => ({ value: o.id, label: `${o.codigo} — ${o.cliente}` }))}
            />
            <Select
              label="Romaneio"
              value={romaneioId}
              onChange={e => setRomaneioId(e.target.value)}
              placeholder="Selecione o romaneio..."
              options={romaneios.map(r => ({ value: r.id, label: r.codigo }))}
            />
            <div className="flex items-end gap-2 flex-wrap">
              <Btn
                variant="secondary"
                onClick={toggleAll}
                disabled={pecas.length === 0}
              >
                <Check size={16} />
                {selected.size === pecas.length ? 'Desmarcar' : 'Selecionar todas'}
              </Btn>
              <Btn
                onClick={handlePrint}
                disabled={selected.size === 0}
              >
                <Printer size={16} />
                Imprimir ({selected.size})
              </Btn>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Preview */}
      {pecas.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Tag size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Selecione uma obra e romaneio para ver as etiquetas</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {pecas.map(peca => (
            <div
              key={peca.id}
              onClick={() => toggle(peca.id)}
              className={`cursor-pointer rounded-xl border-2 transition-all p-1 inline-block ${
                selected.has(peca.id)
                  ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <QRLabel peca={peca} obra={obra} movel={movelMap[peca.movel_id]} />
            </div>
          ))}
        </div>
      )}

      {/* Área de impressão (escondida, visível só no print) */}
      <div className="print-area" ref={printRef}>
        {selectedPecas.map(peca => (
          <QRLabel key={peca.id} peca={peca} obra={obra} movel={movelMap[peca.movel_id]} forPrint />
        ))}
      </div>
    </div>
  )
}
