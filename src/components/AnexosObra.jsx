import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, FileText, Image, Download, Loader2, Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadAnexo, getSignedUrl, deleteAnexoStorage, isImage, isPdf, formatBytes } from '../lib/storage'
import { Btn, Card, CardBody, Select, Input } from './ui'

const CATEGORIAS = [
  { id: 'medicao', label: 'Medição' },
  { id: 'projeto', label: 'Projeto' },
  { id: 'amostra', label: 'Amostra' },
  { id: 'foto_obra', label: 'Foto da obra' },
  { id: 'documento', label: 'Documento' },
  { id: 'outro', label: 'Outro' },
]

export default function AnexosObra({ obraId }) {
  const [anexos, setAnexos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [erro, setErro] = useState('')
  const fileInputRef = useRef()

  useEffect(() => { loadAnexos() }, [obraId])

  async function loadAnexos() {
    const { data } = await supabase.from('anexos_obra')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })
    setAnexos(data || [])
    setLoading(false)
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    await uploadFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) uploadFiles(files)
  }

  async function uploadFiles(files) {
    setUploading(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const uploadedBy = user?.email || 'desconhecido'

    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          setErro(`${file.name} muito grande (máx 20 MB)`)
          continue
        }
        const meta = await uploadAnexo(obraId, file)
        const categoriaInicial = isImage(file.type) ? 'foto_obra' : isPdf(file.type) ? 'projeto' : 'documento'
        await supabase.from('anexos_obra').insert({
          obra_id: obraId,
          nome: file.name,
          categoria: categoriaInicial,
          storage_path: meta.storage_path,
          mime_type: meta.mime_type,
          tamanho_bytes: meta.tamanho_bytes,
          uploaded_by: uploadedBy,
        })
      }
      await loadAnexos()
    } catch (err) {
      setErro('Erro no upload: ' + err.message + ' (verifique se o bucket "anexos-obra" foi criado no Supabase)')
    }
    setUploading(false)
  }

  async function handleDelete(anexo) {
    if (!confirm(`Excluir "${anexo.nome}"?`)) return
    await deleteAnexoStorage(anexo.storage_path)
    await supabase.from('anexos_obra').delete().eq('id', anexo.id)
    loadAnexos()
  }

  async function handleDownload(anexo) {
    const url = await getSignedUrl(anexo.storage_path, 60)
    if (url) window.open(url, '_blank')
  }

  async function handleChangeCategoria(anexo, categoria) {
    await supabase.from('anexos_obra').update({ categoria }).eq('id', anexo.id)
    loadAnexos()
  }

  const filtered = filtroCategoria ? anexos.filter(a => a.categoria === filtroCategoria) : anexos

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-500">{anexos.length} anexo(s)</p>
        <div className="flex gap-2 items-end">
          <div className="w-48">
            <Select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              placeholder="Todas as categorias"
              options={CATEGORIAS.map(c => ({ value: c.id, label: c.label }))}
            />
          </div>
          <Btn onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : <><Upload size={16} /> Upload</>}
          </Btn>
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors mb-4"
      >
        <Upload size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-700">Arraste arquivos aqui ou clique para selecionar</p>
        <p className="text-xs text-gray-500 mt-1">Imagens, PDFs e documentos · até 20 MB cada</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <Paperclip size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhum anexo {filtroCategoria ? 'nessa categoria' : 'cadastrado'}</p>
        </CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(anexo => (
            <AnexoCard
              key={anexo.id}
              anexo={anexo}
              onDelete={() => handleDelete(anexo)}
              onDownload={() => handleDownload(anexo)}
              onChangeCategoria={cat => handleChangeCategoria(anexo, cat)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AnexoCard({ anexo, onDelete, onDownload, onChangeCategoria }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  const img = isImage(anexo.mime_type)
  const pdf = isPdf(anexo.mime_type)

  useEffect(() => {
    if (img) {
      getSignedUrl(anexo.storage_path, 3600).then(setThumbUrl)
    }
  }, [anexo.storage_path, img])

  const Icon = img ? Image : pdf ? FileText : Paperclip

  return (
    <Card>
      <div
        className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer rounded-t-xl"
        onClick={onDownload}
      >
        {img && thumbUrl ? (
          <img src={thumbUrl} alt={anexo.nome} className="w-full h-full object-cover" />
        ) : (
          <Icon size={48} className="text-gray-300" />
        )}
      </div>
      <CardBody className="text-sm">
        <p className="font-medium text-gray-900 truncate" title={anexo.nome}>{anexo.nome}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatBytes(anexo.tamanho_bytes)} · {new Date(anexo.created_at).toLocaleDateString('pt-BR')}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={anexo.categoria || 'outro'}
            onChange={e => onChangeCategoria(e.target.value)}
            className="text-xs rounded border border-gray-200 px-1.5 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={onDownload} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded cursor-pointer" title="Abrir/Download"><Download size={14} /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Excluir"><Trash2 size={14} /></button>
        </div>
      </CardBody>
    </Card>
  )
}
