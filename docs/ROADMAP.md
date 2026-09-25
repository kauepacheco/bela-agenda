# Roadmap do Bela Agenda

Última atualização: 25 de setembro de 2026.

Veja também [`LANCAMENTO.md`](LANCAMENTO.md) para a auditoria atual, evidências e prioridades comerciais. Os checkboxes de M0 abaixo registram o marco histórico, não uma certificação de produção.

Este documento é a referência de continuidade do produto. Ao concluir ou alterar uma etapa, atualize os checkboxes, a seção **Próxima tarefa** e o histórico de decisões.

## Visão do produto

A primeira oferta do Bela Agenda é uma agenda online com confirmação humana para salões e studios de beleza com equipes de 2 a 10 profissionais. Escopo escolhido explicitamente pelo fundador em 24/09/2026.

Proposta de valor:

> Receber solicitações de horário pelo link do estabelecimento e organizar agenda, equipe e clientes, com confirmação e contato feitos pela equipe.

WhatsApp automático e cobrança integrada são evoluções opcionais. M3 e os itens de automação de cobrança de M4 não bloqueiam esta primeira oferta.

## Mercado inicial

- Segmento: beleza.
- Cliente ideal: salões, barbearias, esmalterias e studios com 2 a 10 profissionais.
- Região comercial inicial: Itajaí, Santa Catarina.
- Expansão regional: Balneário Camboriú, Navegantes, Camboriú e Itapema.
- Disponibilidade do produto: todo o Brasil.
- Preço inicial em estudo: R$ 99 a R$ 179 por estabelecimento/mês.

## Estado atual — M0: protótipo funcional

- [x] Projeto Next.js com TypeScript.
- [x] Interface responsiva do painel administrativo.
- [x] Dashboard com indicadores e próximos atendimentos.
- [x] Agenda semanal.
- [x] Cadastro de clientes.
- [x] Cadastro de profissionais e serviços.
- [x] Criação de agendamentos pelo painel.
- [x] Detecção de conflito de horários no servidor.
- [x] Página pública de agendamento.
- [x] Modelo de dados preparado para múltiplos estabelecimentos.
- [x] Banco SQLite e dados demonstrativos locais.
- [x] Typecheck, lint e build de produção aprovados.
- [x] Auditoria de dependências sem vulnerabilidades conhecidas.

Limitações atuais:

- O onboarding inclui horários de funcionamento; profissionais podem ajustar jornadas em Configurações.
- A implantação de homologação com PostgreSQL gerenciado ainda não foi criada.
- Jornadas individuais, pausas e bloqueios estão implementados e testados. A homologação com estabelecimentos reais permanece pendente.
- Comunicação com clientes é feita pela equipe; os atalhos abrem rascunhos de WhatsApp.
- Preço e forma de contratação precisam ser definidos; não há cobrança dentro do aplicativo.

## M1: fundação de SaaS multiempresa

Objetivo: permitir que um salão crie uma conta e tenha um ambiente isolado e configurável.

### Banco e infraestrutura

- [x] Migrar o banco de SQLite para PostgreSQL.
- [x] Criar e versionar migrações de banco.
- [x] Configurar PostgreSQL local e documentar as variáveis e o comando de migração para produção.
- [x] Definir rotina de backup e restauração isolada e validá-la com dados fictícios.
- [ ] Configurar e restaurar backup externo da hospedagem.
- [x] Adicionar logs estruturados, endpoint de saúde e verificação operacional.
- [ ] Conectar monitoramento e alertas externos.

### Autenticação e autorização

- [x] Criar cadastro e login.
- [x] Implementar recuperação de senha.
- [x] Associar cada usuário a um estabelecimento.
- [x] Eliminar o uso do estabelecimento demonstrativo fixo nas rotas.
- [x] Impedir acesso a dados de outra empresa em todas as consultas e mutações.
- [x] Criar papéis iniciais: proprietário e funcionário.
- [x] Adicionar testes automatizados de cadastro, login, expiração de sessão e isolamento entre empresas.
- [x] Permitir convite e remoção de membros da equipe.

### Onboarding

- [x] Criar assistente de configuração inicial.
- [x] Coletar nome, endereço, cidade e WhatsApp do estabelecimento.
- [x] Cadastrar profissionais e serviços durante o onboarding.
- [x] Configurar horários de funcionamento na página Configurações (após o onboarding).
- [x] Incorporar a configuração de horários ao assistente de onboarding.
- [x] Gerar um slug público único.
- [x] Exibir checklist de ativação no painel, com estado real da configuração de horários.

