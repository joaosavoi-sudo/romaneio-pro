-- =============================================
-- Romaneio Pro - Schema do Supabase
-- Execute este SQL no SQL Editor do Supabase
-- =============================================

-- Tabela de Obras
create table obras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cliente text not null,
  endereco text,
  arquiteto text,
  status text not null default 'ativa' check (status in ('ativa', 'concluida', 'cancelada')),
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Tabela de Romaneios
create table romaneios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  obra_id uuid not null references obras(id) on delete cascade,
  observacoes text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Tabela de Peças
create table pecas (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null references romaneios(id) on delete cascade,
  codigo text not null unique,
  nome text not null,
  largura numeric default 0,
  altura numeric default 0,
  profundidade numeric default 0,
  material text,
  cor_acabamento text,
  ambiente text,
  quantidade integer default 1,
  etapa text not null default 'romaneio' check (etapa in ('pre_montagem', 'romaneio', 'acabamento', 'conferencia', 'embalagem', 'expedicao')),
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Histórico de Movimentação
create table peca_historico (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references pecas(id) on delete cascade,
  etapa_anterior text,
  etapa_nova text not null,
  usuario text,
  created_at timestamptz default now()
);

-- Índices
create index idx_pecas_romaneio on pecas(romaneio_id);
create index idx_pecas_etapa on pecas(etapa);
create index idx_pecas_codigo on pecas(codigo);
create index idx_romaneios_obra on romaneios(obra_id);
create index idx_historico_peca on peca_historico(peca_id);
create index idx_historico_created on peca_historico(created_at desc);

-- RLS (Row Level Security)
alter table obras enable row level security;
alter table romaneios enable row level security;
alter table pecas enable row level security;
alter table peca_historico enable row level security;

-- Políticas: usuários autenticados podem ver e editar tudo
-- (ajuste conforme necessidade de multi-tenant)
create policy "Autenticados podem ver obras" on obras for select to authenticated using (true);
create policy "Autenticados podem inserir obras" on obras for insert to authenticated with check (true);
create policy "Autenticados podem atualizar obras" on obras for update to authenticated using (true);
create policy "Autenticados podem deletar obras" on obras for delete to authenticated using (true);

create policy "Autenticados podem ver romaneios" on romaneios for select to authenticated using (true);
create policy "Autenticados podem inserir romaneios" on romaneios for insert to authenticated with check (true);
create policy "Autenticados podem atualizar romaneios" on romaneios for update to authenticated using (true);
create policy "Autenticados podem deletar romaneios" on romaneios for delete to authenticated using (true);

create policy "Autenticados podem ver pecas" on pecas for select to authenticated using (true);
create policy "Autenticados podem inserir pecas" on pecas for insert to authenticated with check (true);
create policy "Autenticados podem atualizar pecas" on pecas for update to authenticated using (true);
create policy "Autenticados podem deletar pecas" on pecas for delete to authenticated using (true);

create policy "Autenticados podem ver historico" on peca_historico for select to authenticated using (true);
create policy "Autenticados podem inserir historico" on peca_historico for insert to authenticated with check (true);
