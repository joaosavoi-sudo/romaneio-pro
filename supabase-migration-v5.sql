-- =============================================
-- Romaneio Pro - Migração v5
-- Modelo "Ouro" de Gestão de Obras
-- - Cronograma de marcos (obra_marcos)
-- - Pendências (pendencias)
-- - Anexos (anexos_obra) + bucket Storage
-- - Campos novos em obras (construtora, datas, próximos passos)
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Cronograma de marcos da obra
create table if not exists obra_marcos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  fase text not null check (fase in ('pre_producao', 'producao', 'pos_producao')),
  marco text not null,
  ordem integer not null default 0,
  data_alvo date,
  data_concluido date,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'atrasado')),
  responsavel text,
  observacoes text,
  created_at timestamptz default now()
);
create index if not exists idx_marcos_obra on obra_marcos(obra_id);
create index if not exists idx_marcos_status on obra_marcos(status);

alter table obra_marcos enable row level security;
drop policy if exists "Autenticados podem ver marcos" on obra_marcos;
drop policy if exists "Autenticados podem inserir marcos" on obra_marcos;
drop policy if exists "Autenticados podem atualizar marcos" on obra_marcos;
drop policy if exists "Autenticados podem deletar marcos" on obra_marcos;
create policy "Autenticados podem ver marcos" on obra_marcos for select to authenticated using (true);
create policy "Autenticados podem inserir marcos" on obra_marcos for insert to authenticated with check (true);
create policy "Autenticados podem atualizar marcos" on obra_marcos for update to authenticated using (true);
create policy "Autenticados podem deletar marcos" on obra_marcos for delete to authenticated using (true);

-- 2. Pendências (lista flat por obra)
create table if not exists pendencias (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  tipo text not null check (tipo in ('cliente', 'medicao', 'compras', 'canteiro', 'outro')),
  titulo text not null,
  descricao text,
  responsavel text,
  prazo date,
  status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'cancelada')),
  resolvida_em timestamptz,
  resolvida_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pendencias_obra on pendencias(obra_id);
create index if not exists idx_pendencias_status on pendencias(status);

alter table pendencias enable row level security;
drop policy if exists "Autenticados podem ver pendencias" on pendencias;
drop policy if exists "Autenticados podem inserir pendencias" on pendencias;
drop policy if exists "Autenticados podem atualizar pendencias" on pendencias;
drop policy if exists "Autenticados podem deletar pendencias" on pendencias;
create policy "Autenticados podem ver pendencias" on pendencias for select to authenticated using (true);
create policy "Autenticados podem inserir pendencias" on pendencias for insert to authenticated with check (true);
create policy "Autenticados podem atualizar pendencias" on pendencias for update to authenticated using (true);
create policy "Autenticados podem deletar pendencias" on pendencias for delete to authenticated using (true);

-- 3. Anexos (referência ao Supabase Storage)
create table if not exists anexos_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  categoria text check (categoria in ('medicao', 'projeto', 'amostra', 'foto_obra', 'documento', 'outro')),
  storage_path text not null,
  mime_type text,
  tamanho_bytes bigint,
  uploaded_by text,
  created_at timestamptz default now()
);
create index if not exists idx_anexos_obra on anexos_obra(obra_id);

alter table anexos_obra enable row level security;
drop policy if exists "Autenticados podem ver anexos" on anexos_obra;
drop policy if exists "Autenticados podem inserir anexos" on anexos_obra;
drop policy if exists "Autenticados podem atualizar anexos" on anexos_obra;
drop policy if exists "Autenticados podem deletar anexos" on anexos_obra;
create policy "Autenticados podem ver anexos" on anexos_obra for select to authenticated using (true);
create policy "Autenticados podem inserir anexos" on anexos_obra for insert to authenticated with check (true);
create policy "Autenticados podem atualizar anexos" on anexos_obra for update to authenticated using (true);
create policy "Autenticados podem deletar anexos" on anexos_obra for delete to authenticated using (true);

-- 4. Campos novos em obras
alter table obras add column if not exists construtora text;
alter table obras add column if not exists contato_construtora text;
alter table obras add column if not exists data_inicio date;
alter table obras add column if not exists data_entrega_prometida date;
alter table obras add column if not exists proximos_passos text;

-- 5. Bucket Storage para anexos
-- IMPORTANTE: criar manualmente no Supabase Dashboard:
--   Storage → New bucket → name: "anexos-obra" → Public: OFF (privado)
--   OU executar via SQL (requer privilégio admin):
--
-- insert into storage.buckets (id, name, public)
-- values ('anexos-obra', 'anexos-obra', false)
-- on conflict (id) do nothing;
--
-- Policies do Storage (executar após criar o bucket):
--
-- create policy "Autenticados fazem upload"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'anexos-obra');
--
-- create policy "Autenticados leem anexos"
--   on storage.objects for select to authenticated
--   using (bucket_id = 'anexos-obra');
--
-- create policy "Autenticados deletam anexos"
--   on storage.objects for delete to authenticated
--   using (bucket_id = 'anexos-obra');
