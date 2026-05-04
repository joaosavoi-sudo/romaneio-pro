import { useState, useEffect, useRef } from 'react'
import { ScanLine, ChevronRight, RotateCcw, Camera, Keyboard, Volume2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { proximaEtapa } from '../lib/constants'
import { Btn, Card, CardBody } from '../components/ui'
import StatusBadge from '../components/StatusBadge'

export default function Scanner() {
  const [modo, setModo] = useState('leitor') // 'leitor' ou 'camera'
  const [codigoInput, setCodigoInput] = useState('')
  const [peca, setPeca] = useState(null)
  const [obra, setObra] = useState(null)
  const [movel, setMovel] = useState(null)
  const [mensagem, setMensagem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [historico, setHistorico] = useState([])
  const inputRef = useRef()
  const scannerRef = useRef(null)

  useEffect(() => {
    if (modo === 'leitor') focusInput()
  }, [modo, peca])

  function focusInput() {
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function buscarPeca(codigoRaw) {
    const codigo = (codigoRaw || '').trim()
    if (!codigo) return
    setLoading(true)
    setMensagem(null)

    const { data, error } = await supabase
      .from('pecas')
      .select('*, romaneios(*, obras(*)), moveis(id, codigo, nome, ambiente)')
      .eq('codigo', codigo)
      .maybeSingle()

    if (error) {
      setPeca(null); setObra(null); setMovel(null)
      setMensagem({ tipo: 'erro', texto: `Erro: ${error.message}` })
      playBeep(false)
    } else if (data) {
      setPeca(data)
      setObra(data.romaneios?.obras || null)
      setMovel(data.moveis || null)
      setMensagem(null)
      playBeep(true)
    } else {
      setPeca(null); setObra(null); setMovel(null)
      setMensagem({ tipo: 'erro', texto: `Peça "${codigo}" não encontrada` })
      playBeep(false)
    }
    setLoading(false)
  }

  async function avancarEtapa() {
    if (!peca) return
    const proxima = proximaEtapa(peca.etapa)
    if (!proxima) {
      setMensagem({ tipo: 'info', texto: 'Peça já está na última etapa (Expedição)' })
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('peca_historico').insert({
      peca_id: peca.id,
      etapa_anterior: peca.etapa,
      etapa_nova: proxima.id,
      usuario: user?.email || 'desconhecido',
    })

    await supabase.from('pecas').update({
      etapa: proxima.id,
      updated_at: new Date().toISOString(),
    }).eq('id', peca.id)

    setHistorico(prev => [{
      codigo: peca.codigo,
      nome: peca.nome,
      de: peca.etapa,
      para: proxima.id,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev.slice(0, 19)])

    setMensagem({ tipo: 'sucesso', texto: `${peca.codigo} → ${proxima.label}` })
    playBeep(true)
    setPeca(null); setObra(null); setMovel(null)
    setCodigoInput('')
    setLoading(false)
    focusInput()
  }

  async function iniciarCamera() {
    setModo('camera')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {})
          scannerRef.current = null
          setModo('leitor')
          buscarPeca(decodedText)
        },
        () => {}
      )
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao acessar câmera: ' + err.message })
      setModo('leitor')
    }
  }

  function pararCamera() {
    scannerRef.current?.stop().catch(() => {})
    scannerRef.current = null
    setModo('leitor')
  }

  function handleInputSubmit(e) {
    e.preventDefault()
    buscarPeca(codigoInput)
  }

  function limpar() {
    setPeca(null); setObra(null); setMovel(null)
    setMensagem(null)
    setCodigoInput('')
    focusInput()
  }

  function playBeep(success) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = success ? 800 : 300
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + (success ? 0.15 : 0.4))
    } catch {}
  }

  const proxima = peca ? proximaEtapa(peca.etapa) : null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Scanner</h2>
        <p className="text-sm text-gray-500">Escaneie ou digite o código da peça para movimentar</p>
      </div>

      {/* Modo toggle */}
      <div className="flex gap-2 mb-4">
        <Btn
          variant={modo === 'leitor' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => { pararCamera(); setModo('leitor') }}
        >
          <Keyboard size={16} /> Leitor / Teclado
        </Btn>
        <Btn
          variant={modo === 'camera' ? 'primary' : 'secondary'}
          size="sm"
          onClick={iniciarCamera}
        >
          <Camera size={16} /> Câmera
        </Btn>
      </div>

      {/* Input do leitor USB / teclado */}
      {modo === 'leitor' && (
        <Card className="mb-4">
          <CardBody>
            <form onSubmit={handleInputSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={codigoInput}
                onChange={e => setCodigoInput(e.target.value)}
                placeholder="Escaneie ou digite o código (ex: PC-001)..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
                autoComplete="off"
              />
              <Btn type="submit" size="lg" disabled={loading || !codigoInput.trim()}>
                <ScanLine size={20} />
              </Btn>
            </form>
            <p className="text-xs text-gray-400 mt-2">
              Dica: o leitor USB age como teclado. Mantenha este campo focado e escaneie a etiqueta.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Câmera */}
      {modo === 'camera' && (
        <Card className="mb-4">
          <CardBody>
            <div id="qr-reader" className="rounded-lg overflow-hidden" />
            <Btn variant="secondary" onClick={pararCamera} className="mt-3 w-full">
              Parar câmera
            </Btn>
          </CardBody>
        </Card>
      )}

      {/* Mensagem de feedback */}
      {mensagem && (
        <div className={`mb-4 p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${
          mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-200' :
          mensagem.tipo === 'erro' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          <Volume2 size={16} />
          {mensagem.texto}
        </div>
      )}

      {/* Dados da peça escaneada */}
      {peca && (
        <Card className="mb-4 border-2 border-primary-200">
          <CardBody>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 font-mono">{peca.codigo}</h3>
                <p className="text-gray-700">{peca.nome}</p>
              </div>
              <StatusBadge etapa={peca.etapa} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <span className="text-gray-500">Dimensões:</span>
                <span className="ml-2 text-gray-900">{peca.largura}×{peca.altura}×{peca.profundidade}mm</span>
              </div>
              <div>
                <span className="text-gray-500">Material:</span>
                <span className="ml-2 text-gray-900">{peca.material}</span>
              </div>
              {peca.cor_acabamento && (
                <div>
                  <span className="text-gray-500">Acabamento:</span>
                  <span className="ml-2 text-gray-900">{peca.cor_acabamento}</span>
                </div>
              )}
              {movel && (
                <div>
                  <span className="text-gray-500">Móvel:</span>
                  <span className="ml-2 text-gray-900">{movel.codigo} — {movel.nome}</span>
                </div>
              )}
              {movel?.ambiente && (
                <div>
                  <span className="text-gray-500">Ambiente:</span>
                  <span className="ml-2 text-gray-900">{movel.ambiente}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Obra:</span>
                <span className="ml-2 text-gray-900">{obra?.cliente || '—'}</span>
              </div>
            </div>

            {/* Botão de avançar etapa */}
            {proxima ? (
              <Btn onClick={avancarEtapa} size="xl" className="w-full" disabled={loading}>
                Enviar para {proxima.label} <ChevronRight size={24} />
              </Btn>
            ) : (
              <div className="text-center py-3 bg-gray-50 rounded-lg text-gray-500">
                Peça já está na última etapa
              </div>
            )}

            <Btn variant="ghost" onClick={limpar} className="w-full mt-2" size="sm">
              <RotateCcw size={16} /> Escanear outra peça
            </Btn>
          </CardBody>
        </Card>
      )}

      {/* Histórico da sessão */}
      {historico.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Movimentações desta sessão ({historico.length})</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {historico.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-mono font-medium text-gray-900 w-20">{h.codigo}</span>
                  <span className="text-gray-500 flex-1 truncate">{h.nome}</span>
                  <StatusBadge etapa={h.de} />
                  <ChevronRight size={14} className="text-gray-400" />
                  <StatusBadge etapa={h.para} />
                  <span className="text-xs text-gray-400 w-12 text-right">{h.hora}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
