# Prompts incrementais — migração Hope Desk

## Como executar

1. Abra uma sessão nova do OpenCode para cada fase.
2. Não reutilize a sessão que recebeu o prompt mestre: ela já atingiu o limite de contexto.
3. Cole apenas o prompt da fase atual.
4. Não cole novamente o prompt mestre completo.
5. Só avance depois que os critérios de aceite da fase atual estiverem atendidos.
6. Se a sessão passar de aproximadamente 70–80 mil tokens, solicite `/compact` ou encerre-a após atualizar `docs/MIGRATION_STATUS.md`.
7. Mensagens como “continue” não substituem um novo contexto. Inicie uma sessão nova e informe explicitamente a fase.

## Regras comuns a todas as fases

Estas regras fazem parte de todos os prompts abaixo:

- Leia `docs/MIGRATION_STATUS.md` antes de agir.
- Preserve integralmente o monólito Flask; ele é a referência funcional.
- Não altere dados nem schema do banco de produção.
- Consulte o Graphify quando precisar entender relações do legado. Se `graphify-out/graph.json` existir, use primeiro `graphify query`, `graphify path` ou `graphify explain`; não reconstrua o grafo sem necessidade.
- Confirme no código qualquer conclusão ambígua do grafo.
- Não execute fases futuras.
- Não crie dezenas de arquivos sem validá-los.
- Trabalhe em ciclos pequenos: inspecionar, editar, formatar, validar e corrigir.
- Não afirme que algo está pronto sem executar os validadores correspondentes.
- Não faça commit, push ou alterações de produção.
- Ao terminar, atualize `docs/MIGRATION_STATUS.md` com arquivos, testes, resultados, pendências e próxima fase.
- Pare após entregar o resumo da fase. A parada ao final da fase é intencional.

---

## Prompt 00 — recuperação e baseline compilável

```text
Execute somente a Fase 00 da migração Hope Desk: recuperar o trabalho parcial e estabelecer um backend mínimo compilável.

Leia primeiro:
- docs/MIGRATION_STATUS.md
- backend/package.json
- backend/prisma/schema.prisma
- backend/src/main.ts
- backend/src/app.module.ts
- infra/docker-compose.dev.yml
- os modelos do legado em app.py

Considere todos os arquivos novos atuais como rascunho não confiável. Não preserve código quebrado apenas porque já existe.

Use o Graphify para localizar os modelos e relações do legado, mas confirme tudo em app.py.

Escopo desta fase:
1. Inventariar problemas concretos do backend parcial.
2. Corrigir package.json, tsconfig, nest-cli e configuração mínima.
3. Corrigir o schema Prisma para que tenha sintaxe válida e represente os modelos legados sem executar migration.
4. Criar apenas os módulos mínimos necessários para AppModule compilar, incluindo health e Prisma.
5. Corrigir main.ts e suas dependências.
6. Corrigir caminhos e contextos do Docker de desenvolvimento.
7. Gerar um lockfile consistente.
8. Não implementar autenticação nem CRUDs nesta fase.

Validações obrigatórias:
- instalação de dependências;
- prisma format;
- prisma validate usando uma DATABASE_URL de desenvolvimento, sem conectar à produção;
- npm run build;
- teste do carregamento da configuração;
- docker compose config para a infraestrutura de desenvolvimento.

Não execute prisma migrate contra nenhum banco existente.

Corrija todos os erros encontrados até os validadores passarem. Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 01 — contratos do legado e schema definitivo

```text
Execute somente a Fase 01: formalizar os contratos do legado e finalizar o modelo Prisma antes dos módulos de negócio.

Leia docs/MIGRATION_STATUS.md e confirme que a Fase 00 está verde. Se não estiver, corrija apenas os bloqueadores da Fase 00.

Use Graphify e leitura direta de app.py para documentar:
- User;
- Ticket;
- Activity;
- SystemModule;
- SystemParameter;
- PaymentRecord;
- relações;
- constraints;
- enums;
- índices;
- regras de exclusão;
- regras de visibilidade por perfil;
- regras temporais.

