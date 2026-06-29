-- ============================================================================
-- Migration v6.5: Processo da obra — 8 etapas com checklists e gates (Modelo Ouro)
-- ============================================================================
-- A obra ganha um ciclo de vida explícito (8 etapas do Modelo Padrão Ouro), com
-- checklist por etapa. A obra só avança quando o "gate" da etapa está completo.
--   - etapa_atual: etapa corrente do processo (default 'contrato')
--   - checklist: estado dos itens marcados, por etapa, com auditoria:
--       { "<etapa>": { "<item_key>": { "ok": true, "por": "email", "em": "ISO" } } }
-- JSONB (sem tabela nova) porque é bounded: 8 etapas x ~10 itens por obra.
-- O catálogo de etapas/itens vive no front (src/lib/processo.js).
-- ============================================================================

alter table obras add column if not exists etapa_atual text default 'contrato';
alter table obras add column if not exists checklist jsonb;
