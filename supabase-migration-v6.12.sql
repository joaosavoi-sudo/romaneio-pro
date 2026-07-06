-- ============================================================================
-- Migration v6.12: KPIs do Modelo Ouro (NPS, retrabalho, conclusão) + reuniões
-- ============================================================================
-- Base do painel de KPIs e da Reunião Semanal (Modelo Ouro — Seções 7 e 9):
--   1) obras: NPS pós-obra + data de conclusão real (KPI de entregas no prazo
--      e lead time)
--   2) retrabalhos: eventos de retrabalho de peças (KPI taxa de retrabalho)
--   3) RPC registrar_retrabalho: estação móvel de Retrabalho no chão de
--      fábrica (sem login), no mesmo padrão de mover_peca_para_etapa (v3)
--   4) reunioes: atas da Reunião Semanal de Alinhamento (UI no sprint B)
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- 1) obras: NPS + data de conclusão real
alter table obras add column if not exists nps numeric check (nps >= 0 and nps <= 10);
alter table obras add column if not exists nps_data date;
alter table obras add column if not exists nps_observacao text;
alter table obras add column if not exists nps_por text;
alter table obras add column if not exists data_conclusao date;

-- 2) Eventos de retrabalho (uma linha por ocorrência; quantidade = nº de peças)
create table if not exists retrabalhos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  movel_id uuid references moveis(id) on delete set null,
  peca_id uuid references pecas(id) on delete set null,
  assistencia_id uuid references assistencias(id) on delete set null,
  quantidade integer not null default 1,
  motivo text,
  origem text not null default 'producao'
    check (origem in ('producao', 'montagem', 'assistencia', 'estacao')),
  data date not null default current_date,
  registrado_por text,
  created_at timestamptz default now()
);
create index if not exists idx_retrabalhos_obra on retrabalhos(obra_id);
create index if not exists idx_retrabalhos_peca on retrabalhos(peca_id);
create index if not exists idx_retrabalhos_data on retrabalhos(data);

alter table retrabalhos enable row level security;
do $$ begin
  drop policy if exists "Autenticados veem retrabalhos" on retrabalhos;
  drop policy if exists "Autenticados inserem retrabalhos" on retrabalhos;
  drop policy if exists "Autenticados atualizam retrabalhos" on retrabalhos;
  drop policy if exists "Autenticados deletam retrabalhos" on retrabalhos;
  create policy "Autenticados veem retrabalhos" on retrabalhos for select to authenticated using (true);
  create policy "Autenticados inserem retrabalhos" on retrabalhos for insert to authenticated with check (true);
  create policy "Autenticados atualizam retrabalhos" on retrabalhos for update to authenticated using (true);
  create policy "Autenticados deletam retrabalhos" on retrabalhos for delete to authenticated using (true);
end $$;

-- 3) RPC para a estação móvel de Retrabalho: registra o evento e devolve a
--    peça para a etapa 'romaneio' (reinício do fluxo de fábrica)
create or replace function registrar_retrabalho(
  p_codigo text,
  p_estacao text default 'estacao-retrabalho'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  peca_record pecas%rowtype;
  v_obra_id uuid;
begin
  select * into peca_record from pecas where codigo = p_codigo;

  if not found then
    return json_build_object('success', false, 'error', 'Peça não encontrada: ' || p_codigo);
  end if;

  select r.obra_id into v_obra_id from romaneios r where r.id = peca_record.romaneio_id;

  insert into retrabalhos (obra_id, movel_id, peca_id, quantidade, origem, registrado_por)
  values (v_obra_id, peca_record.movel_id, peca_record.id, 1, 'estacao', p_estacao);

  -- devolve a peça para o início do fluxo (se já tinha avançado)
  if peca_record.etapa <> 'romaneio' then
    insert into peca_historico (peca_id, etapa_anterior, etapa_nova, usuario)
    values (peca_record.id, peca_record.etapa, 'romaneio', p_estacao);

    update pecas set etapa = 'romaneio', updated_at = now() where id = peca_record.id;
  end if;

  return json_build_object(
    'success', true,
    'codigo', peca_record.codigo,
    'nome', peca_record.nome,
    'etapa_anterior', peca_record.etapa,
    'etapa_nova', 'romaneio',
    'sem_mudanca', false
  );
end;
$$;

grant execute on function registrar_retrabalho(text, text) to anon;

-- 4) Atas da Reunião Semanal de Alinhamento (Modelo Ouro — Seção 7.1)
create table if not exists reunioes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'semanal',
  data date not null default current_date,
  semana_inicio date,              -- segunda-feira da semana da pauta
  semana_fim date,
  participantes text,
  pauta jsonb,                     -- snapshot: [{ id, titulo, linhas, anotacoes }]
  decisoes text,                   -- decisões e encaminhamentos gerais
  criado_por text,
  created_at timestamptz default now()
);
create index if not exists idx_reunioes_data on reunioes(data);

alter table reunioes enable row level security;
do $$ begin
  drop policy if exists "Autenticados veem reunioes" on reunioes;
  drop policy if exists "Autenticados inserem reunioes" on reunioes;
  drop policy if exists "Autenticados atualizam reunioes" on reunioes;
  drop policy if exists "Autenticados deletam reunioes" on reunioes;
  create policy "Autenticados veem reunioes" on reunioes for select to authenticated using (true);
  create policy "Autenticados inserem reunioes" on reunioes for insert to authenticated with check (true);
  create policy "Autenticados atualizam reunioes" on reunioes for update to authenticated using (true);
  create policy "Autenticados deletam reunioes" on reunioes for delete to authenticated using (true);
end $$;