Entregue:
1. matriz modelo Flask → modelo Prisma;
2. schema Prisma definitivo para os domínios legados;
3. estratégia de mapeamento de nomes de tabelas e colunas;
4. estratégia de preservação dos IDs;
5. decisão documentada para timestamps, UTC e America/Sao_Paulo;
6. uso de Decimal para dinheiro e horas pagas;
7. testes de contrato ou fixtures que descrevam os dados esperados;
8. migration inicial somente para banco vazio de desenvolvimento;
9. nenhum acesso ao banco de produção.

Validações:
- prisma format;
- prisma validate;
- geração do Prisma Client;
- aplicação da migration em PostgreSQL descartável;
- testes de constraints e relações;
- npm run build;
- npm test.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 02 — autenticação e usuários

```text
Execute somente a Fase 02: autenticação, sessões, recuperação de senha, RBAC e usuários.

Preserve:
- perfis client e technician;
- flag isSuperuser;
- mustChangePassword;
- recuperação com token armazenado em hash;
- expiração de duas horas;
- mensagem que não revela se o e-mail existe;
- compatibilidade com hashes Werkzeug;
- rehash seguro após o primeiro login legado;
- gestão de usuários conforme as permissões atuais.

Implemente no backend:
- login;
- refresh token rotativo;
- logout e revogação;
- endpoint de usuário atual;
- troca de senha;
- fluxo de esqueci/redefinir senha;
- guards de autenticação e papéis;
- CRUD autorizado de usuários;
- validação de e-mail e senha;
- proteção contra IDOR;
- testes de RBAC.

Não implemente chamados nem frontend.

Não use uma comparação caseira de hashes Werkzeug. Implemente compatibilidade validada por vetores de teste reais gerados pelo legado ou adote uma estratégia segura documentada de redefinição.

Validações:
- build;
- lint sem correção destrutiva;
- testes unitários;
- testes de integração de todos os fluxos;
- Swagger gerado;
- nenhum segredo hardcoded.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 03 — módulos, parâmetros e pagamentos

```text
Execute somente a Fase 03: módulos do sistema, parâmetros da empresa e pagamentos.

Implemente:
- cadastro e listagem de módulos;
- ativação e desativação;
- unicidade de nome;
- parâmetros company_logo, company_name, company_address, monthly_hours_allowance e hours_bank_closing_date;
- leitura autorizada dos parâmetros necessários;
- edição administrativa;
- cadastro, listagem e exclusão de pagamentos;
- Decimal para amount e paidHours;
- serialização pt-BR apenas na apresentação, sem perder precisão;
- permissões equivalentes ao legado.

Não implemente banco de horas, analytics, relatórios ou frontend.

Adicione paginação quando a lista puder crescer e testes de autorização para cliente, técnico e superuser.

Validações:
- build;
- testes unitários;
- testes de integração;
- Prisma Client e schema válidos;
- Swagger coerente.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 04 — chamados

```text
Execute somente a Fase 04: domínio de chamados.

Use Graphify e app.py para rastrear o fluxo completo de criação, leitura, edição, status, atribuição e exclusão.

Implemente:
- criação por cliente para si;
- criação por técnico/superuser para um cliente;
- cliente obrigatório;
- módulo ativo obrigatório na criação;
- técnico opcional e validado;
- listagem paginada;
- filtros por período e status;
- detalhe;
- edição por perfis autorizados;
- mudança de status;
- isolamento dos chamados de cada cliente;
- exclusão por técnico somente no mês corrente;
- exclusão histórica somente por superuser;
- eventos de domínio para notificações futuras, sem enviar e-mail ainda.

Status válidos:
- aberto;
- em_andamento;
- resolvido;
- fechado.

Não implemente atividades, banco de horas, analytics nem frontend.

Validações:
- testes unitários das políticas;
- testes de integração;
- testes explícitos contra IDOR;
- build;
- Swagger.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 05 — atividades e conflitos

```text
Execute somente a Fase 05: atividades dos chamados e regras temporais.

