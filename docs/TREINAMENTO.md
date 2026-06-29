# Romaneio Pro — Guia de Treinamento e Implementação

Bem-vindo ao **Romaneio Pro**, o sistema de gestão de obras de marcenaria — do
contrato à entrega final (e ao pós-venda). Este guia serve à equipe (treinamento) e à
gestão (implementação). Leia a sua parte conforme o seu papel.

> 💡 **Atalho de leitura:** **chão de fábrica** → vá direto à seção **"Operador de
> Estação"**. **Gestão/escritório** → leia tudo. **Admin (quem instala)** → comece pela
> seção **"Implementação (admin)"**.

---

## 1. Visão geral — o que o sistema faz

O Romaneio Pro organiza o trabalho em três níveis e dois acompanhamentos paralelos:

- **Obra** → o contrato de um cliente (ex.: "695‑2025 — PJS Legacy Capital").
- **Item** (móvel) → cada móvel da obra (ex.: "Cozinha", "Closet").
- **Peça** → cada parte que vai para a fábrica (ex.: "Lateral", "Porta").

Dois acompanhamentos:
- **Processo da obra** — 8 etapas com checklists e portões (do contrato à finalização).
- **Produção da peça** — 6 etapas no chão de fábrica, avançadas por **scanner de QR Code**:
  `Pré‑montagem → Romaneio → Acabamento → Conferência → Embalagem → Expedição`.

A gestão vê em tempo real onde está cada obra, item e peça — e o que precisa de atenção.

---

## 2. Papéis na equipe

| Papel | O que faz no sistema | Telas principais |
|-------|----------------------|------------------|
| **Gestão / Escritório** | Cria obras/itens, define cronograma e processo (checklists), comunica o cliente, abre amostras e assistências, acompanha pendências e indicadores | Dashboard, Obras, Itens, Pendências, Amostras, Assistência, Equipe |
| **Acabamento** | Executa as amostras e, na produção, consulta a **fórmula/foto/localização** da amostra no item | Amostras, Itens (dentro da obra) |
| **Marceneiro / Produção** | Monta romaneios, gera etiquetas, imprime; atende assistências | Romaneios, Etiquetas, Assistência |
| **Operador de Estação** | Escaneia a peça quando ela passa pela sua estação | Estações Móveis (celular, **sem login**) |

---

## 3. Primeiro acesso (login)

As contas são **criadas pela gestão/admin** (não há autocadastro).

1. Acesse o endereço do sistema (link enviado pela gestão).
2. Informe **e‑mail** e **senha** que a gestão cadastrou para você → **Entrar**.
3. Esqueceu a senha? Peça à gestão para redefinir.

> 🔒 Cada pessoa tem o próprio login — não compartilhe senha.

---

## 4. Implementação (admin) — instalar do zero

Faça uma vez, antes de liberar para o time.

**A. Banco de dados (Supabase → SQL Editor).** Rode as migrations **nesta ordem** (17):
```
supabase-schema.sql
supabase-migration-v2.sql
supabase-migration-v3.sql
supabase-migration-v4.sql
supabase-migration-v5.sql
supabase-migration-v6.sql
supabase-migration-v6.1.sql
supabase-migration-v6.2.sql
supabase-migration-v6.3.sql
supabase-migration-v6.4.sql
supabase-migration-v6.5.sql
supabase-migration-v6.6.sql
supabase-migration-v6.7.sql
supabase-migration-v6.8.sql    (amostras)
supabase-migration-v6.9.sql    (assistência técnica)
supabase-migration-v6.10.sql   (amostra: solicitante)
supabase-migration-v6.11.sql   (assistência: obra externa)
```
> São idempotentes — se já rodou alguma, rodar de novo não faz mal.

**B. Storage:** crie o bucket **`anexos-obra`** (privado) — guarda anexos, **fotos de
amostras e de assistências**.

**C. Limpeza (se houver dados de teste):** rode `supabase-limpar-dados.sql` para zerar
obras/itens/romaneios/peças/amostras/assistências antes da carga real. (Os arquivos do
bucket se apagam pelo painel — Storage → anexos‑obra.)

**D. Acesso restrito:** em **Authentication → Settings**, **desative "Allow new users to
sign up"**. Crie os logins do time em **Authentication → Users → Add user**.

**E. Pronto.** O sistema já está no ar (deploy Vercel). Faça login e comece pelas Obras.

---

## 5. Obras — `Obras`

Lista de obras com **abas de status** (Ativas — padrão · Concluídas · Canceladas · Todas)
e busca por cliente/código. Cada card mostra o **status** e a **etapa do processo**.

**Criar:** **"Nova Obra"** → Cliente (obrigatório), endereço, arquiteto, Status. Código em
branco gera `OBR‑XXX`, ou digite a sua guia (ex.: `695‑2025`).

