-- ============================================================================
-- Migration v6.3: Cronograma por item (herda do macro da obra)
-- ============================================================================
-- Cada item (moveis) ganha as MESMAS colunas de cronograma da obra, para ter o
-- próprio cronograma de 4 fases — que herda do macro da obra e pode ser ajustado
-- por item. Reusa os helpers e o componente CronogramaBar do macro.
--   - data_inicio: marco zero do item
--   - prazo_dias: prazo total do item em dias
--   - cronograma_fases: jsonb com os % por fase, ex.:
--       [{"chave":"definicoes","pct":10},{"chave":"fabricacao","pct":40}, ...]
-- moveis.previsao_entrega (já existe) continua sendo a data usada por
-- semáforo / Dashboard / Itens, mantida em sync = fim do cronograma do item.
-- ============================================================================

alter table moveis add column if not exists data_inicio date;
alter table moveis add column if not exists prazo_dias integer;
alter table moveis add column if not exists cronograma_fases jsonb;
