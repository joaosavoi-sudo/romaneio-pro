import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Carrega os membros ativos da equipe (lista canônica de responsáveis).
// Leve o suficiente para buscar quando um modal/tela abre — sempre fresco.
export default function useEquipe() {
  const [membros, setMembros] = useState([])

  useEffect(() => {
    let active = true
    supabase
      .from('equipe')
      .select('id, nome, papel')
      .eq('ativo', true)
      .order('nome', { ascending: true })
      .then(({ data }) => {
        if (active) setMembros(data || [])
      })
    return () => { active = false }
  }, [])

  return { membros, nomes: membros.map(m => m.nome) }
}
