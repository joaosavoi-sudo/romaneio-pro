-- ============================================================================
-- Migration v6.2: Cronograma macro por barra de % do prazo
-- ============================================================================
-- A aba Cronograma deixa de ser uma lista de marcos (obra_marcos) e passa a ser
-- uma barra única = 100% do prazo, dividida em 4 fases macro com % editáveis.
--   - prazo_dias: prazo total da obra em dias (os 100% da barra)
--   - cronograma_fases: jsonb com só os percentuais por fase
--     ex.: [{"chave":"definicoes","pct":10},{"chave":"fabricacao","pct":40}, ...]
-- Reusa colunas já existentes:
--   - obras.data_inicio (marco zero)
--   - obras.data_entrega_prometida (gravada = data_inicio + prazo_dias ao salvar)
-- As datas de cada fase NÃO são armazenadas — sempre calculadas no front.
-- A tabela obra_marcos continua existindo (não é dropada), apenas sai da UI.
-- ============================================================================

alter table obras add column if not exists prazo_dias integer;
alter table obras add column if not exists cronograma_fases jsonb;