### Critérios de conclusão do M1

- Uma nova empresa consegue criar uma conta sem intervenção manual.
- Duas empresas diferentes não conseguem acessar os dados uma da outra.
- O proprietário consegue cadastrar equipe, serviços e horários.
- O ambiente funciona com PostgreSQL em uma implantação de homologação.
- Há testes automatizados para autenticação e isolamento entre empresas.

## M2: disponibilidade e agenda operacional

Objetivo: tornar a agenda confiável para uso diário de um estabelecimento real.

- [x] Criar jornada de trabalho por profissional e dia da semana.
- [x] Permitir intervalos, folgas, férias e bloqueios manuais.
- [x] Configurar antecedência mínima e máxima para reservas.
- [x] Configurar intervalo entre atendimentos.
- [x] Considerar a duração completa do serviço ao exibir horários livres.
- [x] Permitir cancelar e reagendar pelo painel.
- [x] Permitir confirmar, concluir e marcar falta.
- [x] Organizar fila de solicitações por vencimento e oferecer contato manual, sem envio automático.
- [x] Criar visualizações diária e semanal.
- [x] Adicionar filtros por profissional e status.
- [x] Registrar histórico de alterações do agendamento no banco.
- [x] Exibir o histórico de alterações no detalhe do atendimento.
- [x] Tratar corretamente o fuso horário `America/Sao_Paulo` na disponibilidade, reservas, agenda e painel.
- [x] Proteger criação e reagendamento contra concorrência entre instâncias do aplicativo.
- [x] Adicionar visualização em lista e incluir domingo na semana.

### Critérios de conclusão do M2

- Nenhum horário exibido como livre pode conflitar com outro atendimento, intervalo ou bloqueio.
- Alterações importantes possuem histórico auditável.
- A equipe consegue operar um dia completo somente pelo painel.
- Os fluxos críticos possuem testes automatizados.

## M3: integração oficial com WhatsApp — evolução futura

Objetivo: automatizar agendamento e atendimento dentro do WhatsApp.

- [ ] Definir e documentar o provedor oficial da WhatsApp Business Platform.
- [ ] Criar recebimento e validação de webhooks.
- [ ] Associar uma conversa ao estabelecimento e ao cliente corretos.
- [ ] Responder dúvidas sobre serviços, preços, endereço e horários.
- [ ] Consultar disponibilidade em tempo real.
- [ ] Agendar, cancelar e remarcar pela conversa.
- [ ] Enviar confirmação e lembretes usando templates aprovados.
- [ ] Implementar transferência para atendimento humano.
- [ ] Registrar consentimento e opção de interrupção de mensagens.
- [ ] Medir volume, custo e falhas de mensagens.

### Diretriz de IA

A IA poderá interpretar linguagem natural e extrair intenções. Disponibilidade, preços, duração, criação e alteração de reservas devem sempre ser validados por regras determinísticas do servidor.

### Critérios de conclusão do M3

- Um cliente consegue agendar, remarcar e cancelar sem sair do WhatsApp.
- A automação nunca cria uma reserva em conflito.
- Mensagens com baixa confiança são transferidas para uma pessoa.
- Custos e falhas da integração podem ser acompanhados por empresa.

## M4: cobrança e operação comercial

Objetivo inicial: definir oferta, preço, suporte e contratação fora do aplicativo. Automação de assinaturas é uma evolução futura.

- [ ] Definir planos, limites e período de teste.
- [ ] Integrar cobrança recorrente por cartão e Pix, quando aplicável.
- [ ] Criar estados de assinatura: teste, ativa, inadimplente e cancelada.
- [ ] Criar tela de plano, faturas e cancelamento.
- [ ] Aplicar limites de profissionais e uso de mensagens.
- [ ] Criar painel administrativo interno para suporte.
- [ ] Criar landing page comercial e termos de uso.

## M5: segurança, LGPD e lançamento

