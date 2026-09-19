# Bela Agenda

MVP de uma secretária virtual e agenda online para salões e studios de beleza. O produto foi desenhado para estabelecimentos com equipes de 2 a 10 profissionais.

O plano de evolução, as decisões de produto e a próxima tarefa ficam registrados em [`docs/ROADMAP.md`](docs/ROADMAP.md).

## O que já funciona

- painel com indicadores e próximos atendimentos;
- agenda semanal por profissional;
- criação de agendamentos com bloqueio de conflito de horário;
- cadastro de clientes;
- cadastro de profissionais e serviços;
- página pública de agendamento;
- persistência em PostgreSQL com migrações versionadas;
- cadastro e login com sessões revogáveis;
- onboarding obrigatório com dados essenciais do estabelecimento;
- recuperação de senha por link de uso único;
- convites por e-mail e gestão de acessos da equipe pelo proprietário;
- isolamento dos dados privados por estabelecimento.

## Rodando localmente

Requisitos: Node.js 20.9 ou superior e Docker (para o PostgreSQL local).

```bash
npm install
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

O seed recria um estabelecimento fictício chamado Ateliê Bela e alguns agendamentos próximos à data atual. A conta demonstrativa usa `demo@belaagenda.com.br` e a senha `Bela1234!`.

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

Esta entrega ainda não está pronta para receber clientes reais. As próximas etapas necessárias incluem onboarding, configuração de horários de trabalho e folgas, integração oficial com WhatsApp, cobrança de assinatura, política de privacidade, logs e testes de backup.
