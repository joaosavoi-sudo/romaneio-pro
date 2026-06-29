-- ============================================================================
-- Migration v6.10: Amostra — separar solicitante x responsável
-- ============================================================================
-- responsavel (já existe) = quem EXECUTA a amostra e cumpre o SLA (acabamento).
-- solicitante (novo) = quem PEDIU e acompanha a aprovação (gestor de obra).
-- ============================================================================

alter table amostras add column if not exists solicitante text;
