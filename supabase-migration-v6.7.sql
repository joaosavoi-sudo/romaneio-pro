-- ============================================================================
-- Migration v6.7: Rastreabilidade — resolução de pendências + ajustes de prazo
-- ============================================================================
-- Objetivo: parar de perder o histórico de gestão.
--   - pendencias.nota_resolucao: registra COMO/POR QUE a pendência foi resolvida
--     (motivo do atraso, efeito). As resolvidas deixam de "sumir".
--   - obra_prazo_ajustes: log de cada mudança de prazo da obra, com o valor anterior,
--     o novo, a justificativa e a pendência que causou o atraso.
-- ============================================================================

-- 1. Nota de resolução nas pendências (resolvida_por já existe no schema)
alter table pendencias add column if not exists nota_resolucao text;

-- 2. Log de ajustes de prazo da obra
create table if not exists obra_prazo_ajustes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  prazo_anterior integer,
  prazo_novo integer,
  data_entrega_anterior date,
  data_entrega_nova date,
  dias_delta integer,
  justificativa text,
  pendencia_id uuid references pendencias(id) on delete set null,
  por text,
  created_at timestamptz default now()
);

create index if not exists idx_prazo_ajustes_obra on obra_prazo_ajustes(obra_id);

alter table obra_prazo_ajustes enable row level security;
drop policy if exists "Autenticados podem ver ajustes" on obra_prazo_ajustes;
drop policy if exists "Autenticados podem inserir ajustes" on obra_prazo_ajustes;
drop policy if exists "Autenticados podem atualizar ajustes" on obra_prazo_ajustes;
drop policy if exists "Autenticados podem deletar ajustes" on obra_prazo_ajustes;
create policy "Autenticados podem ver ajustes" on obra_prazo_ajustes for select to authenticated using (true);
create policy "Autenticados podem inserir ajustes" on obra_prazo_ajustes for insert to authenticated with check (true);
create policy "Autenticados podem atualizar ajustes" on obra_prazo_ajustes for update to authenticated using (true);
create policy "Autenticados podem deletar ajustes" on obra_prazo_ajustes for delete to authenticated using (true);