**Concluir / reabrir:** dentro da obra, botão **"Concluir obra"** (ou **"Reabrir"**).
Quando **todos os itens** estão entregues, aparece um **banner sugerindo concluir**.
Obras concluídas/canceladas saem da lista de Ativas (ficam "arquivadas").

**Abas dentro da obra:** Visão geral · **Processo** · Pendências · **Comunicação** ·
**Amostras** · **Assistência** · Cronograma · Itens · Romaneios · Anexos · Relatório.

---

## 6. Processo da obra (8 etapas + checklists) — `Obra → Processo`

O coração do **modelo à prova de falhas**: a obra percorre 8 etapas, e **só avança quando
o checklist da etapa está 100% preenchido** (o "portão").

`Contrato e Kick‑off → Pré‑medição → Medição → Produção → Expedição → Entrega → Montagem → Finalização`

**Como usar:**
1. Aba **Processo** → o **stepper** mostra as 8 etapas (concluídas ✓, atual destacada).
2. Marque os itens do checklist da etapa atual (cada item tem o **papel responsável**;
   fica registrado **quem marcou e quando**).
3. O botão **"Avançar"** só habilita quando **faltam 0 itens**. Dá para voltar etapa.
4. Ao fechar a última etapa (**Finalização**), aparece **"Concluir obra"**.

> A etapa atual aparece no cabeçalho da obra, na lista de Obras e no **pipeline do
> Dashboard** ("Obras por Etapa").

---

## 7. Cronograma — `Obra → Cronograma`

Uma **barra = 100% do prazo**, dividida em 4 fases macro:

| Fase | % padrão |
|------|----------|
| Definições / Alocação de equipe | 10% |
| Fabricação | 40% |
| Acabamento, vistoria e embalagem | 15% |
| Montagem e finalização | 35% |

- **Definir:** "Definir cronograma" → Data de início + Prazo (dias). Ajuste os **%** (soma
  = 100) ou edite a **data‑fim** de uma fase (recalcula sozinho). A barra mostra as datas
  e o marcador **"hoje"** (adiantada/atrasada).
- **Previsto × Realizado:** abaixo da barra planejada, uma **faixa "Realizado"** mostra
  quando cada fase **de fato aconteceu** (derivada do scanner). Faixa cheia = concluída;
  tracejada = em andamento.
- **Por item:** ao definir o cronograma da obra, cada item **herda** as datas. Para um item
  com prazo diferente: abra o item → **"Cronograma do item → Personalizar"**.
- **Ajuste de prazo com justificativa:** se você **postergar** a entrega, o sistema **exige
  uma justificativa** e permite vincular a **pendência que causou** o atraso. Todo ajuste
  fica no card **"Ajustes de prazo"** (antes→depois, +N dias, motivo, quem/quando) — assim
  o motivo do atraso **nunca se perde**.

---

## 8. Itens — `Itens` (controle global)

Tabela com **todos os itens de todas as obras** (espelho da planilha de controle).

- **Semáforo** (automático): 🟢 no prazo · 🟡 atenção (pendência sem prazo, prazo ≤ 7 dias
  ou entrega chegando) · 🔴 crítico (bloqueado ou pendência/entrega vencida).
- **Progresso** — barra de **% de peças expedidas** por item (quanto falta produzir).
- Filtros: semáforo (chips clicáveis), obra, **responsável** (autocomplete da Equipe), busca.
  Itens de obras concluídas ficam ocultos por padrão (toggle "Incluir obras concluídas").
- Clique na linha → abre o item na obra. **"Exportar CSV"** baixa a planilha completa.
- Dentro do item, a seção **"Amostras deste item"** mostra a foto, a **fórmula** e a
  localização física das amostras vinculadas — para o **acabamento** reproduzir.

---

## 9. Pendências — `Pendências`

Painel global de **tudo que está travando**, de todas as obras. Abas **Abertas** (padrão) ·
**Resolvidas** · **Todas**.

- KPIs clicáveis: 🔴 Vencidas · 🟡 Sem prazo · 🟢 No prazo. Filtros por obra, tipo, responsável.
- **Resolver** abre um campo de **nota de resolução** (registre o motivo/efeito — ex.:
  "cliente aprovou a amostra, parou 12 dias"). A resolvida não some: fica em **Resolvidas**
  com a nota e **"ficou N dias em aberto"**.
- Pendências também são criadas/geridas dentro de cada obra (aba **Pendências**), podendo
  ser vinculadas a um **item**.

---

## 10. Comunicação com o cliente — `Obra → Comunicação`

Para o cliente **nunca precisar ligar perguntando**.

- **Próximo contato previsto** (cadência quinzenal): fica **vermelho quando atrasa**.
- **Cadência obrigatória** (kick‑off, medição, início de produção, quinzenal, pré‑entrega,
  montagem, vistoria, follow‑up) — marca ✓ o que já foi feito.
