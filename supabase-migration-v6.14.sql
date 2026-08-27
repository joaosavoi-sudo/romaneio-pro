-- ============================================================================
-- Migration v6.14: Geração de códigos à prova de exclusões (ROM/PC/OBR)
-- ============================================================================
-- Corrige: "Novo Romaneio" falhava em silêncio depois que algum romaneio era
-- excluído. O código era gerado no navegador por COUNT(*)+1 e colidia com um
-- código já existente (a coluna `codigo` é única) — o banco rejeitava e a tela
-- da obra descartava o erro.
-- Esta função gera o próximo código no banco, baseada no MAIOR número já usado
-- (sobrevive a exclusões) e com lock (sobrevive a dois usuários criando ao
-- mesmo tempo). Serve romaneios (ROM), peças (PC) e obras (OBR).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

create or replace function gerar_proximos_codigos(
  p_tabela text,
  p_prefixo text,
  p_quantidade integer default 1
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
begin
  if p_tabela not in ('romaneios', 'pecas', 'obras') then
    raise exception 'Tabela não permitida: %', p_tabela;
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 500 then
    raise exception 'Quantidade inválida';
  end if;

  -- Serializa a geração por tabela+prefixo (evita corrida entre dois usuários)
  perform pg_advisory_xact_lock(hashtext(p_tabela || ':' || p_prefixo));

  -- Maior número já usado no padrão PREFIXO-999
  execute format(
    'select coalesce(max((substring(codigo from length($1) + 2))::int), 0)
       from %I
      where codigo like $1 || ''-%%''
        and substring(codigo from length($1) + 2) ~ ''^\d+$''',
    p_tabela
  ) into v_max using p_prefixo;

  -- greatest(3, ...): lpad do Postgres TRUNCA acima de 999, diferente do JS
  return (
    select array_agg(p_prefixo || '-' || lpad((v_max + g)::text,
                     greatest(3, length((v_max + g)::text)), '0'))
    from generate_series(1, p_quantidade) g
  );
end;
$$;

grant execute on function gerar_proximos_codigos(text, text, integer) to authenticated;
