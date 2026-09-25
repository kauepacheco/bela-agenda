# Operação do Bela Agenda

Atualizado em 24/09/2026. Este roteiro prepara uma instalação; não indica que uma implantação já existe.

## Oferta e rotina da equipe

A primeira oferta é agenda online com confirmação humana. Ao iniciar o expediente e ao longo do dia, a equipe abre **Solicitações**, atualiza a fila e trata os pedidos mais próximos do vencimento. Após confirmar ou recusar no painel, faz o contato com o cliente. O botão do WhatsApp abre um rascunho para revisão e envio manual; não registra comprovante de entrega. O painel não envia avisos automaticamente.

O mesmo atalho existe no detalhe do atendimento para contatos sobre reagendamento ou cancelamento. Solicitações não confirmadas vencem em até 24 horas ou no início do atendimento. Alinhe essa rotina com os profissionais e teste a comunicação antes de compartilhar o link público.

WhatsApp oficial e cobrança integrada não são requisitos desta implantação. Defina preço, contratação e acompanhamento de pagamentos fora do aplicativo.

## Ambiente

Use Node.js 22 ou superior, PostgreSQL e um processo Node persistente atrás de HTTPS. Separe banco, domínio e credenciais de homologação e produção. Configure as variáveis de `.env.example` pelo gerenciador de segredos do provedor; os comandos operacionais esperam essas variáveis no ambiente. Não inclua o arquivo `.env` no repositório ou em imagens públicas.

- `DATABASE_URL`: conexão com o banco de destino. Para backup, prefira conexão direta, sem pool transacional.
- `APP_URL`: origem HTTPS usada nos links de convite e recuperação.
- `RESEND_API_KEY` e `EMAIL_FROM`: conta transacional e remetente validado.
- `TRUSTED_CLIENT_IP_HEADER`: cabeçalho contendo um único IP, sobrescrito pelo proxy. Bloqueie acesso direto ao servidor. Não use um cabeçalho que visitantes possam definir. Sem configuração, todas as requisições compartilham o limite de rede.

## Implantação

1. Gere backup e confira o ambiente de destino.
2. Execute `npm ci`, `npx prisma generate` e `npm run build` no ambiente de build.
3. Execute `npm run db:deploy` como etapa única de migração e confira `npx prisma migrate status`.
4. Execute `npm run ops:check` com as variáveis de produção. A verificação não envia e-mails nem altera cadastros. Um resultado aprovado confirma apenas os itens técnicos exibidos.
5. Inicie `npm start` sob um supervisor com reinício automático e encerramento gracioso. Coloque o proxy HTTPS na frente do processo.
6. Monitore `GET /api/health`: HTTP 200 indica conexão disponível; HTTP 503 indica falha de banco. A rota não retorna credenciais ou detalhes internos.
7. Em homologação, valide cadastro/onboarding, jornadas, reserva pública, confirmação, reagendamento, cancelamento e e-mails reais de convite/recuperação.

Não execute `db:reset` ou o seed em bancos de clientes. A conta demonstrativa é impedimento no `ops:check`.

As migrações acrescentam jornada, contadores de abuso, expiração, versões de cadastro e dados históricos. Reservas pendentes antigas passam a expirar em `min(início, criação + 24h)`; horários vencidos deixam de bloquear a agenda. Preços de reservas antigas são preenchidos com o catálogo disponível na migração e marcados como **estimados**. Novas reservas registram preço, nome e duração na transação de criação.

## Manutenção

Agende `npm run ops:maintenance` a cada cinco minutos com as mesmas variáveis de conexão do aplicativo. Use um agendador do provedor ou cron supervisionado. A execução:

- cancela solicitações vencidas e grava evento `EXPIRED`;
- remove contadores de abuso vencidos há mais de um dia;
- remove sessões expiradas e tokens de recuperação expirados há mais de um dia;
- emite um resumo JSON sem contatos ou tokens.

O cálculo de disponibilidade já ignora pendências vencidas sem depender do agendador. Confirmações vencidas são recusadas. A leitura da agenda e novas mutações também atualizam as pendências. O agendador mantém os estados persistidos atualizados mesmo sem acessos.

