# Homologação da Santa Agenda

Roteiro preparado em 25/09/2026. **Execução externa iniciada em 25/09/2026; homologação completa pendente.** Os testes locais com dados fictícios não substituem o recebimento de e-mails nem o aceite do estabelecimento.

## Resultado da sessão de 25/09/2026

Ambiente: `https://santaagenda.kapio.com.br`, Render + Supabase + Resend, DNS Cloudflare. O fundador confirmou domínio/certificado, retorno `{"status":"ok"}` de `/api/health` e recuperação de senha completa (recebimento, redefinição e login com a nova senha). Evidência por relato na conversa; ferramentas do agente não conseguiram acessar o ambiente. Commit remoto, horários e identificadores de entrega não foram coletados.

**Próxima sessão:** testar convite de funcionário para outro e-mail controlado, abrir em janela anônima, aceitar e verificar acesso e restrições. O teste foi apenas orientado, sem execução confirmada. Detalhes da implantação e variáveis não secretas em [PLANO-IMPLANTACAO.md](PLANO-IMPLANTACAO.md).

## Registro do piloto

Preencher antes de começar: URL HTTPS de homologação, versão/commit, estabelecimento, responsável pelo teste, data, e-mails controlados do proprietário e funcionário, canal de suporte e responsável por acompanhar solicitações. Guardar evidências em local privado, sem senhas, tokens ou dados pessoais de clientes neste repositório.

Usar contas e reservas de teste autorizadas. Configurar `APP_URL`, `RESEND_API_KEY` e `EMAIL_FROM` no ambiente; o nome exibido do remetente deve ser `Santa Agenda`, com endereço de domínio validado. Executar `npm run ops:check` na implantação. O resultado técnico aprovado não comprova entrega de e-mail.

## E-mails reais

| Etapa | Aceite | Resultado/evidência |
| --- | --- | --- |
| Recuperação | Solicitar pela tela de login para uma conta de teste existente; receber mensagem na caixa controlada e registrar horário, pasta (entrada/spam), remetente e identificador no provedor | Recebimento confirmado pelo fundador em 25/09/2026; demais metadados pendentes |
| Link de recuperação | Abrir o link recebido: HTTPS e domínio de homologação, marca Santa Agenda; redefinir senha e entrar com a nova; senha anterior e sessão antiga deixam de funcionar | Redefinição e login com nova senha confirmados pelo fundador em 25/09/2026; marca/domínio e recusa da senha/sessão anteriores ainda sem verificação específica |
| Uso único e substituição | Reabrir link utilizado e verificar recusa; emitir dois novos pedidos e verificar que somente o mais recente funciona | Pendente |
| Expiração da recuperação | Solicitar outro link, aguardar mais de 30 minutos e verificar recusa sem alterar senha | Pendente |
| Convite | Pelo proprietário em Equipe, convidar e-mail controlado distinto; conferir recebimento, marca, estabelecimento, papel e domínio correto do link | Pendente |
| Aceite do convite | Aceitar pela mensagem recebida, entrar como funcionário e conferir acesso ao estabelecimento; operações exclusivas do proprietário devem ser recusadas | Pendente |
| Uso único do convite | Reabrir convite aceito e verificar que não permite um novo aceite | Pendente |
| Revogação e expiração | Cancelar um convite pendente e verificar recusa do link; verificar expiração de outro convite após sete dias em homologação, sem manipular banco de clientes | Pendente |

Registrar separadamente: aceitação pela API, evento de entrega do provedor e recebimento observado na caixa postal. Um retorno de sucesso da API sozinho não aprova a entrega. Se houver falha, registrar etapa, horário e identificador do provedor; corrigir e repetir a etapa. Expiração pode exigir retorno posterior ao piloto; não marcar como executada com base apenas no teste automatizado.

## Rotina com o estabelecimento

Executar com o responsável no computador e no celular que serão usados na operação.

1. Cadastrar conta e concluir onboarding com serviços, preços, durações, profissionais e jornadas. Revisar dias fechados, pausas, antecedência e intervalo entre serviços.
2. Abrir o link público sem login; solicitar horário e conferir preço, profissional e horário de Brasília. Verificar que o horário reservado não pode ser ocupado novamente.
3. Localizar o pedido em Solicitações, confirmar e avisar o contato de teste manualmente. Conferir que o atalho do WhatsApp abre o rascunho correto e que o operador efetivamente faz o envio.
4. Criar outro pedido, recusar e conferir a liberação do horário. Acompanhar também uma pendência vencida e sua liberação pela rotina de manutenção.
5. Reagendar atendimento, verificar histórico e liberação do horário anterior; cancelar outro e conferir o resultado no painel. Avisar os contatos de teste.
6. Criar atendimentos separados para concluir e marcar falta; conferir agenda diária, semanal e lista. Alterar preço no catálogo e verificar preservação do preço de uma reserva anterior.
7. Cadastrar cliente e corrigir seus dados; configurar ausência de profissional e verificar indisponibilidade pública. Conferir a proteção ao tentar bloquear um período com reserva aberta.
8. Com o funcionário convidado, executar as tarefas diárias; remover seu acesso e conferir que a sessão deixa de funcionar.
9. Acompanhar um expediente completo: identificar quem consulta a fila, frequência, comunicação com clientes, tratamento de erros e acionamento do suporte.

Para cada etapa, registrar aprovado/reprovado, executor, horário e evidência privada. Anotar problemas com passos para reprodução e repetir os casos afetados após a correção. Aceite final: responsável do estabelecimento confirma conclusão do expediente, compreensão da confirmação humana e ausência de problemas impeditivos.

## Backup e liberação comercial

O teste local verifica geração, checksum e restauração com dados fictícios. No provedor escolhido, configurar cópia automática externa e alertas; restaurar uma cópia em banco novo isolado conforme `OPERACAO.md`, comparar volumes/amostras e medir tempo de recuperação. Registrar data da cópia, duração da restauração, responsável e perda de dados aceitável; não conectar a aplicação de produção ao banco restaurado durante o ensaio.

A liberação exige evidências de navegador, e-mails reais, backup externo e aceite do estabelecimento, além de domínio/hospedagem, manutenção/alertas, suporte, condições comerciais e documentos de privacidade/termos definidos em `LANCAMENTO.md`. Registrar aprovação, responsável e data somente depois desses itens concluídos.
