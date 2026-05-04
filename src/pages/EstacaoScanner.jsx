import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Check, X, ArrowLeft, Loader2, Undo2, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ESTACAO_MAP, ETAPAS } from '../lib/constants'
import { feedbackSuccess, feedbackError } from '../lib/feedback'

const COOLDOWN_MS = 2000      // tempo de exibição do feedback antes de voltar a escanear
const UNDO_TIMEOUT_MS = 5000  // tempo do botão "desfazer" disponível

export default function EstacaoScanner() {
  const { nome } = useParams()
  const estacao = ESTACAO_MAP[nome]

  const [status, setStatus] = useState('idle') // idle | success | error | processing
  const [info, setInfo] = useState(null)        // { codigo, nome, etapa_anterior, sem_mudanca }
  const [erroMsg, setErroMsg] = useState('')
  const [contador, setContador] = useState(0)   // total escaneado na sessão
  const [undoTimer, setUndoTimer] = useState(0) // segundos restantes do undo

  const scannerRef = useRef(null)
  const lastScanRef = useRef({ codigo: null, ts: 0 }) // anti-duplicado
  const undoIntervalRef = useRef(null)

  if (!estacao) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center max-w-sm">
          <X size={64} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Estação inválida</h1>
          <p className="text-sm text-gray-500 mb-6">
            "{nome}" não é uma estação válida.
          </p>
          <Link to="/estacao" className="text-primary-600 hover:underline">
            Ver estações disponíveis
          </Link>
        </div>
      </div>
    )
  }

  useEffect(() => {
    iniciarCamera()
    return () => pararCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function iniciarCamera() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader-estacao')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        handleScan,
        () => {}
      )
    } catch (err) {
      setStatus('error')
      setErroMsg('Erro ao acessar câmera: ' + err.message)
    }
  }

  function pararCamera() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current)
      undoIntervalRef.current = null
    }
  }

  async function handleScan(codigoLido) {
    const codigo = (codigoLido || '').trim()
    if (!codigo) return

    // Anti-duplicado: ignora mesmo código por 2s
    const agora = Date.now()
    if (codigo === lastScanRef.current.codigo && agora - lastScanRef.current.ts < COOLDOWN_MS) {
      return
    }
    lastScanRef.current = { codigo, ts: agora }

    // Bloqueia novos scans enquanto processa/exibe feedback
    if (status !== 'idle') return

    setStatus('processing')
    setInfo(null)
    setErroMsg('')

    const { data, error } = await supabase.rpc('mover_peca_para_etapa', {
      p_codigo: codigo,
      p_etapa: estacao.etapa,
      p_estacao: `estacao-${estacao.slug}`,
    })

    if (error) {
      setStatus('error')
      setErroMsg(error.message)
      feedbackError()
      setTimeout(() => setStatus('idle'), COOLDOWN_MS)
      return
    }

    if (!data?.success) {
      setStatus('error')
      setErroMsg(data?.error || 'Erro desconhecido')
      feedbackError()
      setTimeout(() => setStatus('idle'), COOLDOWN_MS)
      return
    }

    setInfo(data)
    setStatus('success')
    setContador(c => c + 1)
    feedbackSuccess()

    // Inicia janela de undo
    setUndoTimer(Math.floor(UNDO_TIMEOUT_MS / 1000))
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current)
    undoIntervalRef.current = setInterval(() => {
      setUndoTimer(t => {
        if (t <= 1) {
          clearInterval(undoIntervalRef.current)
          undoIntervalRef.current = null
          return 0
        }
        return t - 1
      })
    }, 1000)

    setTimeout(() => setStatus('idle'), COOLDOWN_MS)
  }

  async function handleUndo() {
    if (!info || !info.etapa_anterior) return
    setStatus('processing')

    const { data } = await supabase.rpc('mover_peca_para_etapa', {
      p_codigo: info.codigo,
      p_etapa: info.etapa_anterior,
      p_estacao: `estacao-${estacao.slug}-undo`,
    })

    if (data?.success) {
      setUndoTimer(0)
      if (undoIntervalRef.current) {
        clearInterval(undoIntervalRef.current)
        undoIntervalRef.current = null
      }
      setContador(c => Math.max(0, c - 1))
      lastScanRef.current = { codigo: null, ts: 0 } // permite rescan imediato
    }
    setStatus('idle')
  }

  const corPrimaria = estacao.cor

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ backgroundColor: corPrimaria }}
      >
        <Link to="/estacao" className="p-2 -ml-2 cursor-pointer">
          <ArrowLeft size={24} />
        </Link>
        <div className="text-center">
          <div className="text-xs uppercase opacity-80">Estação</div>
          <div className="text-lg font-bold uppercase tracking-wide">{estacao.label}</div>
        </div>
        <div className="text-center min-w-[3rem]">
          <div className="text-xs uppercase opacity-80">Hoje</div>
          <div className="text-lg font-bold">{contador}</div>
        </div>
      </header>

      {/* Câmera */}
      <div className="relative flex-1 bg-black overflow-hidden">
        <div id="qr-reader-estacao" className="w-full h-full" />

        {/* Overlay de feedback - SUCESSO */}
        {status === 'success' && info && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-white animate-pulse-once"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.95)' }}
          >
            <Check size={120} strokeWidth={3} />
            <div className="text-3xl font-bold mt-4 font-mono">{info.codigo}</div>
            <div className="text-lg opacity-90 mt-1 px-6 text-center">{info.nome}</div>
            {info.sem_mudanca ? (
              <div className="mt-3 text-sm bg-white/20 px-3 py-1 rounded-full">
                Já estava em {estacao.label}
              </div>
            ) : (
              <div className="mt-3 text-sm bg-white/20 px-3 py-1 rounded-full">
                {ETAPAS.find(e => e.id === info.etapa_anterior)?.label || info.etapa_anterior} → {estacao.label}
              </div>
            )}
          </div>
        )}

        {/* Overlay de feedback - ERRO */}
        {status === 'error' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-white"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.95)' }}
          >
            <X size={120} strokeWidth={3} />
            <div className="text-xl font-semibold mt-4 px-6 text-center">{erroMsg}</div>
          </div>
        )}

        {/* Overlay processing */}
        {status === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={64} className="animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 bg-gray-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Camera size={16} className="text-gray-400" />
          <span className="text-gray-300">Aponte para o QR Code da peça</span>
        </div>
        {undoTimer > 0 && info && !info.sem_mudanca && (
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium cursor-pointer"
          >
            <Undo2 size={16} />
            Desfazer ({undoTimer}s)
          </button>
        )}
      </footer>

      <style>{`
        @keyframes pulse-once {
          0% { opacity: 0; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-pulse-once {
          animation: pulse-once 0.3s ease-out;
        }
        #qr-reader-estacao video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #qr-reader-estacao > div:first-child {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  )
}
