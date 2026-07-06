-- ============================================================================
-- Migration v6.13: Assistente IA de gestão — análises salvas
-- ============================================================================
-- A tela /insights envia um retrato das obras ativas para a Claude API e
-- recebe insights priorizados. Cada análise gerada fica salva aqui,
-- compartilhada pelo time (autor/data), sem custo de API a cada visita.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

create table if not exists ia_analises (
  id uuid primary key default gen_random_uuid(),
  gerado_por text,                              -- email de quem clicou em "Gerar"
  modelo text,                                  -- ex.: 'claude-sonnet-4-6'
  resumo text,                                  -- 2-3 frases do quadro geral (da IA)
  insights jsonb not null default '[]'::jsonb,  -- [{ prioridade, categoria, titulo, detalhe, obras, acao }]
  snapshot jsonb,                               -- retrato enviado à IA (auditoria)
  obras_ativas integer,                         -- nº de obras no snapshot
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz default now()
);
create index if not exists idx_ia_analises_created on ia_analises(created_at desc);

alter table ia_analises enable row level security;
do $$ begin
  drop policy if exists "Autenticados veem ia_analises" on ia_analises;
  drop policy if exists "Autenticados inserem ia_analises" on ia_analises;
  drop policy if exists "Autenticados atualizam ia_analises" on ia_analises;
  drop policy if exists "Autenticados deletam ia_analises" on ia_analises;
  create policy "Autenticados veem ia_analises" on ia_analises for select to authenticated using (true);
  create policy "Autenticados inserem ia_analises" on ia_analises for insert to authenticated with check (true);
  create policy "Autenticados atualizam ia_analises" on ia_analises for update to authenticated using (true);
  create policy "Autenticados deletam ia_analises" on ia_analises for delete to authenticated using (true);
end $$;
