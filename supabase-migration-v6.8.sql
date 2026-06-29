-- ============================================================================
-- Migration v6.8: Amostras (cor/laca, lâmina, madeira/tingimento, protótipo)
-- ============================================================================
-- Etapa prioritária: amostras feitas para aprovação do cliente/arquitetura, com
-- prazo (SLA), fórmula catalogada (código de tinta/tingimento), foto e localização
-- física — para a equipe de acabamento achar/reproduzir depois. Cada amostra
-- refere-se a 1+ itens da obra (amostra_itens).
-- ============================================================================

create table if not exists amostras (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  tipo text,                       -- cor_laca | lamina | madeira_tingimento | prototipo | outro
  titulo text not null,
  formula text,                    -- "fórmula": código de tinta/tingimento, receita
  status text not null default 'solicitada'
    check (status in ('solicitada','em_producao','enviada','aprovada','reprovada')),
  data_solicitacao date default current_date,
  prazo date,                      -- SLA (data limite)
  data_envio date,
  data_aprovacao date,
  responsavel text,
  localizacao_fisica text,         -- onde a amostra física está guardada
  fotos jsonb,                     -- [{ path, nome }] no bucket anexos-obra
  observacoes text,
  criado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_amostras_obra on amostras(obra_id);
create index if not exists idx_amostras_status on amostras(status);

-- Vínculo muitos-para-muitos: amostra ↔ itens (moveis)
create table if not exists amostra_itens (
  id uuid primary key default gen_random_uuid(),
  amostra_id uuid not null references amostras(id) on delete cascade,
  movel_id uuid not null references moveis(id) on delete cascade,
  unique (amostra_id, movel_id)
);
create index if not exists idx_amostra_itens_amostra on amostra_itens(amostra_id);
create index if not exists idx_amostra_itens_movel on amostra_itens(movel_id);

alter table amostras enable row level security;
alter table amostra_itens enable row level security;
do $$ begin
  -- amostras
  drop policy if exists "Autenticados veem amostras" on amostras;
  drop policy if exists "Autenticados inserem amostras" on amostras;
  drop policy if exists "Autenticados atualizam amostras" on amostras;
  drop policy if exists "Autenticados deletam amostras" on amostras;
  create policy "Autenticados veem amostras" on amostras for select to authenticated using (true);
  create policy "Autenticados inserem amostras" on amostras for insert to authenticated with check (true);
  create policy "Autenticados atualizam amostras" on amostras for update to authenticated using (true);
  create policy "Autenticados deletam amostras" on amostras for delete to authenticated using (true);
  -- amostra_itens
  drop policy if exists "Autenticados veem amostra_itens" on amostra_itens;
  drop policy if exists "Autenticados inserem amostra_itens" on amostra_itens;
  drop policy if exists "Autenticados deletam amostra_itens" on amostra_itens;
  create policy "Autenticados veem amostra_itens" on amostra_itens for select to authenticated using (true);
  create policy "Autenticados inserem amostra_itens" on amostra_itens for insert to authenticated with check (true);
  create policy "Autenticados deletam amostra_itens" on amostra_itens for delete to authenticated using (true);
end $$;
