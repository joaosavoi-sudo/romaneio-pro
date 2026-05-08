import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileUp, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Upload, Building2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Btn, Input, Card, CardBody } from '../components/ui'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export default function ImportarGuia() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('idle') // idle | processing | review
  const [erro, setErro] = useState('')
  const [debug, setDebug] = useState(null)

  // input
  const [file, setFile] = useState(null)
  const fileInputRef = useRef()

  // dados extraídos (review)
  const [obra, setObra] = useState(null)
  const [moveis, setMoveis] = useState([])
  const [expandidos, setExpandidos] = useState({})

  // import progress
  const [importando, setImportando] = useState(false)

  function handleFileSelect(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const lower = f.name.toLowerCase()
    const isValid =
      lower.endsWith('.csv') ||
      lower.endsWith('.tsv') ||
      lower.endsWith('.txt') ||
      f.type.includes('csv') ||
      f.type.includes('tab-separated') ||
      f.type.includes('text')
    if (!isValid) {
      setErro('Por favor selecione um arquivo CSV ou TSV')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      setErro(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)}MB). Máx 5MB.`)
      return
    }
    setFile(f)
    setErro('')
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelect({ target: { files: [f] } })
  }

  function fileToText(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsText(f, 'UTF-8')
    })
  }

  async function analisar() {
    setErro('')
    setDebug(null)
    setEstado('processing')

    try {
      if (!file) { setErro('Selecione um arquivo'); setEstado('idle'); return }
      const text = await fileToText(file)
      const body = { source: 'csv', csv_content: text }

      const res = await fetch('/api/analyze-guia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (!json.success) {
        setErro(json.error || 'Erro ao analisar a guia')
        if (json.debug) setDebug(json.debug)
        setEstado('idle')
        return
      }

      const data = json.data
      setObra({
        numero_guia: data.obra?.numero_guia || '',
        cliente: data.obra?.cliente || '',
        endereco: data.obra?.endereco || '',
        arquiteto: data.obra?.arquiteto || '',
      })
      const moveisComCheck = (data.moveis || []).map(m => ({
        codigo: m.codigo || '',
        ambiente: m.ambiente || '',
        nome: m.nome || '',
        descricao: m.descricao || '',
        dimensoes: m.dimensoes || '',
        acabamento_interno: m.acabamento_interno || '',
        acabamento_externo: m.acabamento_externo || '',
        incluido: m.incluido || '',
        nao_incluido: m.nao_incluido || '',
        quantidade: m.quantidade || 1,
        observacoes: m.observacoes || '',
        projeto_recebido: m.projeto_recebido || '',
        _incluir: true,
      }))
      setMoveis(moveisComCheck)

      if (moveisComCheck.length === 0) {
        setErro('A IA não conseguiu extrair nenhum item desta guia.')
      }

      setEstado('review')
    } catch (err) {
      setErro(err.message || 'Erro inesperado')
      setEstado('idle')
    }
  }

  async function importar() {
    setErro('')
    setImportando(true)

    try {
      // 1. Validar campos obrigatórios da obra
      if (!obra.numero_guia.trim()) throw new Error('Número da guia é obrigatório')
      if (!obra.cliente.trim()) throw new Error('Cliente é obrigatório')

      // 2. Verificar se já existe obra com esse código
      const { data: existente } = await supabase
        .from('obras')
        .select('id, codigo')
        .eq('codigo', obra.numero_guia.trim())
        .maybeSingle()
      if (existente) {
        if (confirm(`Já existe uma obra com código "${obra.numero_guia}". Ir para essa obra?`)) {
          navigate(`/obras/${existente.id}`)
          return
        }
        throw new Error('Cancele ou altere o número da guia para continuar.')
      }

      // 3. Criar obra
      const { data: { user } } = await supabase.auth.getUser()
      const { data: obraNova, error: e1 } = await supabase.from('obras').insert({
        codigo: obra.numero_guia.trim(),
        cliente: obra.cliente.trim(),
        endereco: obra.endereco.trim(),
        arquiteto: obra.arquiteto.trim(),
        status: 'ativa',
        user_id: user.id,
      }).select().single()
      if (e1) throw new Error(`Erro ao criar obra: ${e1.message}`)

      // 4. Criar móveis em lote
      const moveisIncluidos = moveis.filter(m => m._incluir)
      if (moveisIncluidos.length > 0) {
        const inserts = moveisIncluidos.map(m => ({
          obra_id: obraNova.id,
          codigo: m.codigo,
          ambiente: m.ambiente,
          nome: m.nome,
          descricao: m.descricao,
          dimensoes: m.dimensoes,
          acabamento_interno: m.acabamento_interno,
          acabamento_externo: m.acabamento_externo,
          incluido: m.incluido,
          nao_incluido: m.nao_incluido,
          quantidade: parseInt(m.quantidade) || 1,
          observacoes: m.observacoes,
          projeto_recebido: m.projeto_recebido,
        }))
        const { error: e2 } = await supabase.from('moveis').insert(inserts)
        if (e2) throw new Error(`Erro ao criar móveis: ${e2.message}`)
      }

      // 5. Sucesso → vai pra obra
      navigate(`/obras/${obraNova.id}`)
    } catch (err) {
      setErro(err.message)
      setImportando(false)
    }
  }

  function toggleExpandido(idx) {
    setExpandidos(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function updateMovel(idx, campo, valor) {
    setMoveis(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [campo]: valor }
      return next
    })
  }

  const incluidosCount = moveis.filter(m => m._incluir).length

  // ========== RENDER ==========

  if (estado === 'review') {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Revisar Guia Importada</h2>
          <p className="text-sm text-gray-500">
            Confira os dados extraídos pela IA. Edite se necessário antes de importar.
          </p>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {erro}
          </div>
        )}

        {/* Dados da obra */}
        <Card className="mb-4">
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 size={20} className="text-primary-600" /> Dados da Obra
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Número da Guia *"
                value={obra.numero_guia}
                onChange={e => setObra({ ...obra, numero_guia: e.target.value })}
                placeholder="695-2025"
                required
              />
              <Input
                label="Cliente *"
                value={obra.cliente}
                onChange={e => setObra({ ...obra, cliente: e.target.value })}
                placeholder="Nome do cliente"
                required
              />
              <Input
                label="Endereço da obra"
                value={obra.endereco}
                onChange={e => setObra({ ...obra, endereco: e.target.value })}
                placeholder="Onde os móveis serão instalados"
                className="md:col-span-2"
              />
              <Input
                label="Arquiteto(a)"
                value={obra.arquiteto}
                onChange={e => setObra({ ...obra, arquiteto: e.target.value })}
              />
            </div>
          </CardBody>
        </Card>

        {/* Lista de móveis */}
        <Card className="mb-4">
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Móveis ({incluidosCount} de {moveis.length})
              </h3>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setMoveis(moveis.map(m => ({ ...m, _incluir: true })))}
                  className="text-primary-600 hover:underline cursor-pointer"
                >
                  Marcar todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setMoveis(moveis.map(m => ({ ...m, _incluir: false })))}
                  className="text-gray-500 hover:underline cursor-pointer"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {moveis.map((m, idx) => (
                <MovelRow
                  key={idx}
                  movel={m}
                  expandido={!!expandidos[idx]}
                  onToggle={() => toggleExpandido(idx)}
                  onChange={(campo, valor) => updateMovel(idx, campo, valor)}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Ações */}
        <div className="flex justify-end gap-2 sticky bottom-0 bg-gray-50 py-3 border-t border-gray-200">
          <Btn variant="secondary" onClick={() => { setEstado('idle'); setErro('') }}>
            Cancelar
          </Btn>
          <Btn onClick={importar} disabled={importando || incluidosCount === 0}>
            {importando ? <><Loader2 size={16} className="animate-spin" /> Importando...</> : <><CheckCircle2 size={16} /> Importar ({incluidosCount} móveis)</>}
          </Btn>
        </div>
      </div>
    )
  }

  // ========== UPLOAD / IDLE / PROCESSING ==========

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Importar Guia Fechada</h2>
        <p className="text-sm text-gray-500">
          Faça upload do CSV/TSV exportado da planilha. A IA vai extrair a obra e os móveis automaticamente.
        </p>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={16} /> {erro}
          </div>
          {debug && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer hover:underline">Ver detalhes técnicos</summary>
              <div className="mt-2 space-y-1 font-mono">
                {debug.stopReason && <div><strong>stop_reason:</strong> {debug.stopReason}</div>}
                {debug.outputTokens && <div><strong>output_tokens:</strong> {debug.outputTokens}</div>}
                {debug.fullLength && <div><strong>length:</strong> {debug.fullLength}</div>}
                {debug.snippet && (
                  <div>
                    <strong>Início da resposta da IA:</strong>
                    <pre className="mt-1 p-2 bg-white border border-red-200 rounded overflow-x-auto whitespace-pre-wrap break-all">
                      {debug.snippet}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      <Card>
        <CardBody>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB · clique para trocar
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-700 font-medium">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV ou TSV · máximo 5 MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
            <p><strong>Como exportar do Google Sheets:</strong></p>
            <p>• <strong>CSV:</strong> Arquivo → Fazer download → <em>Valores separados por vírgula (.csv)</em></p>
            <p>• <strong>TSV (recomendado):</strong> Arquivo → Fazer download → <em>Valores separados por tabulação (.tsv)</em> — gera arquivo mais limpo</p>
          </div>

          <div className="mt-4 flex justify-end">
            <Btn
              onClick={analisar}
              disabled={estado === 'processing' || !file}
              size="lg"
            >
              {estado === 'processing' ? (
                <><Loader2 size={18} className="animate-spin" /> Analisando com IA...</>
              ) : (
                <><FileUp size={18} /> Analisar Guia</>
              )}
            </Btn>
          </div>

          {estado === 'processing' && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">Analisando documento...</p>
              <p className="text-xs">
                Pode levar até 90 segundos. A IA está lendo o documento e extraindo cliente, obra, arquiteto e todos os móveis.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function MovelRow({ movel, expandido, onToggle, onChange }) {
  return (
    <div className={`border rounded-lg transition-colors ${
      movel._incluir ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
    }`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          checked={movel._incluir}
          onChange={e => onChange('_incluir', e.target.checked)}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 cursor-pointer"
        />
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left cursor-pointer min-w-0"
        >
          {expandido ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
          <span className="font-mono font-semibold text-gray-900 text-sm shrink-0">{movel.codigo || '—'}</span>
          <span className="text-xs text-gray-500 shrink-0">{movel.ambiente}</span>
          <span className="text-sm text-gray-700 truncate">{movel.nome}</span>
        </button>
      </div>
      {expandido && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Input label="Código" value={movel.codigo} onChange={e => onChange('codigo', e.target.value)} />
            <Input label="Ambiente" value={movel.ambiente} onChange={e => onChange('ambiente', e.target.value)} />
            <Input label="Quantidade" type="number" min="1" value={movel.quantidade} onChange={e => onChange('quantidade', e.target.value)} />
          </div>
          <Input label="Nome (curto)" value={movel.nome} onChange={e => onChange('nome', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={movel.descricao}
              onChange={e => onChange('descricao', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Input label="Dimensões" value={movel.dimensoes} onChange={e => onChange('dimensoes', e.target.value)} placeholder="4,45x2,80m" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acabamento Interno</label>
              <textarea
                value={movel.acabamento_interno}
                onChange={e => onChange('acabamento_interno', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acabamento Externo</label>
              <textarea
                value={movel.acabamento_externo}
                onChange={e => onChange('acabamento_externo', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incluído</label>
              <textarea
                value={movel.incluido}
                onChange={e => onChange('incluido', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Não Incluído</label>
              <textarea
                value={movel.nao_incluido}
                onChange={e => onChange('nao_incluido', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <Input label="Projeto recebido" value={movel.projeto_recebido} onChange={e => onChange('projeto_recebido', e.target.value)} />
          <Input label="Observações" value={movel.observacoes} onChange={e => onChange('observacoes', e.target.value)} />
        </div>
      )}
    </div>
  )
}
