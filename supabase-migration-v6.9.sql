-- ============================================================================
-- Migration v6.9: Assistência Técnica (pós-venda)
-- ============================================================================
-- O Gestor de Obra abre uma solicitação para o cliente (demanda + fotos);
-- produção/assistência atualizam o status até concluir. Tem SLA (agendar 3d /
-- concluir 15d) e, quando fora de garantia, sinaliza cobrança + valor.
-- ============================================================================

create table if not exists assistencias (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  movel_id uuid references moveis(id) on delete set null,  -- item específico (opcional)
  titulo text not null,
  descricao text,                  -- a demanda
  status text not null default 'aberta'
    check (status in ('aberta','agendada','em_andamento','concluida','cancelada')),
  em_garantia boolean not null default true,
  valor_cobranca numeric,          -- se fora de garantia
  data_solicitacao date default current_date,
  prazo_agendar date,              -- SLA: +3d
  data_agendada date,
  prazo_concluir date,             -- SLA: +15d
  data_conclusao date,
  responsavel text,                -- equipe (produção/assistência)
  solicitante text,                -- quem abriu (gestor)
  resolucao text,                  -- o que foi feito
  fotos jsonb,                     -- [{ path, nome }] no bucket anexos-obra
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_assistencias_obra on assistencias(obra_id);
create index if not exists idx_assistencias_status on assistencias(status);

alter table assistencias enable row level security;
do $$ begin
  drop policy if exists "Autenticados veem assistencias" on assistencias;
  drop policy if exists "Autenticados inserem assistencias" on assistencias;
  drop policy if exists "Autenticados atualizam assistencias" on assistencias;
  drop policy if exists "Autenticados deletam assistencias" on assistencias;
  create policy "Autenticados veem assistencias" on assistencias for select to authenticated using (true);
  create policy "Autenticados inserem assistencias" on assistencias for insert to authenticated with check (true);
  create policy "Autenticados atualizam assistencias" on assistencias for update to authenticated using (true);
  create policy "Autenticados deletam assistencias" on assistencias for delete to authenticated using (true);
end $$;
