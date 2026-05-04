-- =============================================
-- Romaneio Pro - Migração v2
-- Adiciona: marceneiro/responsável no romaneio,
-- tabela de móveis (agrupamento de peças por contrato)
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Campos no romaneio (responsáveis)
alter table romaneios add column if not exists marceneiro text;
alter table romaneios add column if not exists responsavel text;

-- 2. Tabela de móveis (agrupamento das peças por item de contrato)
create table if not exists moveis (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null references romaneios(id) on delete cascade,
  codigo text not null,            -- ex: "3.2" ou "M01" (referência do contrato)
  nome text not null,              -- ex: "Armário Superior Cozinha"
  ambiente text,                   -- ex: "Cozinha"
  created_at timestamptz default now()
);

create index if not exists idx_moveis_romaneio on moveis(romaneio_id);

alter table moveis enable row level security;

drop policy if exists "Autenticados podem ver moveis" on moveis;
drop policy if exists "Autenticados podem inserir moveis" on moveis;
drop policy if exists "Autenticados podem atualizar moveis" on moveis;
drop policy if exists "Autenticados podem deletar moveis" on moveis;

create policy "Autenticados podem ver moveis" on moveis for select to authenticated using (true);
create policy "Autenticados podem inserir moveis" on moveis for insert to authenticated with check (true);
create policy "Autenticados podem atualizar moveis" on moveis for update to authenticated using (true);
create policy "Autenticados podem deletar moveis" on moveis for delete to authenticated using (true);

-- 3. Coluna movel_id na tabela de peças (opcional - peça pode estar sem móvel)
alter table pecas add column if not exists movel_id uuid references moveis(id) on delete set null;
create index if not exists idx_pecas_movel on pecas(movel_id);