- [ ] Publicar política de privacidade e termos de serviço.
- [ ] Mapear dados pessoais e respectivas finalidades.
- [x] Implementar exportação de cadastro/atendimentos e remoção de dados de contato pelo proprietário.
- [ ] Definir e implementar pedidos de exclusão além dos contatos, incluindo dados de usuários e cópias externas.
- [ ] Aplicar retenção de dados e exclusão de contas.
- [ ] Revisar controle de acesso, rate limiting e validação de webhooks.
- [ ] Proteger segredos e aplicar rotação de credenciais.
- [x] Testar restauração de backup local em banco isolado.
- [ ] Testar restauração do backup externo de produção.
- [ ] Criar procedimento de resposta a incidentes.
- [x] Executar testes de ponta a ponta dos fluxos críticos.
- [ ] Preparar homologação com os primeiros estabelecimentos.

## Fora do escopo inicial

Estes itens só devem entrar após validação comercial da agenda:

- controle de estoque e compras;
- emissão de NFS-e;
- prontuário ou anamnese médica;
- contabilidade completa;
- aplicativo móvel nativo;
- programa de fidelidade;
- campanhas de marketing em massa;
- marketplace de profissionais.

## Próxima tarefa

Validar a rotina acompanhada no ambiente local: acessar `http://localhost:3000`, revisar e salvar os horários em Configurações e simular solicitações e confirmações com o responsável pelo estabelecimento. Docker/WSL, migrações e validação automatizada completa (incluindo navegador e restauração) passaram em 25/09. Depois, preparar a homologação externa com hospedagem, domínio, PostgreSQL gerenciado e remetente de e-mail; seguir `OPERACAO.md` e validar backup externo. Não exigir WhatsApp oficial nem cobrança integrada para este lançamento. Definir preço, contratação, identidade comercial, suporte, retenção e documentos antes de publicar.

## Decisões registradas

