import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Tag, Save, Copy, Printer, Pencil, Box } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MATERIAIS, gerarCodigo } from '../lib/constants'
import { Btn, Input, Select, Card, CardBody, Modal } from '../components/ui'
import StatusBadge from '../components/StatusBadge'
import ResponsavelInput from '../components/ResponsavelInput'

const EMPTY_PECA = {
  nome: '', largura: '', altura: '', profundidade: '',
  material: 'MDF', cor_acabamento: '', quantidade: 1, observacoes: '',
  movel_id: '',
}

export default function RomaneioEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [romaneio, setRomaneio] = useState(null)
  const [obra, setObra] = useState(null)
  const [pecas, setPecas] = useState([])
  const [moveis, setMoveis] = useState([])  // móveis da OBRA (não do romaneio)
  const [loading, setLoading] = useState(true)

  const [pecaModalOpen, setPecaModalOpen] = useState(false)
  const [editingPeca, setEditingPeca] = useState(null)
  const [pecaForm, setPecaForm] = useState({ ...EMPTY_PECA })

  const [obs, setObs] = useState('')
  const [marceneiro, setMarceneiro] = useState('')
  const [responsavel, setResponsavel] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: rom } = await supabase.from('romaneios').select('*, obras(*)').eq('id', id).single()
    if (rom) {
      setRomaneio(rom)
      setObra(rom.obras)
      setObs(rom.observacoes || '')
      setMarceneiro(rom.marceneiro || '')
      setResponsavel(rom.responsavel || '')

      // Móveis vêm da obra (não do romaneio)
      const [pecasRes, moveisRes] = await Promise.all([
        supabase.from('pecas').select('*, moveis(id, codigo, nome, ambiente)').eq('romaneio_id', id).order('created_at', { ascending: true }),
        supabase.from('moveis').select('*').eq('obra_id', rom.obras.id).order('codigo', { ascending: true }),
      ])
      setPecas(pecasRes.data || [])
      setMoveis(moveisRes.data || [])
    }
    setLoading(false)
  }

  async function handleSavePeca(e) {
    e.preventDefault()
    const qty = parseInt(pecaForm.quantidade) || 1
    const movelId = pecaForm.movel_id || null

    if (editingPeca) {
      await supabase.from('pecas').update({
        nome: pecaForm.nome,
        largura: parseFloat(pecaForm.largura) || 0,
        altura: parseFloat(pecaForm.altura) || 0,
        profundidade: parseFloat(pecaForm.profundidade) || 0,
        material: pecaForm.material,
        cor_acabamento: pecaForm.cor_acabamento,
        quantidade: qty,
        observacoes: pecaForm.observacoes,
        movel_id: movelId,
        updated_at: new Date().toISOString(),
      }).eq('id', editingPeca.id)
    } else {
      const { count } = await supabase.from('pecas').select('id', { count: 'exact', head: true })
      const baseCodigo = (count || 0) + 1
      const inserts = []
      for (let i = 0; i < qty; i++) {
        inserts.push({
          romaneio_id: id,
          codigo: gerarCodigo('PC', baseCodigo + i),
          nome: pecaForm.nome,
          largura: parseFloat(pecaForm.largura) || 0,
          altura: parseFloat(pecaForm.altura) || 0,
          profundidade: parseFloat(pecaForm.profundidade) || 0,
          material: pecaForm.material,
          cor_acabamento: pecaForm.cor_acabamento,
          quantidade: 1,
          etapa: 'romaneio',
          observacoes: pecaForm.observacoes,
          movel_id: movelId,
        })
      }
      await supabase.from('pecas').insert(inserts)
    }
    setPecaModalOpen(false)
    setEditingPeca(null)
    setPecaForm({ ...EMPTY_PECA })
    loadData()
  }

  async function deletePeca(pecaId) {
    if (!confirm('Excluir esta peça?')) return
    await supabase.from('pecas').delete().eq('id', pecaId)
    loadData()
  }

  async function duplicarPeca(peca) {
    const { count } = await supabase.from('pecas').select('id', { count: 'exact', head: true })
    const codigo = gerarCodigo('PC', (count || 0) + 1)
    await supabase.from('pecas').insert({
      romaneio_id: id,
      codigo,
      nome: peca.nome,
      largura: peca.largura,
      altura: peca.altura,
      profundidade: peca.profundidade,
      material: peca.material,
      cor_acabamento: peca.cor_acabamento,
      quantidade: 1,
      etapa: 'romaneio',
      observacoes: peca.observacoes,
      movel_id: peca.movel_id,
    })
    loadData()
  }

  async function salvarCabecalho() {
    await supabase.from('romaneios').update({
      observacoes: obs,
      marceneiro,
      responsavel,
    }).eq('id', id)
  }

  function openEditPeca(peca) {
    setEditingPeca(peca)
    setPecaForm({
      nome: peca.nome,
      largura: peca.largura,
      altura: peca.altura,
      profundidade: peca.profundidade,
      material: peca.material,
      cor_acabamento: peca.cor_acabamento || '',
      quantidade: peca.quantidade || 1,
      observacoes: peca.observacoes || '',
      movel_id: peca.movel_id || '',
    })
    setPecaModalOpen(true)
  }

  function openNewPeca() {
    setEditingPeca(null)
    setPecaForm({ ...EMPTY_PECA })
    setPecaModalOpen(true)
  }

  if (loading) return <p className="text-center text-gray-500 py-12">Carregando...</p>
  if (!romaneio) return <p className="text-center text-red-500 py-12">Romaneio não encontrado</p>

  // Agrupar peças por móvel
  const pecasSemMovel = pecas.filter(p => !p.movel_id)
  const moveisComPecas = moveis.map(m => ({
    ...m,
    pecas: pecas.filter(p => p.movel_id === m.id),
  })).filter(m => m.pecas.length > 0)

  return (
    <div>
      <button onClick={() => navigate(`/obras/${obra?.id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Voltar para {obra?.codigo}
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{romaneio.codigo}</h2>
          <p className="text-sm text-gray-500">
            Obra: {obra?.codigo} — {obra?.cliente} — {pecas.length} peça(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={() => navigate(`/romaneio/${id}/imprimir`)}>
            <Printer size={18} /> Imprimir Romaneio
          </Btn>
          <Btn variant="secondary" onClick={() => navigate(`/etiquetas?romaneio=${id}`)}>
            <Tag size={18} /> Etiquetas
          </Btn>
          <Btn onClick={openNewPeca}>
            <Plus size={18} /> Nova Peça
          </Btn>
        </div>
      </div>

      {/* Cabeçalho do romaneio - responsáveis */}
      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ResponsavelInput
              label="Marceneiro responsável"
              value={marceneiro}
              onChange={e => setMarceneiro(e.target.value)}
              onBlur={salvarCabecalho}
              placeholder="Nome do marceneiro"
            />
            <ResponsavelInput
              label="Responsável pelo romaneio"
              value={responsavel}
              onChange={e => setResponsavel(e.target.value)}
              onBlur={salvarCabecalho}
              placeholder="Quem montou o romaneio"
            />
            <Input
              label="Observações"
              value={obs}
              onChange={e => setObs(e.target.value)}
              onBlur={salvarCabecalho}
              placeholder="Notas gerais..."
            />
          </div>
        </CardBody>
      </Card>

      {/* Aviso se a obra não tem móveis cadastrados */}
      {moveis.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <Box size={16} />
          Esta obra não tem itens cadastrados. As peças serão criadas avulsas. Para vincular peças aos itens, cadastre os itens primeiro em <button onClick={() => navigate(`/obras/${obra.id}`)} className="underline cursor-pointer">{obra?.codigo}</button>.
        </div>
      )}

      {/* Peças agrupadas por móvel */}
      {moveisComPecas.length === 0 && pecasSemMovel.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-gray-500 mb-4">Nenhuma peça cadastrada neste romaneio</p>
            <Btn onClick={openNewPeca} size="sm"><Plus size={16} /> Adicionar peça</Btn>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {moveisComPecas.map(movel => (
            <Card key={movel.id}>
              <div className="px-4 py-3 bg-blue-50 border-b border-gray-100 flex items-center gap-2">
                <Box size={18} className="text-blue-600" />
                <span className="font-semibold text-gray-900">{movel.codigo}</span>
                <span className="text-gray-700">— {movel.nome}</span>
                {movel.ambiente && <span className="text-gray-500 text-sm">({movel.ambiente})</span>}
                <span className="text-xs text-gray-400 ml-auto">{movel.pecas.length} peça(s)</span>
              </div>
              <PecasTable
                pecas={movel.pecas}
                onEdit={openEditPeca}
                onDelete={deletePeca}
                onDuplicar={duplicarPeca}
              />
            </Card>
          ))}

          {pecasSemMovel.length > 0 && (
            <Card>
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-medium text-gray-700">Peças avulsas ({pecasSemMovel.length})</h3>
              </div>
              <PecasTable
                pecas={pecasSemMovel}
                onEdit={openEditPeca}
                onDelete={deletePeca}
                onDuplicar={duplicarPeca}
              />
            </Card>
          )}
        </div>
      )}

      {/* Modal de peça */}
      <Modal open={pecaModalOpen} onClose={() => setPecaModalOpen(false)} title={editingPeca ? 'Editar Peça' : 'Nova Peça'} size="lg">
        <form onSubmit={handleSavePeca} className="space-y-4">
          <Select
            label={`Item ${moveis.length > 0 ? '(da obra)' : '(nenhum cadastrado)'}`}
            value={pecaForm.movel_id}
            onChange={e => setPecaForm({ ...pecaForm, movel_id: e.target.value })}
            placeholder="Sem item / avulsa"
            options={moveis.map(m => ({ value: m.id, label: `${m.codigo} — ${m.nome}${m.ambiente ? ' (' + m.ambiente + ')' : ''}` }))}
          />

          <Input label="Nome / Descrição *" value={pecaForm.nome} onChange={e => setPecaForm({ ...pecaForm, nome: e.target.value })} placeholder="Ex: Porta Cozinha Superior" required />

          <div className="grid grid-cols-3 gap-3">
            <Input label="Largura (mm)" type="number" value={pecaForm.largura} onChange={e => setPecaForm({ ...pecaForm, largura: e.target.value })} placeholder="600" />
            <Input label="Altura (mm)" type="number" value={pecaForm.altura} onChange={e => setPecaForm({ ...pecaForm, altura: e.target.value })} placeholder="800" />
            <Input label="Profundidade (mm)" type="number" value={pecaForm.profundidade} onChange={e => setPecaForm({ ...pecaForm, profundidade: e.target.value })} placeholder="18" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Material" value={pecaForm.material} onChange={e => setPecaForm({ ...pecaForm, material: e.target.value })} options={MATERIAIS} />
            <Input label="Cor / Acabamento" value={pecaForm.cor_acabamento} onChange={e => setPecaForm({ ...pecaForm, cor_acabamento: e.target.value })} placeholder="Branco TX" />
          </div>

          {!editingPeca && (
            <Input label="Quantidade" type="number" min="1" value={pecaForm.quantidade} onChange={e => setPecaForm({ ...pecaForm, quantidade: e.target.value })} />
          )}

          <Input label="Observações" value={pecaForm.observacoes} onChange={e => setPecaForm({ ...pecaForm, observacoes: e.target.value })} placeholder="Notas..." />

          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="secondary" onClick={() => setPecaModalOpen(false)}>Cancelar</Btn>
            <Btn type="submit">{editingPeca ? 'Salvar' : `Adicionar ${pecaForm.quantidade > 1 ? pecaForm.quantidade + ' peças' : 'peça'}`}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function PecasTable({ pecas, onEdit, onDelete, onDuplicar }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Dimensões</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Material</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Cor/Acab.</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Etapa</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pecas.map(peca => (
            <tr key={peca.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-medium text-gray-900">{peca.codigo}</td>
              <td className="px-4 py-3 text-gray-700">{peca.nome}</td>
              <td className="px-4 py-3 text-gray-500">{peca.largura}×{peca.altura}×{peca.profundidade}</td>
              <td className="px-4 py-3 text-gray-500">{peca.material}</td>
              <td className="px-4 py-3 text-gray-500">{peca.cor_acabamento || '—'}</td>
              <td className="px-4 py-3"><StatusBadge etapa={peca.etapa} /></td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(peca)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded cursor-pointer" title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDuplicar(peca)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="Duplicar">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => onDelete(peca.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
