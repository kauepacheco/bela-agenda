# Bela Agenda

Agenda online com confirmação humana, em preparação para lançamento para salões e studios de beleza. O produto foi desenhado para estabelecimentos com equipes de 2 a 10 profissionais.

O plano de evolução, as decisões de produto e a próxima tarefa ficam registrados em [`docs/ROADMAP.md`](docs/ROADMAP.md).

A revisão de 24/09/2026 e a lista priorizada para comercialização estão em [`docs/LANCAMENTO.md`](docs/LANCAMENTO.md). A primeira oferta definida é **agenda online com confirmação pela equipe**. WhatsApp automático e cobrança integrada ficam como evoluções futuras, fora dos requisitos desta versão.

## O que já funciona

- painel com indicadores e próximos atendimentos;
- agenda diária, semanal (incluindo domingo) e lista, com filtros por profissional e status;
- criação de agendamentos com proteção transacional contra reservas simultâneas;
- fila de solicitações ordenada pelo prazo de confirmação, com confirmar/recusar e atalho para contato manual;
- confirmação, cancelamento, reagendamento, conclusão e registro de falta;
- histórico de criação e alterações persistido no banco e consultável na agenda;
- configuração de funcionamento por dia, antecedência mínima/máxima e intervalo entre serviços;
- disponibilidade calculada no servidor considerando a duração completa do serviço e o fuso de Brasília;
- cadastro, edição e inativação de clientes, com exportação e remoção de dados de contato pelo proprietário;
- edição e inativação de profissionais/serviços, vínculos múltiplos e proteção de atendimentos abertos;
- preço, nome e duração preservados por reserva, inclusive ao reagendar;
- jornada por profissional, pausas, folgas e férias, com detecção de edições concorrentes;
- limites de acesso compartilhados no banco e expiração de solicitações públicas;
- página pública de agendamento;
- persistência em PostgreSQL com migrações versionadas;
- cadastro e login com sessões revogáveis;
- onboarding obrigatório com dados do estabelecimento, profissionais, serviços e horários;
- recuperação de senha por link de uso único;
- convites por e-mail e gestão de acessos da equipe pelo proprietário;
- isolamento dos dados privados por estabelecimento.

## Rodando localmente

Requisitos: Node.js 22 ou superior e Docker (para o PostgreSQL local).

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse:

- painel: `http://localhost:3000`
- login: `http://localhost:3000/entrar`
- onboarding: `http://localhost:3000/onboarding`
- agenda: `http://localhost:3000/agenda`
- solicitações: `http://localhost:3000/solicitacoes`
- página pública: `http://localhost:3000/agendar/atelier-bela`

O seed cria um estabelecimento fictício chamado Ateliê Bela e alguns agendamentos próximos à data atual. Ele exige um banco vazio e não apaga dados existentes; também recusa execução com `NODE_ENV=production`. Use somente em um banco dedicado à demonstração. A conta demonstrativa usa `demo@belaagenda.com.br` e a senha `Bela1234!`.

### Atualizando uma instalação existente

```bash
npx prisma generate
npm run db:deploy
npm run build
```

A migração `20260924120000_booking_operations` adiciona configurações de agenda e histórico sem apagar agendamentos. Após a atualização, o proprietário deve acessar **Configurações**, revisar os dias/horários e salvar. Novas reservas ficam bloqueadas até essa configuração; os atendimentos existentes são preservados. Não execute `db:reset` nem o seed em bancos de clientes.

O funcionamento configurado limita a agenda da equipe. Cada profissional pode ter períodos próprios de trabalho e bloqueios datados em **Configurações**. Mudanças que conflitam com atendimentos abertos são recusadas. O fuso operacional desta versão é `America/Sao_Paulo`, inclusive quando servidor ou navegador usam outro fuso.

Em homologação e produção, configure `DATABASE_URL` com a conexão do PostgreSQL gerenciado e execute `npm run db:deploy` durante a implantação. Backups automáticos externos devem ser configurados no provedor. As rotinas de backup, restauração isolada, manutenção, monitoramento e implantação estão em [`docs/OPERACAO.md`](docs/OPERACAO.md).

## E-mail de recuperação de senha

O provedor transacional adotado é o [Resend](https://resend.com). Para entregar os links de recuperação, configure:

```bash
APP_URL="https://agenda.seudominio.com.br"
RESEND_API_KEY="re_..."
EMAIL_FROM="Bela Agenda <agenda@seudominio.com.br>"
```

O domínio do remetente precisa estar validado no Resend. Em desenvolvimento, se `RESEND_API_KEY` ou `EMAIL_FROM` não estiverem configurados, o link é exibido no terminal do servidor e nenhum e-mail é enviado. Em produção, essas variáveis são obrigatórias.

As mesmas configurações são usadas para convites de equipe. Convites expiram em 7 dias, só podem ser usados uma vez e podem ser cancelados pelo proprietário antes da aceitação.

## Verificações

Com Docker Desktop integrado ao WSL, também é possível executar a validação completa sem instalar Chromium ou clientes PostgreSQL no computador:

```bash
docker compose --profile verify build verify
docker compose --profile verify run --rm verify
```

A imagem oficial do Playwright inclui Node e Chromium; o Dockerfile acrescenta clientes PostgreSQL 18. O build precisa de internet para baixar dependências e fontes. A execução verifica TypeScript, lint, testes de integração, fluxos no navegador e backup/restauração usando bancos descartáveis dentro do container, sem rede externa e sem montar o volume do banco local. `.env` e backups são excluídos da imagem. Reconstrua a imagem após alterar o código.

Para abrir o aplicativo no computador, mantenha `docker compose up -d --wait postgres` e `npm run dev` ativos e acesse `http://localhost:3000`. Em um banco existente, use `npm run db:deploy`; não repita o seed. Depois da atualização, revise e salve os horários em **Configurações** para liberar novas reservas.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

Os testes iniciam um PostgreSQL efêmero, aplicam as migrações reais e removem a instância ao terminar. Não é necessário manter o banco do Docker ativo para executá-los.

## Antes de produção

Para a oferta escolhida, ainda faltam domínio/hospedagem, configuração e validação real de e-mail, backup externo e monitoramento, definição de preço/forma de contratação e documentos comerciais/privacidade. A equipe confirma os pedidos e avisa os clientes manualmente. Os atalhos do WhatsApp abrem rascunhos; o operador revisa e envia. WhatsApp automático e cobrança integrada não são bloqueios deste lançamento. Consulte os critérios de aceite e dependências em [`docs/LANCAMENTO.md`](docs/LANCAMENTO.md). Build e testes aprovados não substituem homologação com estabelecimentos reais.

## Operação e dados

- [`docs/OPERACAO.md`](docs/OPERACAO.md): implantação, manutenção, backup, restauração e CI.
- [`docs/DADOS-E-SUPORTE.md`](docs/DADOS-E-SUPORTE.md): inventário técnico e limites da exportação/remoção de contato.
- `npm run test:e2e`: build e navegador com banco descartável (instale Chromium com `npx playwright install --with-deps chromium`).
- `npm run ops:test-backup`: teste completo de backup/restauração, com ferramentas PostgreSQL instaladas.

As novas migrações preservam atendimentos existentes. Reservas pendentes expiram em até 24 horas ou no início do atendimento. Preços de reservas anteriores à migração são estimados pelo catálogo disponível naquele momento e identificados dessa forma no detalhe; reservas novas preservam os dados registrados. Nunca use reset para atualizar uma instalação.
