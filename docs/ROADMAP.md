# Roadmap do Bela Agenda

Última atualização: 18 de setembro de 2026.

Este documento é a referência de continuidade do produto. Ao concluir ou alterar uma etapa, atualize os checkboxes, a seção **Próxima tarefa** e o histórico de decisões.

## Visão do produto

O Bela Agenda é uma secretária virtual com agenda online para salões e studios de beleza com equipes de 2 a 10 profissionais.

Proposta de valor:

> Responder clientes, encontrar horários, agendar, confirmar e remarcar atendimentos pelo WhatsApp, reduzindo o trabalho manual do estabelecimento.

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

- O onboarding inicial ainda não foi implementado.
- A implantação de homologação com PostgreSQL gerenciado ainda não foi criada.
- Horários de trabalho e folgas ainda não são configuráveis.
- O WhatsApp ainda não está integrado.
- Não há cobrança de assinaturas.

## M1: fundação de SaaS multiempresa

Objetivo: permitir que um salão crie uma conta e tenha um ambiente isolado e configurável.

### Banco e infraestrutura

- [x] Migrar o banco de SQLite para PostgreSQL.
- [x] Criar e versionar migrações de banco.
- [x] Configurar PostgreSQL local e documentar as variáveis e o comando de migração para produção.
- [ ] Definir rotina de backup e restauração.
- [ ] Adicionar logs estruturados e monitoramento de erros.

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

- [ ] Criar assistente de configuração inicial.
- [ ] Coletar nome, endereço, cidade e WhatsApp do estabelecimento.
- [ ] Cadastrar profissionais e serviços durante o onboarding.
- [ ] Configurar horários de funcionamento.
- [x] Gerar um slug público único.
- [ ] Exibir checklist de ativação no painel.

### Critérios de conclusão do M1

- Uma nova empresa consegue criar uma conta sem intervenção manual.
- Duas empresas diferentes não conseguem acessar os dados uma da outra.
- O proprietário consegue cadastrar equipe, serviços e horários.
- O ambiente funciona com PostgreSQL em uma implantação de homologação.
- Há testes automatizados para autenticação e isolamento entre empresas.

## M2: disponibilidade e agenda operacional

Objetivo: tornar a agenda confiável para uso diário de um estabelecimento real.

- [ ] Criar jornada de trabalho por profissional e dia da semana.
- [ ] Permitir intervalos, folgas, férias e bloqueios manuais.
- [ ] Configurar antecedência mínima e máxima para reservas.
- [ ] Configurar intervalo entre atendimentos.
- [ ] Considerar a duração completa do serviço ao exibir horários livres.
- [ ] Permitir cancelar e reagendar pelo painel.
- [ ] Permitir confirmar, concluir e marcar falta.
- [ ] Criar visualizações diária e semanal.
- [ ] Adicionar filtros por profissional e status.
- [ ] Registrar histórico de alterações do agendamento.
- [ ] Tratar corretamente o fuso horário `America/Sao_Paulo`.

### Critérios de conclusão do M2

- Nenhum horário exibido como livre pode conflitar com outro atendimento, intervalo ou bloqueio.
- Alterações importantes possuem histórico auditável.
- A equipe consegue operar um dia completo somente pelo painel.
- Os fluxos críticos possuem testes automatizados.

## M3: integração oficial com WhatsApp

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

Objetivo: permitir aquisição e cobrança de clientes pagantes.

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
- [ ] Implementar exportação e exclusão de dados do titular.
- [ ] Aplicar retenção de dados e exclusão de contas.
- [ ] Revisar controle de acesso, rate limiting e validação de webhooks.
- [ ] Proteger segredos e aplicar rotação de credenciais.
- [ ] Testar restauração de backup.
- [ ] Criar procedimento de resposta a incidentes.
- [ ] Executar testes de ponta a ponta dos fluxos críticos.
- [ ] Preparar homologação com os primeiros estabelecimentos.

## Fora do escopo inicial

Estes itens só devem entrar após validação do núcleo de agenda e WhatsApp:

- controle de estoque e compras;
- emissão de NFS-e;
- prontuário ou anamnese médica;
- contabilidade completa;
- aplicativo móvel nativo;
- programa de fidelidade;
- campanhas de marketing em massa;
- marketplace de profissionais.

## Próxima tarefa

Criar o assistente de configuração inicial para coletar nome, endereço, cidade e WhatsApp do estabelecimento.

## Decisões registradas

| Data | Decisão | Motivo |
| --- | --- | --- |
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

## Orientação para próximos agentes

1. Leia este arquivo e o `README.md` antes de alterar o produto.
2. Confirme o item marcado como **Próxima tarefa**.
3. Preserve as decisões registradas ou documente explicitamente qualquer mudança.
4. Atualize os checkboxes somente depois de implementar e verificar a funcionalidade.
5. Acrescente critérios de conclusão quando surgir um novo marco.
6. Registre decisões de arquitetura relevantes na tabela acima.
7. Ao finalizar uma sessão, deixe uma próxima tarefa específica e executável.
