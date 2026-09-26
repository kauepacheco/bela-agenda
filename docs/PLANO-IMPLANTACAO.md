# Plano de implantação — Santa Agenda

Data: 25/09/2026.

Status em 25/09/2026: implantação externa realizada pelo fundador; domínio HTTPS, endpoint de saúde e recuperação de senha confirmados na conversa. Convite de funcionário é o próximo teste. Homologação completa ainda pendente.

## Registro da sessão — 25/09/2026

Evidência: configurações orientadas nesta sessão e confirmações do fundador. O agente não conseguiu acessar as URLs pelas ferramentas (falha de acesso/resolução); não houve verificação independente do ambiente remoto.

- Confirmado: site principal da Kapio na Vercel e zona `kapio.com.br` ativa na Cloudflare. O fundador escolheu manter o Render para a Santa Agenda para tentar economizar.
- Conta Render criada e repositório GitHub `kauepacheco/bela-agenda` conectado; branch orientada: `main`. O commit efetivamente publicado ainda precisa ser registrado. Na implantação inicial, as alterações de marca e documentação ainda estavam sem commit. O fundador confirmou depois que o site exibia Bela. Esta revisão prepara o commit para push manual pelo fundador; confirmar o novo deploy antes de considerar a marca publicada.
- Projeto Supabase criado e senha guardada pelo fundador. Conexão configurada via Session pooler, host `aws-0-us-east-2.pooler.supabase.com`, porta `5432`, com `sslmode=require`. Não registrar senha nem URI com credenciais.
- Render publicou o serviço e exibiu `Your service is live`, em `https://bela-agenda.onrender.com`.
- Domínio personalizado `https://santaagenda.kapio.com.br` configurado. Orientação aplicada: CNAME `santaagenda` → `bela-agenda.onrender.com`, DNS only, TTL Auto; verificação e certificado confirmados pelo fundador.
- O fundador abriu `https://santaagenda.kapio.com.br/api/health` e informou a resposta `{"status":"ok"}`.
- Domínio de envio `notificacoes.kapio.com.br` adicionado no Resend usando configuração automática na Cloudflare; status `Verified` confirmado.
- Chave Resend criada conforme orientação de `Sending access`, restrita ao domínio de envio, e cadastrada no Render. Valor secreto não registrado.
- Recuperação de senha testada pelo fundador: recebimento do e-mail, uso do link, redefinição e login com a nova senha confirmados com sucesso. Não foram informados horário, pasta de recebimento, identificador do provedor ou capturas.
- Convite de funcionário foi proposto, mas não executado/confirmado; o fundador pediu para continuar na próxima sessão.

Configuração orientada no Render e confirmada como preenchida:

| Campo | Valor |
| --- | --- |
| Runtime / plano | Node / Free |
| Root Directory | Vazio |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start Command | `npm run db:deploy && npm run start -- --hostname 0.0.0.0 --port $PORT` |
| `NODE_VERSION` | `22` |
| `PORT` | `10000` |
| `DATABASE_URL` | URI do Session pooler com senha, somente no ambiente do Render |
| `APP_URL` | `https://santaagenda.kapio.com.br` |
| `RESEND_API_KEY` | Segredo configurado no Render |
| `EMAIL_FROM` | `Santa Agenda <nao-responda@notificacoes.kapio.com.br>` |

Migrações estão no comando de início para esta implantação de teste. Ainda falta conferir estado/checksums por `ops:check`, registrar a versão remota e validar persistência após reinício. A região Ohio foi sugerida para o Render, mas a escolha final não foi informada. O cabeçalho de IP confiável não foi configurado nesta sessão.

## Retomar na próxima sessão

Primeiro, após o push manual pelo fundador, confirmar que o Render publicou o commit com a marca Santa Agenda e registrar a versão implantada. O domínio personalizado já funciona; não é necessário recriar banco, DNS ou Resend.

1. Entrar como proprietário em `https://santaagenda.kapio.com.br` e abrir Equipe.
2. Convidar outro e-mail controlado pelo fundador, com papel de funcionário.
3. Conferir recebimento e abrir o link em janela anônima; concluir aceite/cadastro e confirmar acesso ao estabelecimento como funcionário.
4. Conferir restrições de proprietário, uso único do convite e remoção de acesso; registrar cada resultado em `HOMOLOGACAO.md` somente após confirmação.
5. Depois, continuar testes online de agenda/reservas, verificações operacionais, backup externo, manutenção e alertas. Ainda falta piloto acompanhado com estabelecimento real.

## Objetivo

Publicar a Santa Agenda em `santaagenda.kapio.com.br`, com banco persistente e e-mails funcionando, para realizar os testes finais com dados fictícios. O site principal `kapio.com.br` permanece no endereço atual.

