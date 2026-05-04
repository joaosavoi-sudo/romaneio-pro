-- =============================================
-- Romaneio Pro - Migração v3
-- Funções RPC para acesso público (sem login) das estações no chão de fábrica
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Buscar peça por código (read-only) - retorna dados completos
create or replace function buscar_peca_publico(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'id', p.id,
    'codigo', p.codigo,
    'nome', p.nome,
    'etapa', p.etapa,
    'largura', p.largura,
    'altura', p.altura,
    'profundidade', p.profundidade,
    'material', p.material,
    'cor_acabamento', p.cor_acabamento,
    'movel', case when m.id is not null then
      json_build_object('codigo', m.codigo, 'nome', m.nome, 'ambiente', m.ambiente)
    else null end,
    'obra', case when o.id is not null then
      json_build_object('codigo', o.codigo, 'cliente', o.cliente)
    else null end
  ) into result
  from pecas p
  left join moveis m on m.id = p.movel_id
  left join romaneios r on r.id = p.romaneio_id
  left join obras o on o.id = r.obra_id
  where p.codigo = p_codigo;

  return result;
end;
$$;

-- 2. Mover peça para uma etapa específica (insere histórico + atualiza)
create or replace function mover_peca_para_etapa(
  p_codigo text,
  p_etapa text,
  p_estacao text default 'estacao-mobile'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  peca_record pecas%rowtype;
  etapas_validas text[] := array['pre_montagem', 'romaneio', 'acabamento', 'conferencia', 'embalagem', 'expedicao'];
begin
  -- Validar etapa
  if not (p_etapa = any(etapas_validas)) then
    return json_build_object('success', false, 'error', 'Etapa inválida: ' || p_etapa);
  end if;

  -- Buscar peça
  select * into peca_record from pecas where codigo = p_codigo;

  if not found then
    return json_build_object('success', false, 'error', 'Peça não encontrada: ' || p_codigo);
  end if;

  -- Se já está na etapa, não faz nada (idempotente)
  if peca_record.etapa = p_etapa then
    return json_build_object(
      'success', true,
      'codigo', peca_record.codigo,
      'nome', peca_record.nome,
      'etapa_anterior', peca_record.etapa,
      'etapa_nova', p_etapa,
      'sem_mudanca', true
    );
  end if;

  -- Inserir no histórico
  insert into peca_historico (peca_id, etapa_anterior, etapa_nova, usuario)
  values (peca_record.id, peca_record.etapa, p_etapa, p_estacao);

  -- Atualizar peça
  update pecas
  set etapa = p_etapa, updated_at = now()
  where id = peca_record.id;

  return json_build_object(
    'success', true,
    'codigo', peca_record.codigo,
    'nome', peca_record.nome,
    'etapa_anterior', peca_record.etapa,
    'etapa_nova', p_etapa,
    'sem_mudanca', false
  );
end;
$$;

-- 3. Permitir anon (sem login) executar essas funções
grant execute on function buscar_peca_publico(text) to anon;
grant execute on function mover_peca_para_etapa(text, text, text) to anon;
