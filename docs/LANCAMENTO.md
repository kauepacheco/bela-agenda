# Preparação para lançamento — Bela Agenda

Revisão: 24 de setembro de 2026.

## Diagnóstico

O projeto tem uma base funcional de SaaS multiempresa: autenticação, sessões revogáveis, convites, onboarding, clientes, catálogo e agendamento. A revisão corrigiu problemas importantes de concorrência, disponibilidade, operação da agenda e apresentação. Ainda não está concluído para venda como secretária automática de WhatsApp. A integração, cobrança e operação em produção não foram validadas nem implantadas.

O caminho sugerido é concluir os bloqueios de agenda e segurança, homologar com poucos estabelecimentos e só então abrir vendas da proposta efetivamente entregue. Um piloto de agenda com confirmação humana é uma oferta diferente da automação de WhatsApp e precisa ser apresentado dessa forma.

## Implementado nesta revisão

- Configurações do estabelecimento editáveis pelo proprietário, incluindo dias de funcionamento, abertura/fechamento, antecedência e intervalo entre serviços.
- Disponibilidade pública calculada no servidor para o serviço completo, com vínculos válidos entre profissional e serviço.
- Mesmo serviço de regras para agendamento público e interno. Bloqueio transacional por empresa evita duas reservas concorrentes sobrepostas.
- Confirmação, cancelamento, reagendamento, conclusão e falta pelo painel; registro de eventos no banco. Reagendamento com falha preserva o horário anterior.
- Semana de sete dias, lista de atendimentos, filtros reais e horários de Brasília independentes do fuso do navegador/servidor.
- Reserva pública não sobrescreve nome de cliente existente e devolve apenas os dados mínimos da solicitação.
- Tratamento de JSON inválido e validação de períodos/telefone nas rotas revisadas.
- Painel com dados reais: retirada de números inventados de automação, conversas e dias de teste. Checklist de configuração e navegação funcional.
- Identidade visual em verde/terracota, cartões e estados vazios revisados, configurações responsivas e diálogos de agenda com foco nativo e fechamento por Escape.
- Último atendimento do cliente passa a considerar somente atendimentos concluídos.
- Páginas de erro e endereço não encontrado em português.
- Seed de demonstração deixa de apagar dados e exige banco vazio fora de produção.

## Verificações

- 27 testes automatizados em PostgreSQL efêmero com migrações reais, incluindo os 16 testes anteriores de autenticação/isolation e 11 novos de agenda/configurações.
- Casos novos: concorrência, sobreposição parcial, intervalo antes/depois, fechamento, datas passadas, prazo máximo/mínimo, jornada fechada, vínculo inválido, isolamento, cancelamento, reagendamento, histórico, falta/conclusão, privacidade da resposta pública, permissões de configurações e entradas inválidas.
- TypeScript, ESLint e build de produção verificados.
- `npm audit`: nenhuma vulnerabilidade conhecida reportada nesta execução; não equivale a uma auditoria completa de segurança.
- Chromium com servidor de produção e banco exclusivamente temporário: login, salvar configurações, solicitar reserva pública, confirmar, reagendar, cancelar e fechar diálogo pelo teclado.
- Inspeção visual em 1440px e 390px. Painel, agenda, configurações, página pública, clientes e catálogo sem transbordamento horizontal da página em 390px; a semana tem rolagem interna intencional.
- Fluxos de navegador executados com fuso `America/Los_Angeles` para verificar a apresentação operacional em Brasília. Sem erros de JavaScript capturados no roteiro.

Limites: não foram feitos testes de carga, auditoria formal de segurança/acessibilidade, entrega real de e-mails, cobrança, integração WhatsApp, restauração de backup de produção ou homologação com clientes. O roteiro de navegador desta revisão foi executado pontualmente; ainda precisa virar suíte versionada de CI.

## Lista priorizada

