import { supabase } from './supabase'

// Gera os próximos códigos (ROM-001, PC-042, OBR-007...) no banco, via RPC.
// Baseado no maior número existente — não colide após exclusões nem em
// criação simultânea (migration v6.14). Lança em caso de erro.
export async function gerarProximosCodigos(tabela, prefixo, quantidade = 1) {
  const { data, error } = await supabase.rpc('gerar_proximos_codigos', {
    p_tabela: tabela,
    p_prefixo: prefixo,
    p_quantidade: quantidade,
  })
  if (error) throw error
  return data
}

// Criador único de romaneio, usado por ObraDetalhe e Romaneios.
// Retorna { data } em sucesso ou { error: mensagem } em falha.
export async function criarRomaneio(obraId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sua sessão expirou. Saia e entre novamente para continuar.' }

    let tentativas = 0
    while (true) {
      const [codigo] = await gerarProximosCodigos('romaneios', 'ROM', 1)
      const { data, error } = await supabase.from('romaneios')
        .insert({ codigo, obra_id: obraId, user_id: user.id })
        .select()
        .single()
      if (!error) return { data }
      // 23505 = código duplicado (corrida rara) — tenta uma vez com código novo
      if (error.code === '23505' && tentativas === 0) { tentativas++; continue }
      return { error: 'Erro ao criar romaneio: ' + error.message }
    }
  } catch (e) {
    return { error: 'Erro ao criar romaneio: ' + e.message }
  }
}
