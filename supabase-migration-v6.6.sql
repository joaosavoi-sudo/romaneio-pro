-- ============================================================================
-- Migration v6.6: Comunicação com o cliente (Modelo Ouro - Seção 5)
-- ============================================================================
-- Registra os contatos feitos com o cliente ao longo da obra, para sustentar a
-- cadência obrigatória ("o cliente nunca deve precisar ligar para perguntar") e o
-- KPI de aderência ao cronograma de feedback.
--   - momento: tipo do contato (kickoff, medicao, quinzenal, ...)
--   - canal: WhatsApp / E-mail / Ligação / ...
--   - resumo: o que foi comunicado
--   - por: quem registrou
-- ============================================================================

create table if not exists obra_contatos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  data date not null default current_date,
  momento text,
  canal text,
  resumo text,
  por text,
  created_at timestamptz default now()
);

create index if not exists idx_contatos_obra on obra_contatos(obra_id);

alter table obra_contatos enable row level security;
drop policy if exists "Autenticados podem ver contatos" on obra_contatos;
drop policy if exists "Autenticados podem inserir contatos" on obra_contatos;
drop policy if exists "Autenticados podem atualizar contatos" on obra_contatos;
drop policy if exists "Autenticados podem deletar contatos" on obra_contatos;
create policy "Autenticados podem ver contatos" on obra_contatos for select to authenticated using (true);
create policy "Autenticados podem inserir contatos" on obra_contatos for insert to authenticated with check (true);
create policy "Autenticados podem atualizar contatos" on obra_contatos for update to authenticated using (true);
create policy "Autenticados podem deletar contatos" on obra_contatos for delete to authenticated using (true);