Implemente:
- criação de atividade por técnico;
- notes obrigatória;
- início e fim;
- fim estritamente posterior ao início;
- duração máxima de 12 horas;
- detecção de qualquer sobreposição do mesmo técnico;
- exclusão da própria atividade da verificação durante edição;
- edição somente pelo autor;
- exclusão do mês corrente por técnico;
- exclusão histórica por superuser;
- cálculo preciso da duração;
- evento de domínio para notificação futura.

Use America/Sao_Paulo na entrada e saída e uma estratégia UTC consistente no armazenamento.

Crie testes para:
- intervalos iguais;
- sobreposição total;
- sobreposição parcial;
- intervalos adjacentes, que não conflitam;
- virada do dia;
- virada do mês;
- duração acima de 12 horas;
- edição pelo autor;
- bloqueio de outro técnico;
- permissões de exclusão.

Não implemente banco de horas, analytics ou frontend.

Execute build e todos os testes. Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 06 — banco de horas

```text
Execute somente a Fase 06: motor de cálculo do banco de horas.

Extraia as regras do legado com Graphify e leitura direta das funções correspondentes em app.py.

Implemente como serviço de domínio puro:
- franquia mensal configurável;
- ciclo semestral baseado na data de fechamento;
- divisão proporcional de atividades que atravessam meses;
- excesso calculado mês a mês;
- desconto das horas pagas dentro do ciclo;
- saldo líquido nunca negativo;
- visão filtrada para clientes;
- total pago no mês e no ciclo;
- horas de atividades do período ligadas a chamados de outros meses.

Antes de substituir a lógica, crie casos dourados executando ou reproduzindo resultados do Flask. Compare Node e Flask para os mesmos dados.

Não implemente UI, gráficos ou PDF.

Validações:
- testes unitários extensivos;
- testes de propriedades ou tabelas de casos;
- testes de integração;
- cobertura de viradas de mês, ano e ciclo;
- build.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 07 — analytics, relatórios e notificações

```text
Execute somente a Fase 07: analytics, relatórios PDF e notificações.

Implemente endpoints de analytics equivalentes ao legado:
- visão mensal, anual e de todo o período;
- KPIs;
- backlog;
- idade do chamado mais antigo;
- tempo da primeira resposta;
- dados por status, módulo, técnico e cliente;
- tendência de 12 meses;
- dados necessários para filtros cruzados.

Implemente no backend:
- relatório de atividades por intervalo;
- totalização por chamado e técnico;
- demonstrativo mensal;
- recorte proporcional por período;
- nome, endereço e logo da empresa;
- geração e download de PDF.

Implemente notificações por e-mail para:
- novo chamado;
- mudança de status;
- nova atividade;
- recuperação de senha.

Preserve as regras de destinatários do legado. Torne o envio testável e registre falhas sem bloquear a transação principal.

Não implemente o frontend.

Validações:
- comparação de totais com casos dourados Flask;
- testes dos PDFs;
- testes de destinatários;
- testes de falha SMTP;
- build e suíte completa do backend.

Atualize o Graphify incrementalmente se a base estiver estável. Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 08 — Expo e design system

```text
Execute somente a Fase 08: fundação do frontend React Native universal.

Crie frontend independente com TypeScript, Expo Router e suporte a Android, iOS e Web.

Implemente:
- configuração do projeto;
- navegação pública e protegida;
- client tipado da API;
- camada de cache de consultas;
- tratamento de erros;
- armazenamento seguro nativo;
- estratégia Web segura;
- temas claro e escuro;
- design tokens baseados no legado;
- assets e logo existentes;
- shell adaptativo para mobile, tablet e Web;
- componentes básicos Button, Input, Card, StatusBadge, Toast, Skeleton, EmptyState e ConfirmationDialog.

Preserve as cores:
- #0c4e9a;
- #234783;
- #ffcc00;
- #d92120;
- #1f9d55.

Não implemente ainda fluxos completos de chamados ou analytics.

Validações:
- TypeScript;
- lint;
- testes dos componentes essenciais;
- build Web;
- smoke test de inicialização Android/iOS quando o ambiente permitir;
- acessibilidade básica e contraste.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 09 — frontend de autenticação e chamados

```text
Execute somente a Fase 09: telas de autenticação e chamados.

