-- =============================================
-- Romaneio Pro - Migração v4
-- - Move móveis para a obra (cadastro persistente, reusado em vários romaneios)
-- - Adiciona campos da guia fechada (descricao, dimensoes, acabamentos, etc.)
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Adicionar obra_id em moveis (nullable temporariamente para migrar)
alter table moveis add column if not exists obra_id uuid references obras(id) on delete cascade;

-- 2. Migrar dados existentes: copiar obra_id do romaneio pro móvel
update moveis m
set obra_id = r.obra_id
from romaneios r
where r.id = m.romaneio_id and m.obra_id is null;

-- 3. Tornar obra_id obrigatório
alter table moveis alter column obra_id set not null;

-- 4. Remover romaneio_id (móvel agora pertence à obra, não ao romaneio)
alter table moveis drop column if exists romaneio_id;

-- 5. Índice
create index if not exists idx_moveis_obra on moveis(obra_id);

-- 6. Novos campos da guia fechada
alter table moveis add column if not exists descricao text;
alter table moveis add column if not exists dimensoes text;
alter table moveis add column if not exists acabamento_interno text;
alter table moveis add column if not exists acabamento_externo text;
alter table moveis add column if not exists incluido text;
alter table moveis add column if not exists nao_incluido text;
alter table moveis add column if not exists observacoes text;
alter table moveis add column if not exists projeto_recebido text;
alter table moveis add column if not exists quantidade integer default 1;
