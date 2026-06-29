-- ============================================================================
-- Migration v6.11: Assistência para obra NÃO cadastrada (externa)
-- ============================================================================
-- Permite abrir um chamado de assistência pelo menu global para uma obra antiga
-- que não está no sistema: obra_id passa a ser opcional e guardamos os dados da
-- obra/cliente externos.
-- ============================================================================

alter table assistencias alter column obra_id drop not null;
alter table assistencias add column if not exists cliente_externo text;  -- cliente da obra não cadastrada
alter table assistencias add column if not exists obra_externa text;     -- referência/código antigo da obra
alter table assistencias add column if not exists contato text;          -- contato para agendar
