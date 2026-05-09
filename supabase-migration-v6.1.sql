-- ============================================================================
-- Migration v6.1: Simplificação radical do schema v6
-- ============================================================================
-- Reverte 14 colunas que ficaram complexas, mantém só o essencial:
--   - responsavel (texto livre)
--   - previsao_entrega (date)
--   - motivo_bloqueio (vazio = não bloqueado)
--   - status_pos_expedicao (enum: entregue_canteiro | em_montagem | entregue)
--   - ultima_atualizacao_por
--   - pendencias.movel_id
-- O semáforo passa a ser 100% calculado (não armazenado).
-- ============================================================================

-- 1. Adicionar campo unificado de responsável (vai receber dados do v6 antes do drop)
alter table moveis add column if not exists responsavel text;

-- 2. Adicionar status_pos_expedicao
alter table moveis add column if not exists status_pos_expedicao text
  check (status_pos_expedicao in ('entregue_canteiro', 'em_montagem', 'entregue') or status_pos_expedicao is null);

-- 3. Migrar dados antes de dropar
-- responsavel = primeiro responsavel_producao, fallback responsavel_acompanhamento
update moveis
   set responsavel = coalesce(nullif(responsavel_producao, ''), nullif(responsavel_acompanhamento, ''))
 where responsavel is null
   and (responsavel_producao is not null or responsavel_acompanhamento is not null);

-- status_pos_expedicao derivado das datas (prioridade do mais "à frente" no fluxo)
update moveis set status_pos_expedicao = 'entregue'         where data_montagem_concluida is not null and status_pos_expedicao is null;
update moveis set status_pos_expedicao = 'em_montagem'      where data_inicio_montagem    is not null and status_pos_expedicao is null;
update moveis set status_pos_expedicao = 'entregue_canteiro' where data_entrega_canteiro   is not null and status_pos_expedicao is null;

-- 4. Dropar colunas que saem
alter table moveis drop column if exists responsavel_producao;
alter table moveis drop column if exists responsavel_acompanhamento;
alter table moveis drop column if exists data_contrato;
alter table moveis drop column if exists prazo_contrato;
alter table moveis drop column if exists data_medicao;
alter table moveis drop column if exists data_projeto_aprovado;
alter table moveis drop column if exists data_amostra_aprovada;
alter table moveis drop column if exists data_inicio_producao;
alter table moveis drop column if exists data_entrega_canteiro;
alter table moveis drop column if exists data_inicio_montagem;
alter table moveis drop column if exists data_montagem_concluida;
alter table moveis drop column if exists bloqueado;
alter table moveis drop column if exists semaforo;
alter table moveis drop column if exists ultima_atualizacao_em;

-- Mantidos do v6:
--   moveis.previsao_entrega (date)
--   moveis.motivo_bloqueio (text)        -- vazio/null = não bloqueado
--   moveis.ultima_atualizacao_por (text)
--   pendencias.movel_id (uuid)