- **Histórico de contatos** (data, momento, canal, resumo, quem registrou).
- **"Gerar update"** monta a mensagem quinzenal **pré‑preenchida** com os dados da obra
  (% concluído, previsão, pendências do cliente, próximos passos) → **Copiar** / **WhatsApp**
  / **Registrar como enviado**.
- No **Dashboard**, um alerta lista as obras ativas **sem contato há 14+ dias**.

---

## 11. Amostras — `Amostras` (menu) e `Obra → Amostras`

Etapa **prioritária**: fazer as amostras (cor/laca, lâmina, madeira/tingimento, protótipo),
enviar para aprovação do cliente/arquitetura e **não travar o prazo da obra**.

- **Tipos e prazo (SLA):** Laca/cor **7 dias** · Lâmina, Madeira/Tingimento e Protótipo
  **21 dias** (o prazo vem automático pelo tipo, mas é editável). Prazo vencido fica **vermelho**.
- **Status:** Solicitada → Em produção → Enviada (p/ aprovação) → **Aprovada / Reprovada**.
- **Cada amostra liga a 1+ itens** da obra (multiseleção).
- **Fórmula catalogada:** o código de tinta/tingimento ou a receita (ex.: "Laca PU RAL 9003
  + 3% preto") — para o acabamento reproduzir certinho depois.
- **Foto + localização física:** anexe a foto e anote onde a amostra está guardada.
- **Solicitante × Responsável:**
  - **Solicitante** = quem **pediu** e acompanha a aprovação (gestor de obra).
  - **Responsável** = quem **executa** e cumpre o SLA (acabamento).
- **Onde ver:** menu **Amostras** (todas as obras, com KPIs *Em aberto / Vencidas /
  Aprovadas* e filtros) · aba **Amostras** na obra · e a seção **"Amostras deste item"**
  dentro do item (para o acabamento, na hora da produção).

---

## 12. Equipe — `Equipe`

Cadastro das pessoas (nome + papel: Gestão / Produção / Montagem / Compras / Outro).
Ativar/desativar (preserva histórico). A partir daí, os campos **"Responsável"** e
**"Solicitante"** em itens, pendências, romaneios, amostras e assistências viram
**autocomplete** dessa lista — padroniza nomes e habilita filtros confiáveis.

---

## 13. Romaneios e Peças — `Romaneios`

O romaneio é a lista de peças que vai para a fábrica.

- **Criar:** "Novo Romaneio" → selecione a **Obra** → abre o editor (`ROM‑XXX`).
- **No editor:** preencha **Marceneiro** e **Responsável** (salvam ao sair do campo);
  **"Nova Peça"** → vincule ao **Item** (ou avulsa), informe Nome, Dimensões (L×A×P mm),
  Material, Cor/Acabamento e **Quantidade** (cria várias de uma vez). As peças nascem na
  etapa **Romaneio**. Por peça: editar, duplicar, excluir.
- **"Imprimir Romaneio"** → folha A4 agrupada por item, com assinaturas.

---

## 14. Etiquetas (QR Code) — `Etiquetas`

Ligam a peça física ao sistema.

1. **Etiquetas** (ou o botão dentro do romaneio) → escolha **Obra** e **Romaneio**.
2. Marque as peças (ou "Selecionar todas") → **"Imprimir (N)"**.
3. Cada etiqueta (150×100 mm) traz QR Code, código, nome, obra/cliente, item, dimensões e
   material. **Cole na peça correspondente.**

---

## 15. Operador de Estação (chão de fábrica) 📱

A parte mais usada na fábrica. **Não precisa de login.**

**As 5 estações** (na ordem do fluxo):
**Romaneio · Acabamento · Conferência · Embalado/Expedição · Carregado/Entrega.**

**Como funciona:**
1. Em cada área há um **cartaz com o QR Code da estação** (impressos pela gestão em
   **Estações Móveis → "Imprimir QR Codes"**).
2. Pegue o **celular**, abra a câmera e aponte para o **QR da estação** na parede → abre a
   tela da estação (tela cheia).
3. Aponte para o **QR da peça**:
   - **Verde** ✅ + bipe agudo → a peça avançou para a etapa daquela estação.
   - **Vermelho** ❌ + bipe grave → algo deu errado (tente de novo).
4. O contador **"Hoje: N"** soma as peças da estação. Errou? **"Desfazer"** (aparece por
   alguns segundos) volta a peça à etapa anterior.

> **Alternativa no escritório:** a tela **Scanner** (com login) faz o mesmo com leitor USB
> ou a câmera do PC — útil para corrigir/avançar peças manualmente.

---

## 16. Acompanhamento (gestão)

- **Dashboard** — KPIs (obras ativas, itens atrasados, entregas ≤ 7 dias, itens
  bloqueados), **semáforo geral**, **pipeline "Obras por Etapa"**, listas "pedem atenção" e
  "entregas da semana", **alerta de contatos** (obras sem comunicação há 14+ dias) e
  **alerta de assistências** (atrasadas / a cobrar).
- **Peças** — consulta global com filtros (etapa, obra, material).
- **Rastreio** — relatório imprimível das peças por etapa (filtro por obra).
- **One Page Report** (dentro da obra) — A4 de status: KPIs, cronograma (previsto×realizado),
  **previsão por item**, produção e pendências. Botão "Imprimir / Salvar PDF".

---

## 17. Assistência Técnica (pós-venda) — `Assistência` (menu) e `Obra → Assistência`

Para acabar com o "telefone sem fio" no atendimento ao cliente depois da entrega.

- **Abrir chamado:** o **gestor** abre a solicitação com **demanda** (o que o cliente
  relatou), **fotos**, item (opcional) e **responsável** por atender.
- **Garantia × cobrança:** marque **Em garantia**; se **não**, sinaliza **"a cobrar" + valor**.
- **Prazo (SLA):** agendar em **3 dias** · concluir em **15 dias** (editável). Atrasado fica vermelho.
- **Status (produção/assistência atualizam):** Aberta → Agendada → Em andamento →
  **Concluída** (com a **resolução** do que foi feito) / Cancelada.
- **Obra antiga não cadastrada (externa):** pelo menu **Assistência → "Nova solicitação"**,
  escolha **"Obra não cadastrada (externa)"** e informe **cliente + referência + contato** —
  sem precisar cadastrar a obra. Essas aparecem com o badge **"externa"** e são acompanhadas
  pelo próprio menu (clique na linha para editar/mudar status).
- **Onde ver:** menu **Assistência** (KPIs *Abertas / Atrasadas / A cobrar*, filtros) · aba
  **Assistência** na obra · **alerta no Dashboard**.

---

## 18. Glossário rápido

- **Obra → Item → Peça** — os três níveis do trabalho.
- **Etapa (da peça)** — ponto da produção no chão de fábrica (6 etapas, via scanner).
- **Estação** — posto físico que avança a peça de etapa (5 estações).
- **Processo (da obra)** — as 8 etapas com checklists e portões (gate).
- **Gate** — o portão: só avança a etapa quando o checklist fecha 100%.
- **Semáforo** — saúde do item (🟢/🟡/🔴), automático.
- **Cronograma macro** — o prazo da obra em 4 fases; **realizado** = avanço real do scanner.
- **Ajuste de prazo** — mudança de prazo registrada com justificativa e causa.
- **Amostra** — cor/laca, lâmina, madeira ou protótipo para aprovação; tem **fórmula**, foto e prazo.
- **Fórmula** — o código de tinta/tingimento (receita) para reproduzir a amostra no acabamento.
- **Solicitante × Responsável** — quem **pede/acompanha** × quem **executa e cumpre o SLA**.
- **Assistência** — chamado de pós-venda; pode ser de obra cadastrada ou **externa** (antiga).
- **Obra externa** — obra antiga não cadastrada, usada só para abrir uma assistência.

---

## 19. Perguntas frequentes

**Não consigo criar conta.**
As contas são criadas pela gestão. Peça seu login.

**A peça não é encontrada no scanner.**
Confirme se a etiqueta foi gerada e se o QR não está danificado. No escritório, busque o
código em **Peças**.

**Escaneei na estação errada.**
Use **"Desfazer"** logo após o scan, ou peça à gestão para corrigir pela tela **Scanner**.

**Não consigo avançar a etapa da obra (Processo).**
Faltam itens no checklist da etapa atual. O botão "Avançar" mostra quantos faltam.

**Por que o prazo pediu justificativa?**
Porque você **postergou** a entrega. O sistema guarda o motivo e a pendência causadora —
para a obra ter rastreabilidade do atraso.

**Onde o acabamento vê a fórmula/localização da amostra?**
Abra o **item** dentro da obra → seção **"Amostras deste item"** (foto + fórmula +
localização física). Também no menu **Amostras**.

**Como abro uma assistência de obra antiga que não está no sistema?**
Menu **Assistência → "Nova solicitação" → "Obra não cadastrada (externa)"** → informe
cliente, referência e contato. O chamado é acompanhado pelo próprio menu.

**Como sei o que está atrasado / precisa de ação?**
Dashboard (itens atrasados, semáforo, alertas de contatos e assistências) e as telas
**Itens**, **Pendências**, **Amostras** e **Assistência**.

---

*Dúvidas que este guia não cobre? Fale com a gestão. Bom trabalho! 🪵*
