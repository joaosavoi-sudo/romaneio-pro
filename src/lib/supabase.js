import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Lança o primeiro `error` encontrado nos resultados de queries Supabase,
// para o try/catch da página tratar (evita falha silenciosa com tela vazia).
export function checarErros(...resultados) {
  for (const r of resultados) {
    if (r?.error) throw r.error
  }
}
