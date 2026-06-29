-- ============================================================================
-- LIMPEZA DE DADOS — Romaneio Pro
-- ============================================================================
-- Use ANTES de liberar o sistema para o time, para começar do zero (sem dados
-- de teste/demonstração). Rode no SQL Editor do Supabase.
--
-- O QUE ESTE SCRIPT FAZ:
--   - APAGA TODAS as obras, itens (moveis), romaneios, peças, histórico,
--     pendências, cronogramas (obra_marcos) e os REGISTROS de anexos.
--   - Os ARQUIVOS de anexo no Storage (bucket "anexos-obra") NÃO podem ser
--     apagados por SQL (proteção do Supabase). Limpe-os à parte — ver o passo
--     no final deste arquivo.
--
-- O QUE ELE PRESERVA:
--   - O schema (tabelas, colunas, migrations v6.2/v6.3 já aplicadas).
--   - Os USUÁRIOS / logins (auth.users) — o time continua acessando.
--   - As políticas de segurança (RLS).
--
-- ⚠️  AÇÃO IRREVERSÍVEL. Os dados apagados NÃO voltam. Se quiser um backup antes,
--    no Supabase: Database → Backups, ou exporte as tabelas que importam.
-- ============================================================================

begin;

-- Ordem respeita as dependências (filhos antes dos pais).
delete from peca_historico;
delete from pecas;
delete from pendencias;
delete from obra_marcos;
delete from anexos_obra;
delete from obra_contatos;
delete from obra_prazo_ajustes;
delete from amostra_itens;
delete from amostras;
delete from moveis;
delete from romaneios;
delete from obras;

commit;

-- ============================================================================
-- Conferência (rode depois — todos devem retornar 0):
-- ============================================================================
-- select
--   (select count(*) from obras)         as obras,
--   (select count(*) from moveis)        as itens,
--   (select count(*) from romaneios)     as romaneios,
--   (select count(*) from pecas)         as pecas,
--   (select count(*) from pendencias)    as pendencias,
--   (select count(*) from obra_marcos)   as marcos,
--   (select count(*) from anexos_obra)   as anexos,
--   (select count(*) from peca_historico) as historico;

-- ============================================================================
-- LIMPAR OS ARQUIVOS DO STORAGE (bucket "anexos-obra") — passo separado
-- ============================================================================
-- O SQL acima removeu os registros em anexos_obra, mas os arquivos físicos
-- ficam no Storage. Para apagá-los, use UMA das opções:
--
-- Opção A — Painel (mais simples):
--   Supabase → Storage → bucket "anexos-obra" → selecionar tudo → Delete.
--
-- Opção B — Apagar o bucket inteiro:
--   Supabase → Storage → "anexos-obra" → Delete bucket. (Depois recrie o bucket
--   com o mesmo nome, privado, se for continuar usando anexos.)
--
-- Obs.: como a obra que referenciava os arquivos foi apagada, eles já estão
-- órfãos — limpá-los é só para não ocupar espaço; não afeta o sistema.
-- ============================================================================