## Backup e restauração

Configure backups automáticos criptografados fora do servidor e restrinja o acesso. Como proposta operacional inicial a validar com o provedor: cópia diária, retenção de 30 dias, restauração mensal de amostra e, se disponível, recuperação pontual. Defina e registre o tempo aceitável de perda de dados e de recuperação antes do piloto. O script local não implementa armazenamento externo, criptografia ou retenção.

Instale `pg_dump` e `pg_restore` de versão compatível com o servidor (18 nos testes deste repositório). Pode-se definir `PG_DUMP_BIN` e `PG_RESTORE_BIN` com caminhos dos executáveis.

```bash
npm run ops:backup -- /caminho/privado/bela-2026-09-24.dump
```

O script usa formato customizado do PostgreSQL, cria arquivo com permissão restrita e checksum SHA-256. Recusa sobrescrever um arquivo existente. Não passa senhas nos argumentos do processo e não imprime a conexão. O checksum detecta corrupção acidental, mas não substitui armazenamento confiável e criptografia. Alarmes devem detectar falha do comando ou ausência de uma cópia recente.

Crie um banco **novo e isolado**, cujo nome termine em `_restore_test`. Configure `RESTORE_DATABASE_URL` no ambiente apontando para ele. Não publique a instância restaurada nem habilite envios externos.

```bash
RESTORE_CONFIRM=isolated-empty-database npm run ops:restore-check -- /caminho/privado/bela-2026-09-24.dump
```

A rotina valida o checksum, recusa destino com tabelas, restaura em transação sem apagar objetos existentes e consulta empresas, reservas e migrações. O dump deve vir de armazenamento confiável. Após a verificação, compare volumes e amostras com a origem, teste acesso e fluxos em ambiente isolado e destrua a cópia conforme a política de retenção. A rotina não troca a aplicação para o banco restaurado nem apaga o banco de teste.

Para testar automaticamente as rotinas com dados inteiramente fictícios:

```bash
npm run ops:test-backup
```

Esse comando cria PostgreSQL temporário, aplica migrações, carrega demonstração, gera e restaura uma cópia, compara dados e verifica recusa de checksum inválido, destino ocupado e arquivo de backup existente. Não usa o banco configurado do operador. Em 24/09/2026, esse teste passou com PostgreSQL 18 e clientes 18.6. A restauração de um backup externo do futuro provedor continua pendente.

## Observabilidade e incidentes

Encaminhe stdout/stderr ao serviço de logs da hospedagem, com acesso restrito e retenção definida. O aplicativo emite eventos como `request_failed`, `booking_failed`, `catalog_save_failed`, `maintenance_failed` e `backup_failed`. Os eventos adicionados evitam payloads, cookies, mensagens de exceção e URLs com tokens; o runtime/provedor também deve ser revisado, pois pode registrar requisições por conta própria.

Configure alertas para indisponibilidade de `/api/health`, falhas de manutenção/backup e aumento de HTTP 5xx. Não há serviço externo de monitoramento conectado nesta entrega.

Em incidente: registre início e impacto sem copiar dados pessoais, contenha a causa, preserve evidências com acesso restrito, restaure em ambiente isolado quando necessário e só faça a troca após conferir os dados. Revogue sessões e rotacione credenciais afetadas. Defina responsáveis e canais de comunicação antes de atender clientes reais.

## Verificação contínua

`.github/workflows/verify.yml` executa TypeScript, lint, integração com PostgreSQL temporário e navegador Chromium. A suíte de navegador cobre telas de 1440 e 390 pixels com fuso de Los Angeles, enquanto as reservas continuam em Brasília. Falhas retêm artefatos por sete dias; os testes usam somente dados fictícios.

```bash
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
```

O teste de navegador cria sua própria instância de banco e usa a porta 3107; ele recusa reutilizar um servidor existente. Testar backup exige também os executáveis PostgreSQL. A execução remota do workflow depende de publicar o repositório em um serviço com GitHub Actions habilitado.