Implemente:
- login;
- esqueci minha senha;
- redefinição;
- troca obrigatória;
- sessão e logout;
- listagem de chamados;
- filtros de mês, ano e status;
- busca por ID e título;
- detalhe;
- criação;
- edição autorizada;
- mudança de status;
- atribuição de técnico;
- atividades;
- validação de horário;
- ações de exclusão com confirmação;
- timeline do chamado;
- deep link para chamado e redefinição.

Adapte a navegação a mobile e Web. Mantenha permissões também na API; esconder botão não é autorização.

Inclua loading, erro, vazio, offline e prevenção de duplo envio.

Não implemente analytics ou administração.

Validações:
- testes de componentes;
- testes dos fluxos críticos;
- build Web;
- TypeScript;
- smoke Android/iOS.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 10 — analytics, relatórios e administração no frontend

```text
Execute somente a Fase 10: dashboards, relatórios e telas administrativas.

Implemente:
- painel de indicadores;
- KPIs;
- gráficos por status, módulo, técnico e cliente;
- tendência de 12 meses;
- filtros cruzados;
- tabela/lista responsiva;
- dashboard mensal de chamados e horas;
- relatório por intervalo;
- download e compartilhamento de PDF;
- usuários;
- módulos;
- parâmetros da empresa;
- pagamentos.

Preserve a identidade visual e evolua a experiência com responsividade, skeletons, filtros claros e gráficos acessíveis.

Garanta que clientes vejam somente seus dados e que telas administrativas respeitem RBAC.

Validações:
- paridade visual e funcional;
- testes dos filtros;
- testes de autorização;
- TypeScript;
- build Web;
- smoke Android/iOS.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 11 — recursos modernos e endurecimento

```text
Execute somente a Fase 11: recursos modernos aprovados e endurecimento.

Primeiro liste quais melhorias podem ser adicionadas sem alterar regras de negócio. Implemente somente as que estiverem claramente autorizadas ou já previstas na documentação.

Prioridades:
- atualização otimista com rollback;
- pull-to-refresh;
- filtros salvos;
- central de notificações;
- realtime;
- push com deep link;
- rascunhos offline;
- compartilhamento nativo;
- biometria opcional;
- command palette na Web;
- auditoria;
- observabilidade;
- rate limiting;
- headers seguros;
- correlation ID;
- métricas e logs estruturados.

Não introduza Redis, filas ou serviços adicionais sem justificar e documentar a necessidade.

Execute testes de segurança, desempenho básico, acessibilidade e suíte E2E crítica.

Atualize docs/MIGRATION_STATUS.md e pare.
```

---

## Prompt 12 — migração de dados e cutover

```text
Execute somente a Fase 12: preparar migração real, operação paralela e cutover.

Não execute alterações em produção sem aprovação explícita.

Implemente e valide em cópia descartável:
- inventário da base legada;
- backup;
- dry-run;
- migração preservando IDs;
- compatibilidade ou transição de hashes;
- contagem antes e depois;
- detecção de órfãos;
- validação de relacionamentos;
- amostras e checksums;
- relatório de inconsistências;
- rollback;
- operação paralela;
- smoke tests pós-migração;
- checklist de go/no-go;
- plano de desativação posterior do Flask.

Execute a suíte completa:
- backend;
- frontend;
- integração;
- E2E;
- relatórios;
- permissões;
- casos dourados de horas;
- Web, Android e iOS.

Produza documentação operacional final, mas não faça cutover nem desative o Flask sem aprovação explícita.

Atualize docs/MIGRATION_STATUS.md e pare.
```