| Data | Decisão | Motivo |
| --- | --- | --- |
| 2026-09-25 | Oferecer validação completa em Docker com bancos descartáveis e execução sem rede externa. | Permitir repetir navegador e backup no WSL sem instalar dependências do sistema ou usar o volume local. |
| 2026-09-25 | Comparar as migrações aplicadas e seus checksums com a versão distribuída no `ops:check`. | Uma conexão válida e a ausência de migrações com erro não garantem que o banco recebeu todas as atualizações. |
| 2026-09-24 | Lançar primeiro a agenda online com confirmação humana; adiar WhatsApp automático e cobrança integrada. | Escolha explícita do fundador. A equipe usa fila de solicitações e faz o contato manualmente; M3 e automação de M4 deixam de bloquear o lançamento. |
| 2026-09-24 | Preservar nome, preço e duração na reserva; identificar preços legados como estimados. | Edição de catálogo não pode reescrever o contratado. Reagendamento preserva a duração original. |
| 2026-09-24 | Restringir catálogo ao proprietário, validar versão nas edições e recusar inativação/remoção de vínculos com atendimentos abertos. | Evitar alterações perdidas, reservas órfãs e conflitos concorrentes. |
| 2026-09-24 | Expirar solicitações públicas após 24 horas ou no início e limitar três pendências por cliente. | Liberar horários sem confirmação e reduzir retenção abusiva de vagas. |
| 2026-09-24 | Usar contadores atômicos PostgreSQL e confiar em IP somente via cabeçalho explicitamente configurado. | Compartilhar limites entre instâncias sem confiar em cabeçalhos forjados. |
| 2026-09-24 | Exportar dados por cliente e remover identificadores diretos sem prometer exclusão integral. | Entregar ferramentas delimitadas, preservando histórico e deixando explícitas as dependências de retenção e backups. |
| 2026-09-24 | Centralizar criação, alteração e disponibilidade em `booking-service`; serializar mutações pela linha de `Business` com `SELECT ... FOR UPDATE` em transações PostgreSQL. | Eliminar a corrida entre consultar conflito e gravar; sincronizar inclusive alterações de configuração entre instâncias. Todos os novos escritores (WhatsApp, importações etc.) devem usar esse serviço. |
| 2026-09-24 | Exigir configuração explícita de horários após a migração, sem presumir que o padrão sugerido é a jornada real. | Não abrir reservas em horários não aprovados pelo estabelecimento; preservar atendimentos existentes. |
| 2026-09-24 | Começar com jornada comum à equipe em Brasília, regras de antecedência e intervalo; deixar jornada individual e pausas como próximo incremento. | Entregar uma base verificável sem representar limitações como recursos prontos. |
| 2026-09-24 | Manter confirmação humana na página pública e remover indicadores de WhatsApp e assinatura fictícios. | A interface deve mostrar somente integrações e resultados reais. |
| 2026-09-24 | Não reabrir atendimentos cancelados, concluídos ou com falta; registrar eventos de criação, status e reagendamento na mesma transação. | Evitar reativação de reservas em horários já ocupados e preservar rastreabilidade. |
| 2026-09-24 | O seed exige banco vazio e recusa produção. | Impedir que uma carga demonstrativa apague dados de clientes. |
| 2026-09-18 | Focar inicialmente no segmento de beleza. | Grande quantidade de estabelecimentos, uso intenso de agenda e menor complexidade que saúde. |
| 2026-09-18 | Atender estabelecimentos com 2 a 10 profissionais. | Melhor equilíbrio entre dor operacional e capacidade de pagamento. |
| 2026-09-18 | Concentrar a operação comercial inicial em Itajaí. | Proximidade para suporte e densidade suficiente de clientes potenciais. |
| 2026-09-18 | Construir o SaaS antes das entrevistas comerciais. | Preferência explícita do fundador. |
| 2026-09-18 | Usar regras determinísticas para conflitos de agenda. | Integridade da agenda não deve depender de respostas probabilísticas de IA. |
| 2026-09-18 | Adiar ERP, estoque, fiscal e prontuário. | Manter o produto inicial concentrado em agenda e atendimento. |
| 2026-09-18 | Adotar PostgreSQL gerenciado em homologação e produção, com PostgreSQL local no desenvolvimento e migrações versionadas pelo Prisma. | Usar o mesmo mecanismo de banco em todos os ambientes reduz divergências; um serviço gerenciado simplifica disponibilidade, backups e restauração. |
| 2026-09-18 | Implementar autenticação inicial por e-mail e senha, com senha derivada por `scrypt`, sessões opacas persistidas no banco e cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. | Entregar cadastro e login sem dependência de um provedor externo, permitir revogação de sessões e manter o contexto da empresa validado no servidor. |
| 2026-09-18 | Modelar o vínculo entre usuários e estabelecimentos por associações com papéis `OWNER` e `EMPLOYEE`; cada sessão aponta para uma associação ativa. | Preparar convites e equipes e impedir que identificadores enviados pelo cliente definam o tenant consultado. |
| 2026-09-18 | Executar testes de autenticação e isolamento contra um PostgreSQL efêmero com as migrações reais. | Detectar divergências específicas do banco de produção sem exigir que o PostgreSQL local do desenvolvedor esteja ativo. |
| 2026-09-18 | Usar o Resend para e-mails transacionais de recuperação de senha; armazenar somente o hash de tokens aleatórios, válidos por 30 minutos e uma única utilização. | Manter a integração simples via HTTP, evitar exposição de tokens no banco e limitar o impacto de links vazados. |
| 2026-09-18 | Enviar convites de equipe por links de uso único válidos por 7 dias, permitir papéis de proprietário e funcionário e desativar vínculos removidos com revogação imediata de sessões. | Evitar compartilhar senhas, preservar histórico de vínculos e garantir que acessos removidos deixem de funcionar imediatamente. |
| 2026-09-18 | Exigir que novas contas concluam nome, endereço, cidade e WhatsApp antes de acessar páginas e mutações operacionais; considerar contas anteriores já configuradas na migração. | Garantir dados mínimos para a experiência pública sem interromper estabelecimentos que já utilizavam o sistema. |
| 2026-09-18 | Criar profissionais, serviços e seus vínculos na mesma transação que conclui o onboarding, derivando o estabelecimento da associação autenticada. | Evitar configurações parciais, impedir mistura de dados entre empresas e entregar uma agenda utilizável no primeiro acesso ao painel. |

## Orientação para próximos agentes

1. Leia este arquivo e o `README.md` antes de alterar o produto.
2. Confirme o item marcado como **Próxima tarefa**.
3. Preserve as decisões registradas ou documente explicitamente qualquer mudança.
4. Atualize os checkboxes somente depois de implementar e verificar a funcionalidade.
5. Acrescente critérios de conclusão quando surgir um novo marco.
6. Registre decisões de arquitetura relevantes na tabela acima.
7. Ao finalizar uma sessão, deixe uma próxima tarefa específica e executável.
