# Preparação para lançamento — Bela Agenda

Revisão: 24 de setembro de 2026.

## Escopo definido para a primeira oferta

**Agenda online com confirmação humana**, conforme escolha do fundador em 24/09/2026. O cliente solicita um horário pelo link público; a equipe revisa a fila, confirma ou recusa no painel e avisa o cliente manualmente. Os atalhos do WhatsApp abrem rascunhos para revisão e envio pelo operador.

WhatsApp automático e cobrança integrada passam a ser evoluções futuras. Não são requisitos para lançar esta oferta. O preço e a forma de contratação fora do aplicativo ainda precisam ser definidos.

## Diagnóstico

Revalidação em 25/09/2026: Docker Desktop integrado ao WSL, banco local atualizado com as nove migrações após backup. A imagem `Dockerfile.verify` passou no build, TypeScript, lint, 51 testes, fluxo completo no Chromium em desktop/celular e backup/restauração com dados fictícios. O container de testes executou sem rede externa e sem montar o banco local. Isso resolve as limitações anteriores de bibliotecas ausentes no WSL; a homologação externa e o backup do futuro provedor continuam pendentes.

A base operacional está implementada e validada localmente: autenticação, onboarding, equipe, clientes, catálogo, jornadas, agenda, solicitações e isolamento por empresa. O próximo marco é homologar a implantação externa com um estabelecimento e concluir as condições comerciais e de suporte.

## Continuação da preparação — 24/09/2026

Implementado e validado localmente nesta continuação:

- Jornada individual, períodos de trabalho, pausas e ausências; proteção contra conflitos e edições concorrentes.
- Horários no onboarding, agenda diária/semanal/lista e histórico consultável.
- Limites de acesso atômicos no PostgreSQL, expiração auditada de pendências e limite de três solicitações abertas por cliente.
- Edição/inativação de clientes, profissionais e serviços; vínculos múltiplos e bloqueio de alterações que afetem reservas abertas.
- Nome, preço e duração registrados na reserva e preservados ao reagendar. Preços legados são identificados como estimados. Formulários enviam a versão do serviço para detectar catálogo desatualizado antes de reservar.
- Exportação dos dados de um cliente e remoção de identificadores de contato restritas ao proprietário, sem alegação de exclusão integral.
- Tratamento de falha de rede, envio em andamento e diálogos nativos nos formulários de clientes e catálogo.
- Logs estruturados, `/api/health`, verificação de configuração, manutenção e workflow de CI.
- Scripts de backup e restauração isolada com checksum, proteção de destino e teste real com PostgreSQL temporário.

Evidência atual: 50 testes de integração/unidade aprovados; TypeScript, lint e build aprovados; suíte de Chromium versionada com fluxos operacionais em 1440/390px e fuso de Los Angeles; teste de backup/restauração aprovado. A execução remota do CI e a restauração de backup do futuro provedor ainda não ocorreram. Consulte `OPERACAO.md` e `DADOS-E-SUPORTE.md`.

**Bloqueios da oferta escolhida:** domínio, hospedagem e PostgreSQL gerenciado; entrega real de e-mail; backup externo e alertas; identidade da operadora, suporte, preço/forma de contratação, retenção e termos/política; homologação com um estabelecimento. WhatsApp automático e assinatura integrada permanecem fora desta versão e não bloqueiam seu lançamento.

A fila `/solicitacoes` reúne os pedidos de todas as datas por vencimento, em páginas de até 50 itens. Confirmar/recusar exige que o pedido continue pendente, evitando que uma tela desatualizada cancele uma confirmação feita por outra pessoa.

A seção abaixo registra a revisão anterior; sua contagem de 27 testes é histórica.

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
| Concluído localmente | Jornada por profissional, pausas, folgas, férias e bloqueios | Página pública e painel nunca oferecem/gravam horários em pausas ou bloqueios; testes de concorrência e isolamento | Implementação |
| Implementado; validar proxy | Proteção contra abuso | Limites compartilhados entre instâncias para login, recuperação, convites e reserva pública; proteção contra reservas massivas/duplicadas; regras documentadas de expiração de pendências | Implementação e infraestrutura |
| P0 — piloto | Homologação e backup | Domínio/HTTPS, PostgreSQL gerenciado, migrações aplicadas, credenciais separadas, backup e restauração testada em ambiente isolado | Escolha de hospedagem e conta do provedor |
| P0 — piloto | Privacidade e suporte | Política e termos correspondem ao tratamento real de dados; contato de suporte, procedimento de exportação/exclusão e retenção definidos | Dados da empresa e revisão adequada |
| P0 — piloto | E-mail transacional real | Remetente validado; recuperação e convites recebidos, expirados e revogados testados em homologação | Resend, domínio e credenciais |
| Futuro — fora da primeira oferta | Integração oficial de WhatsApp | Webhook autenticado, idempotência, vínculo com empresa, consulta/alteração via serviço determinístico, confirmação/lembrete e transferência humana testados | Provedor, conta comercial, número, credenciais e templates aprovados |
| Futuro — fora da primeira oferta | Plano e cobrança | Preço/limites definidos, checkout, webhooks idempotentes, reconciliação, inadimplência e cancelamento testados | Decisão comercial e provedor de pagamentos |
| Concluído localmente | Editar/inativar clientes, serviços e profissionais | Corrigir cadastros sem exclusão de histórico; vínculos múltiplos; política para reservas futuras ao inativar profissional/serviço | Implementação |
| Concluído localmente | Preço e duração históricos | Cada reserva preserva preço/duração contratados; alteração de catálogo não altera histórico financeiro | Migração e implementação |
| Concluído localmente | Onboarding e histórico | Configurar jornada no assistente e consultar eventos de alteração na interface | Implementação |
| Cadastros corrigidos | Recuperação de falhas em todos os formulários | Clientes e catálogo tratam rede indisponível, envios duplicados, sucesso/erro e acessibilidade dos diálogos | Implementação; já aplicado aos fluxos novos de agenda/configurações/reserva pública |
| CI/logs implementados; alertas pendentes | CI, logs e alertas | Testes de ponta a ponta versionados, erros estruturados sem dados pessoais, monitoramento de disponibilidade e incidentes | CI e serviço de monitoramento |
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

Mudanças de jornada não cancelam reservas anteriores: agora são recusadas se afetarem atendimentos abertos. O intervalo usa o valor atual da empresa. O valor previsto do painel soma os preços registrados nas reservas e não representa pagamentos recebidos; valores migrados podem ser estimados.
