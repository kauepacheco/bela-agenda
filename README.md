# Bela Agenda

MVP de uma secretária virtual e agenda online para salões e studios de beleza. O produto foi desenhado para estabelecimentos com equipes de 2 a 10 profissionais.

O plano de evolução, as decisões de produto e a próxima tarefa ficam registrados em [`docs/ROADMAP.md`](docs/ROADMAP.md).

A revisão de 24/09/2026 e a lista priorizada para comercialização estão em [`docs/LANCAMENTO.md`](docs/LANCAMENTO.md). O produto ainda não deve ser anunciado como uma secretária de WhatsApp automatizada: essa integração não existe nesta versão.

## O que já funciona

- painel com indicadores e próximos atendimentos;
- agenda semanal (incluindo domingo) e lista, com filtros por profissional e status;
- criação de agendamentos com proteção transacional contra reservas simultâneas;
- confirmação, cancelamento, reagendamento, conclusão e registro de falta;
- histórico de criação e alterações persistido no banco;
- configuração de funcionamento por dia, antecedência mínima/máxima e intervalo entre serviços;
- disponibilidade calculada no servidor considerando a duração completa do serviço e o fuso de Brasília;
- cadastro de clientes;
- cadastro de profissionais e serviços;
- página pública de agendamento;
- persistência em PostgreSQL com migrações versionadas;
- cadastro e login com sessões revogáveis;
- onboarding obrigatório com dados do estabelecimento, profissionais e serviços;
- recuperação de senha por link de uso único;
- convites por e-mail e gestão de acessos da equipe pelo proprietário;
- isolamento dos dados privados por estabelecimento.

## Rodando localmente

Requisitos: Node.js 20.9 ou superior e Docker (para o PostgreSQL local).

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
- página pública: `http://localhost:3000/agendar/atelier-bela`

O seed cria um estabelecimento fictício chamado Ateliê Bela e alguns agendamentos próximos à data atual. Ele exige um banco vazio e não apaga dados existentes; também recusa execução com `NODE_ENV=production`. Use somente em um banco dedicado à demonstração. A conta demonstrativa usa `demo@belaagenda.com.br` e a senha `Bela1234!`.

### Atualizando uma instalação existente

```bash
npx prisma generate
npm run db:deploy
npm run build
```

A migração `20260924120000_booking_operations` adiciona configurações de agenda e histórico sem apagar agendamentos. Após a atualização, o proprietário deve acessar **Configurações**, revisar os dias/horários e salvar. Novas reservas ficam bloqueadas até essa configuração; os atendimentos existentes são preservados. Não execute `db:reset` nem o seed em bancos de clientes.

O funcionamento configurado é comum a toda a equipe. Folgas, férias, pausas de almoço e jornadas individuais ainda precisam ser implementadas. O fuso operacional desta versão é `America/Sao_Paulo`, inclusive quando servidor ou navegador usam outro fuso.

Em homologação e produção, configure `DATABASE_URL` com a conexão do PostgreSQL gerenciado e execute `npm run db:deploy` durante a implantação. Backups automáticos e restaurações devem ser configurados no provedor; a rotina operacional será detalhada em uma etapa própria do M1.

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

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

Os testes iniciam um PostgreSQL efêmero, aplicam as migrações reais e removem a instância ao terminar. Não é necessário manter o banco do Docker ativo para executá-los.

## Antes de produção

Esta entrega ainda tem bloqueios para lançamento comercial. Priorize jornadas individuais/folgas, proteção contra abuso, implantação de homologação com backup restaurável, integração oficial com WhatsApp, cobrança e documentos de privacidade/termos. Consulte os critérios de aceite e dependências em [`docs/LANCAMENTO.md`](docs/LANCAMENTO.md). Build e testes aprovados não substituem homologação com estabelecimentos reais.
