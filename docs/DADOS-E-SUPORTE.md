# Dados pessoais e atendimento de solicitações

Inventário técnico em 24/09/2026. Não é uma política de privacidade publicada nem substitui a definição das responsabilidades e dos documentos comerciais.

| Dado | Uso atual | Onde fica |
| --- | --- | --- |
| Nome, e-mail e hash de senha de usuários | Autenticação e acesso ao estabelecimento | PostgreSQL |
| Sessões e hashes de tokens | Acesso, recuperação e convites | PostgreSQL; cookie de sessão no navegador |
| Nome, telefone e observações de clientes | Organização e contato sobre atendimentos | PostgreSQL |
| Serviços, preços, horários e histórico | Operação da agenda | PostgreSQL |
| Jornadas e motivos de ausência | Disponibilidade interna | PostgreSQL; motivos não são enviados à página pública |
| Identificadores de limites de acesso | Redução de abuso | SHA-256 de escopo/identidade no PostgreSQL; não tratado como anonimização garantida |
| E-mails de convite e recuperação | Entrega transacional | Resend quando configurado |
| Cópias de segurança e exportações | Recuperação e suporte | Destinos definidos pelo operador |

A página pública informa a finalidade do contato e que a solicitação exige confirmação humana. Não há integração de envio automático pelo WhatsApp, cobrança ou marketing. O link de conversa abre o WhatsApp por ação de quem o utiliza.

## Ferramentas disponíveis

Em **Clientes → editar cliente**, o proprietário pode baixar um JSON com o cadastro e os atendimentos daquele cliente, incluindo valores registrados. A rota exige sessão, papel de proprietário e empresa correspondente; não exporta senhas, tokens ou dados de outra empresa.

**Remover dados de contato** exige a confirmação digitada `REMOVER CONTATO`, recusa clientes com atendimentos pendentes/confirmados, remove nome, telefone e observações, limpa observações dos atendimentos e inativa o cadastro. Mantém identificador interno, serviços, preços, datas, status e histórico. Isso é remoção de identificadores diretos, **não exclusão integral nem garantia de anonimização**. Se o cliente retornar, crie um novo cadastro.

Inativar um cliente é uma operação diferente: preserva seus contatos e impede novas reservas. Nenhuma das operações apaga automaticamente arquivos já exportados, backups, registros externos ou dados da conta de um usuário da equipe.

## Procedimento de suporte a definir antes de publicar

1. Defina quem responde às solicitações e um canal verificável de contato.
2. Confira a identidade e o escopo do pedido antes de exportar ou remover dados. Não entregue arquivos a partir apenas de um telefone informado por terceiros.
3. Registre o pedido, responsável, decisão e execução em local restrito. Defina prazos e requisitos com a revisão adequada dos documentos.
4. Use a exportação ou remoção de contato conforme o pedido e a política aprovada. Confira o resultado no aplicativo.
5. Considere cópias exportadas, provedores e backups no procedimento. Ao restaurar uma cópia antiga, reaplique as remoções posteriores antes de recolocar o sistema em serviço.

Ainda faltam identificação da empresa operadora, canal de suporte, regras de retenção, cancelamento/exclusão de contas, texto de termos e política, tratamento de pedidos que exigem exclusão além dos contatos e revisão apropriada. Não publicar documentos com identidade, prazos ou compromissos inventados.
