-- ============================================================================
-- Migration v6: Item como unidade de gestão (espelho da planilha de Controle)
-- ============================================================================
-- Adiciona em `moveis`:
--   - Responsáveis (produção + acompanhamento)
--   - Datas-chave do ciclo (contrato, medição, projeto aprovado, amostra, etc.)
--   - Datas pós-expedição manuais (entrega canteiro, montagem, conclusão)
--   - Bloqueio (PARADO/PENDENTE) com motivo
--   - Semáforo manual (verde/amarelo/vermelho)
--   - Última atualização (quando + quem)
-- E em `pendencias`:
--   - movel_id opcional (vincula pendência a item específico)
-- ============================================================================

-- Responsáveis (texto livre)
alter table moveis add column if not exists responsavel_producao text;
alter table moveis add column if not exists responsavel_acompanhamento text;

-- Datas-chave do ciclo
alter table moveis add column if not exists data_contrato date;
alter table moveis add column if not exists prazo_contrato text;            -- "60 DIAS"
alter table moveis add column if not exists data_medicao date;
alter table moveis add column if not exists data_projeto_aprovado date;
alter table moveis add column if not exists data_amostra_aprovada date;
alter table moveis add column if not exists data_inicio_producao date;
alter table moveis add column if not exists previsao_entrega date;

-- Fases pós-expedição (manuais — não há scanner no canteiro)
alter table moveis add column if not exists data_entrega_canteiro date;
alter table moveis add column if not exists data_inicio_montagem date;
alter table moveis add column if not exists data_montagem_concluida date;

-- Bloqueio
alter table moveis add column if not exists bloqueado boolean not null default false;
alter table moveis add column if not exists motivo_bloqueio text;

-- Semáforo manual
alter table moveis add column if not exists semaforo text
  check (semaforo in ('verde', 'amarelo', 'vermelho') or semaforo is null);

-- Última atualização (frontend grava no save)
alter table moveis add column if not exists ultima_atualizacao_em timestamptz;
alter table moveis add column if not exists ultima_atualizacao_por text;

-- Pendências podem ser ligadas a um item (opcional)
alter table pendencias add column if not exists movel_id uuid references moveis(id) on delete cascade;
create index if not exists idx_pendencias_movel on pendencias(movel_id);
