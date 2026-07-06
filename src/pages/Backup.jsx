import { useState } from 'react'
import { DatabaseBackup, Download, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase, checarErros } from '../lib/supabase'
import { Btn, Card, CardBody } from '../components/ui'

// Todas as tabelas do sistema (na ordem de dependência, só para leitura)
const TABELAS = [
  'obras', 'romaneios', 'moveis', 'pecas', 'peca_historico',
  'pendencias', 'obra_marcos', 'obra_contatos', 'obra_prazo_ajustes',
  'amostras', 'amostra_itens', 'assistencias', 'equipe',
  'retrabalhos', 'reunioes',
]

// O Supabase limita cada consulta a 1000 linhas — busca em blocos até o fim
async function buscarTudo(tabela) {
  const CHUNK = 1000
  const linhas = []
  for (let de = 0; ; de += CHUNK) {
    const res = await supabase.from(tabela).select('*').order('id').range(de, de + CHUNK - 1)
    checarErros(res)
    linhas.push(...(res.data || []))
    if (!res.data || res.data.length < CHUNK) break
  }
  return linhas
}

export default function Backup() {
  const [gerando, setGerando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [resumo, setResumo] = useState(null) // { tabela: qtde }
  const [erro, setErro] = useState(null)

  async function gerarBackup() {
    setGerando(true)
    setErro(null)
    setResumo(null)
    try {
      const dados = {}
      const contagem = {}
      for (const tabela of TABELAS) {
        setProgresso(`Exportando ${tabela}...`)
        try {
          dados[tabela] = await buscarTudo(tabela)
          contagem[tabela] = dados[tabela].length
        } catch (e) {
          // tabela ainda não criada (migration pendente) — segue sem ela
          if (/does not exist/i.test(e.message || '')) continue
          throw e
        }
      }

      const hoje = new Date().toISOString().slice(0, 10)
      const backup = {
        sistema: 'romaneio-pro',
        gerado_em: new Date().toISOString(),
        tabelas: dados,
      }
      const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `romaneio-pro-backup-${hoje}.json`
      a.click()
      URL.revokeObjectURL(url)

      setResumo(contagem)
    } catch (e) {
      setErro(e.message)
    } finally {
      setGerando(false)
      setProgresso('')
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Backup dos Dados</h2>
        <p className="text-sm text-gray-500">Exporta todas as tabelas do sistema em um arquivo JSON</p>
      </div>

      <Card className="mb-4">
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary-50">
              <DatabaseBackup size={24} className="text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-1">
                O arquivo contém <strong>todas as obras, itens, peças, romaneios, pendências, cronogramas,
                comunicações, amostras, assistências e equipe</strong> — uma cópia completa dos dados do sistema.
              </p>
              <p className="text-sm text-gray-500">
                Guarde o arquivo em local seguro (ex.: Google Drive/OneDrive). Recomendado: gerar 1× por semana.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Btn onClick={gerarBackup} disabled={gerando}>
              <Download size={18} /> {gerando ? (progresso || 'Gerando...') : 'Baixar backup (JSON)'}
            </Btn>
          </div>
        </CardBody>
      </Card>

      {erro && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <span className="text-sm text-red-800">Falha ao gerar o backup: {erro}</span>
        </div>
      )}

      {resumo && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={20} className="text-primary-600" />
              <p className="font-medium text-gray-900">Backup gerado com sucesso</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {Object.entries(resumo).map(([tabela, qtde]) => (
                <div key={tabela} className="flex justify-between px-3 py-1.5 bg-gray-50 rounded">
                  <span className="text-gray-600">{tabela}</span>
                  <span className="font-medium text-gray-900">{qtde}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Observação: este backup cobre os dados das tabelas, mas não os arquivos anexados (fotos ficam no
        armazenamento do Supabase). No plano gratuito do Supabase não há backup automático do banco —
        este export é a sua cópia de segurança.
      </p>
    </div>
  )
}