A proposta prioriza planos gratuitos durante os testes. A ausência de mensalidade depende das franquias, condições dos provedores e recursos necessários; não é uma garantia de operação completa sem custos.

## Arquitetura adotada para testes

| Componente | Escolha inicial | Observação |
| --- | --- | --- |
| Aplicativo | Render — serviço web gratuito | Hospedar interface e backend juntos, no aplicativo Next.js existente |
| Banco | Supabase — PostgreSQL gratuito | Preservar Prisma, migrações e autenticação atuais |
| Endereço | `santaagenda.kapio.com.br` | DNS Cloudflare e HTTPS confirmados pelo fundador |
| E-mails | Resend — franquia gratuita | Domínio verificado e recuperação confirmada; convite pendente |
| Backup externo | Destino a definir | Guardar cópias fora do banco e testar restauração |
| Manutenção e alertas | Executor e monitoramento a definir | Não depender de um processo dentro do serviço gratuito adormecido |

Não é necessário separar frontend e API. A Santa Agenda já usa Next.js para as duas partes. O Supabase será usado como banco PostgreSQL; sua autenticação integrada não substitui automaticamente a autenticação existente.

## Limitações e escolhas

- **Render gratuito:** o serviço adormece após 15 minutos sem tráfego e precisa despertar no próximo acesso. É aceitável para testes acompanhados, mas pode prejudicar a experiência dos clientes. Verificar também memória, limites de uso e disponibilidade dos recursos de implantação. O PostgreSQL gratuito do Render expira após 30 dias; por isso ele não faz parte desta proposta. [Documentação](https://render.com/docs/free).
- **Supabase gratuito:** projetos podem ser pausados por baixa atividade em um período de sete dias. Manter exportações e backups externos próprios, conforme orientação do provedor. [Pausas](https://supabase.com/docs/guides/platform/free-project-pausing) e [backups](https://supabase.com/docs/guides/platform/backups).
- **Vercel Hobby:** restrito a uso pessoal e não comercial; não foi escolhido para hospedar o SaaS comercial. [Condições](https://vercel.com/docs/plans/hobby).
- **Cloudflare:** o caminho documentado para Next.js completo é Workers com OpenNext. Exigiria adaptação e validação da versão do Next.js, Prisma e demais dependências. Não é o caminho inicial deste plano. [Documentação](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).
- **Turso:** não será adotado nesta etapa. O código atual depende de PostgreSQL, inclusive consultas e bloqueios transacionais usados na proteção contra conflitos de reservas. Uma troca de banco exigiria alterações e nova validação.

As condições foram consultadas durante o planejamento e devem ser conferidas novamente antes da contratação ou ativação de recursos pagos.

## Etapas de execução

### 1. Confirmar acessos e orçamento

- [x] Identificar o serviço que gerencia o DNS de `kapio.com.br`.
- [ ] Confirmar o repositório remoto e a versão a publicar.
- [x] Criar ou conectar as contas Render, Supabase e Resend.
- [ ] Conferir franquias, exigências de cadastro e eventuais cobranças.
- [ ] Definir onde guardar backups e como executar manutenção e alertas.

Credenciais devem ser configuradas nos gerenciadores de segredos dos serviços, sem inclusão no repositório ou neste documento.

### 2. Preparar o banco de testes

- [x] Criar um projeto Supabase dedicado aos testes finais.
- [ ] Configurar a conexão PostgreSQL adequada para o aplicativo, migrações e backup; conferir TLS, conectividade e modo do pooler com Prisma.
- [ ] Gerar o Prisma Client e aplicar as migrações existentes com `npm run db:deploy`.
- [ ] Conferir o estado das migrações e a conexão.
- [ ] Criar contas e estabelecimentos fictícios pelo fluxo normal da aplicação.

Não executar reset nem seed demonstrativo em bancos de clientes. A documentação de [Prisma no Supabase](https://supabase.com/docs/guides/database/prisma) deve orientar a configuração de conexão.

### 3. Publicar o aplicativo completo

- [x] Preparar a configuração de implantação compatível com Node.js 22 ou superior.
- [x] Configurar instalação de dependências, geração do Prisma Client, build e inicialização na porta fornecida pela hospedagem.
- [x] Definir a aplicação de migrações como etapa controlada da implantação, conforme os recursos disponíveis no plano escolhido.
- [x] Cadastrar `DATABASE_URL`, `APP_URL`, `RESEND_API_KEY` e `EMAIL_FROM`.
- [ ] Validar o cabeçalho de IP fornecido pelo proxy antes de configurar `TRUSTED_CLIENT_IP_HEADER`.
- [x] Confirmar publicação no endereço provisório do Render (log Live informado pelo fundador).
- [x] Testar `GET /api/health` no domínio final (resposta `{"status":"ok"}` informada pelo fundador).

### 4. Configurar subdomínio e HTTPS

- [x] Adicionar `santaagenda.kapio.com.br` à hospedagem.
- [x] Criar o registro DNS solicitado pelo provedor, preservando os registros usados pelo site principal e pelos e-mails.
- [x] Confirmar emissão do certificado e acesso por HTTPS.
- [x] Definir `APP_URL=https://santaagenda.kapio.com.br` e republicar quando necessário.
- [ ] Conferir links de convite e recuperação usando o domínio final.

### 5. Configurar e testar e-mails reais

- [x] Validar um domínio ou subdomínio de envio no Resend.
- [x] Configurar `EMAIL_FROM` com o nome Santa Agenda e o endereço validado.
- [x] Solicitar recuperação de senha e confirmar recebimento, redefinição e login com a nova senha (relato do fundador em 25/09/2026).
- [ ] Verificar uso único, substituição e expiração do link de recuperação.
- [ ] Enviar convite para outro e-mail controlado e verificar recebimento, aceite e permissões.
- [x] Registrar recebimento da recuperação na caixa postal pelo relato do fundador.
- [ ] Registrar metadados de entrega no provedor e evidência do convite.

O fundador confirmou recuperação em e-mail controlado; o endereço não foi registrado. O destinatário distinto do teste de convite será escolhido na próxima sessão. Não considerar o envio aprovado apenas porque a API retornou sucesso.

### 6. Preparar backup, manutenção e monitoramento

- [ ] Definir executor externo para `npm run ops:maintenance` a cada cinco minutos, conforme `OPERACAO.md`.
- [ ] Automatizar cópias para armazenamento externo com acesso restrito.
- [ ] Definir retenção, responsável e alertas de falha ou ausência de backup recente.
- [ ] Restaurar uma cópia em banco novo e isolado; comparar dados e registrar duração.
- [ ] Configurar monitoramento de `/api/health` e alertas de falha.
- [ ] Executar `npm run ops:check` com as variáveis da implantação.

O teste local de backup já aprovado não substitui a restauração no ambiente externo. Os comandos e proteções estão em [OPERACAO.md](OPERACAO.md).

### 7. Executar o roteiro online

- [ ] Cadastro e onboarding de estabelecimento fictício.
- [ ] Serviços, preços, profissionais, jornadas, pausas e ausências.
- [ ] Solicitação pública pelo celular e confirmação no painel.
- [ ] Reagendamento, cancelamento, conclusão e falta.
- [ ] Proteção contra reservas concorrentes e isolamento entre estabelecimentos.
- [ ] Acesso de funcionário, restrições e remoção de acesso.
- [ ] Persistência após reinício e nova publicação.
- [ ] Testes em computador e celular, incluindo comportamento após o serviço despertar.
- [ ] Correção de falhas e repetição dos casos afetados.

Usar [HOMOLOGACAO.md](HOMOLOGACAO.md) para registrar resultados e evidências. Nesta etapa, os testes são feitos pelo responsável pelo produto; o piloto com estabelecimento real continua sendo uma etapa posterior.

## Oferta e cobrança

Condições informadas pelo fundador:

- R$ 69 por mês por estabelecimento.
- 30 dias grátis, com cobrança automática após o término do período.
- Sem limite de cinco profissionais aprovado; não publicar esse limite nem prometer capacidade ilimitada.
- Link público informado: https://mpago.la/17LdtjL.

O link não pôde ser inspecionado pela ferramenta durante a conversa. Confirmar no checkout o preço, o período gratuito, a renovação e o cancelamento antes de divulgação.

A cobrança está configurada externamente segundo o fundador. A aplicação ainda não sincroniza teste gratuito, pagamentos, cancelamentos ou acesso com o Mercado Pago. Para os primeiros clientes, o acompanhamento pode ser manual; a integração automática é uma etapa separada.

## Critérios para concluir os testes finais

- [x] Aplicativo acessível pelo subdomínio com HTTPS.
- [ ] Banco persistente e migrações verificadas.
- [ ] Fluxos essenciais aprovados online.
- [ ] Recuperação e convite recebidos e utilizados com sucesso.
- [ ] Backup externo restaurado e conferido.
- [ ] Manutenção e alertas com execução verificada.
- [ ] Limitações do ambiente registradas e falhas impeditivas corrigidas.

## Passagem para o piloto real

Antes de um estabelecimento depender da Santa Agenda diariamente, priorizar hospedagem que permaneça ligada e revisar as condições de disponibilidade, backup e capacidade do banco. Confirmar o orçamento antes de ativar planos pagos.

Preservar a separação entre dados fictícios e dados de clientes, mantendo um ambiente próprio para testes. Concluir também suporte, documentos e condições comerciais descritos em [LANCAMENTO.md](LANCAMENTO.md).

O marco deste plano é um ambiente online validado para iniciar o piloto acompanhado; não equivale à homologação já realizada por um cliente.
