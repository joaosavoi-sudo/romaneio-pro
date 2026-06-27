-- ============================================================================
-- Migration v6.4: Cadastro de equipe (padronização de responsáveis)
-- ============================================================================
-- O campo "Responsável" (em itens, pendências, romaneios) era texto livre, o que
-- gerava grafias diferentes ("João" vs "Joao") e quebrava filtros/relatórios.
-- Esta tabela vira a LISTA CANÔNICA de pessoas. Os campos de responsável continuam
-- texto (compatível com o que já existe), mas passam a ser escolhidos via
-- autocomplete a partir desta lista.
--   - papel: usado para organização e, futuramente, controle de acesso por papel.
--   - ativo: desativar em vez de excluir, para preservar histórico.
--   - user_id: vínculo opcional com o login (auth.users), para "minhas tarefas".
-- ============================================================================

create table if not exists equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  papel text,
  ativo boolean not null default true,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_equipe_ativo on equipe(ativo);

alter table equipe enable row level security;
drop policy if exists "Autenticados podem ver equipe" on equipe;
drop policy if exists "Autenticados podem inserir equipe" on equipe;
drop policy if exists "Autenticados podem atualizar equipe" on equipe;
drop policy if exists "Autenticados podem deletar equipe" on equipe;
create policy "Autenticados podem ver equipe" on equipe for select to authenticated using (true);
create policy "Autenticados podem inserir equipe" on equipe for insert to authenticated with check (true);
create policy "Autenticados podem atualizar equipe" on equipe for update to authenticated using (true);
create policy "Autenticados podem deletar equipe" on equipe for delete to authenticated using (true);
