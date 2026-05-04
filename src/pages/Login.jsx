import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Btn, Input } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      if (isSignUp) {
        setError('')
        alert('Conta criada! Verifique seu email para confirmar.')
        setIsSignUp(false)
      } else {
        navigate('/')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <ClipboardList size={32} className="text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Romaneio Pro</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão de romaneio e etiquetagem</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isSignUp ? 'Criar conta' : 'Entrar'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              label="Senha"
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              minLength={6}
            />
            <Btn type="submit" disabled={loading} className="w-full">
              {loading ? 'Carregando...' : isSignUp ? 'Criar conta' : 'Entrar'}
            </Btn>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              className="text-sm text-primary-600 hover:text-primary-700 cursor-pointer"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