| Prioridade | Trabalho | Critério de aceite | Dependência |
| --- | --- | --- | --- |
| P0 — piloto | Jornada por profissional, pausas, folgas, férias e bloqueios | Página pública e painel nunca oferecem/gravam horários em pausas ou bloqueios; testes de concorrência e isolamento | Implementação |
| P0 — piloto | Proteção contra abuso | Limites compartilhados entre instâncias para login, recuperação, convites e reserva pública; proteção contra reservas massivas/duplicadas; regras documentadas de expiração de pendências | Implementação e infraestrutura |
| P0 — piloto | Homologação e backup | Domínio/HTTPS, PostgreSQL gerenciado, migrações aplicadas, credenciais separadas, backup e restauração testada em ambiente isolado | Escolha de hospedagem e conta do provedor |
| P0 — piloto | Privacidade e suporte | Política e termos correspondem ao tratamento real de dados; contato de suporte, procedimento de exportação/exclusão e retenção definidos | Dados da empresa e revisão adequada |
| P0 — piloto | E-mail transacional real | Remetente validado; recuperação e convites recebidos, expirados e revogados testados em homologação | Resend, domínio e credenciais |
| P0 — oferta WhatsApp | Integração oficial de WhatsApp | Webhook autenticado, idempotência, vínculo com empresa, consulta/alteração via serviço determinístico, confirmação/lembrete e transferência humana testados | Provedor, conta comercial, número, credenciais e templates aprovados |
| P0 — venda recorrente automatizada | Plano e cobrança | Preço/limites definidos, checkout, webhooks idempotentes, reconciliação, inadimplência e cancelamento testados | Decisão comercial e provedor de pagamentos |
| P1 — operação | Editar/inativar clientes, serviços e profissionais | Corrigir cadastros sem exclusão de histórico; vínculos múltiplos; política para reservas futuras ao inativar profissional/serviço | Implementação |
| P1 — operação | Preço e duração históricos | Cada reserva preserva preço/duração contratados; alteração de catálogo não altera histórico financeiro | Migração e implementação |
| P1 — operação | Onboarding e histórico | Configurar jornada no assistente e consultar eventos de alteração na interface | Implementação |
| P1 — confiabilidade | Recuperação de falhas em todos os formulários | Clientes e catálogo tratam rede indisponível, envios duplicados, sucesso/erro e acessibilidade dos diálogos | Implementação; já aplicado aos fluxos novos de agenda/configurações/reserva pública |
| P1 — confiabilidade | CI, logs e alertas | Testes de ponta a ponta versionados, erros estruturados sem dados pessoais, monitoramento de disponibilidade e incidentes | CI e serviço de monitoramento |
| P1 — escala | Paginação e desempenho | Consultas de clientes/catálogo/agenda com limites; teste de carga com volume representativo | Implementação e medição |
| P1 — produto | Uso em outras regiões/fusos | Fuso selecionável e aplicado em todos os pontos; casos de horários ambíguos testados | Hoje somente Brasília é suportado operacionalmente |
| P1 — validação comercial | Piloto acompanhado | Estabelecimentos completam um dia de operação; problemas críticos resolvidos; proposta comercial consistente com funcionalidades disponíveis | Participação dos primeiros clientes |
| P2 | Página comercial, materiais e gestão de suporte | Demonstração fiel, oferta clara, processo de implantação e atendimento repetível | Identidade comercial, planos e operação |

## Atualização e operação

1. Faça backup do banco de destino e confirme o ambiente antes da implantação.
2. Execute `npx prisma generate`, `npm run db:deploy` e `npm run build`.
3. Cada proprietário deve revisar e salvar **Configurações**. Até isso acontecer, novas reservas ficam bloqueadas; reservas antigas continuam existindo.
4. Teste o link público, uma criação concorrente, confirmação, reagendamento e cancelamento em homologação.
5. Nunca execute `db:reset` ou seed em bancos de clientes. A revisão usou somente bancos temporários; nenhuma migração foi aplicada ao banco existente do usuário.

A trava atual é por empresa, apropriada como ponto de partida para equipes pequenas. Ela depende de todos os escritores utilizarem `booking-service`. Antes de acrescentar WhatsApp, importadores ou integrações externas, reutilize esse caminho e meça contenção. Não há ainda restrição de exclusão de intervalos no banco protegendo escritas SQL externas.

Mudanças de jornada não cancelam reservas anteriores. A interface avisa isso; falta uma revisão assistida de conflitos após mudar a configuração. O intervalo usa o valor atual da empresa. O valor previsto do painel usa os preços atuais do catálogo e não representa pagamentos recebidos.
