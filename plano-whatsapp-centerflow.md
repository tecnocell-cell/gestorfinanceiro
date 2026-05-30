CenterFlow
Módulo WhatsApp Financeiro
Plano Técnico de Implementação
Versão 1.0 — Maio 2026
1. Visão Geral	3
1.1 Fluxo Resumido	3
2. Tabelas Necessárias no PostgreSQL	3
2.1 whatsapp_sessions	3
2.2 whatsapp_pending	4
3. Novos Endpoints da API	5
4. Fluxo de Conexão via QR Code	5
5. Fluxo de Processamento do Webhook	5
5.1 Mensagem Nova (sem pendente)	6
5.2 Mensagem de Confirmação (com pendente)	6
6. Mapeamento instanceName para Tenant	6
7. Gerenciamento de Mensagens Pendentes	6
7.1 Estrutura do Payload	6
7.2 Limpeza Automática	7
7.3 Estado de Sessão por Usuário	7
8. Criação de Lançamento Avulso via WhatsApp	7
8.1 Padrões de Mensagem Reconhecidos	7
8.2 Campos do Lançamento Gerado	7
8.3 Gravação com Proteção de Concorrência	8
9. Criação de Recorrência via WhatsApp	8
9.1 Padrões de Mensagem para Recorrências	8
9.2 Campos da Recorrência Gerada	8
10. Como Evitar Duplicidade de Lançamentos	9
11. Segurança do Webhook	9
11.1 Validação HMAC-SHA256	9
11.2 Variáveis de Ambiente Necessárias	9
11.3 Outras Medidas de Segurança	10
12. Frontend — Tela de Conexão WhatsApp	10
12.1 Item de Menu	10
12.2 Estados da Tela	10
12.3 Exemplos de Comandos Mostrados ao Usuário	10
13. Fases de Implementação	10
14. O Que NÃO Implementar Agora	11
15. Riscos e Mitigações	11
16. Checklist Pré-Implementação	12
Infraestrutura	12
Banco de Dados	12
Segurança	12
Testes	12


1. Visão Geral
O Módulo WhatsApp Financeiro permite que usuários do CenterFlow registrem lançamentos financeiros — avulsos ou recorrentes — enviando mensagens de texto pelo WhatsApp, sem precisar abrir o sistema. O backend interpreta as mensagens em linguagem natural, solicita confirmação e, somente após a aprovação explícita do usuário, persiste o lançamento no banco de dados.

Princípio fundamental:
•	Nenhum dado financeiro é gravado sem confirmação explícita do usuário (resposta Sim/S/1).
•	A integração usa a Evolution API (self-hosted), isolada por tenant via instanceName.
•	Todo o plano é estruturado para rollback seguro — cada fase pode ser desativada independentemente.

1.1 Fluxo Resumido
#	Etapa
1	Usuário envia mensagem ao WhatsApp do CenterFlow: "Paguei conta de luz R$ 180"
2	Webhook recebe a mensagem e identifica o tenant pelo número do WhatsApp
3	Sistema responde: "Registrar Despesa R$ 180,00 em Conta de Luz? Responda Sim ou Não"
4	Usuário responde "Sim"
5	Lançamento é gravado no banco de dados via JSONB (mesma estrutura do sistema)
6	Sistema confirma: "Lançamento registrado! Consulte em Lançamentos > [mês]"

2. Tabelas Necessárias no PostgreSQL
Duas novas tabelas são adicionadas ao banco, sem alterar nenhuma tabela existente.

2.1 whatsapp_sessions
Armazena a conexão entre um tenant (usuário) e sua instância Evolution API.

Coluna	Tipo	Descrição
id	SERIAL PK	Chave primária auto-incremental
usuario_id	INTEGER FK	Referência para usuarios.id (ON DELETE CASCADE)
instance_name	TEXT NOT NULL	Nome da instância Evolution: cf-{usuario_id}
phone_number	TEXT	Número WhatsApp vinculado (formato 5511999999999)
status	TEXT	Estado: disconnected | connecting | connected
qrcode_base64	TEXT	QR Code Base64 atual (descartado após conexão)
webhook_secret	TEXT	Segredo HMAC-SHA256 por instância
created_at	TIMESTAMPTZ	Data de criação (DEFAULT NOW())
updated_at	TIMESTAMPTZ	Atualizado em cada mudança de status

2.2 whatsapp_pending
Armazena lançamentos pendentes de confirmação pelo usuário. Limpeza automática após 24 horas.

Coluna	Tipo	Descrição
id	SERIAL PK	Chave primária
usuario_id	INTEGER FK	Tenant dono do lançamento
from_number	TEXT NOT NULL	Número WhatsApp do remetente
payload	JSONB NOT NULL	Objeto do lançamento já estruturado
tipo_criacao	TEXT	'avulso' ou 'recorrencia'
expires_at	TIMESTAMPTZ	DEFAULT NOW() + INTERVAL '24 hours'
created_at	TIMESTAMPTZ	Data de criação

Estrutura do campo payload (tipo_criacao = 'avulso'):
{
  "id": "uuid-v4",
  "tipo": "Saida",
  "descricao": "Conta de Luz",
  "valor": 180.00,
  "data": "2026-05-27",
  "vencimento": "2026-05-27",
  "contaId": "uuid-da-conta",
  "planoId": "uuid-da-categoria",
  "pago": false,
  "historico": "Via WhatsApp"
}

3. Novos Endpoints da API
Todos os endpoints abaixo são novos e não alteram endpoints existentes.

Método	Rota	Descrição
POST	/api/whatsapp/connect	Cria instância Evolution e retorna QR Code. Auth: JWT.
GET	/api/whatsapp/status	Retorna status da conexão do tenant autenticado.
GET	/api/whatsapp/qrcode	Retorna QR Code Base64 atualizado enquanto status = connecting.
POST	/api/whatsapp/disconnect	Desconecta instância e remove registro. Auth: JWT.
POST	/api/whatsapp/webhook/:instanceName	Recebe eventos da Evolution API. Público, validado por HMAC-SHA256.

4. Fluxo de Conexão via QR Code
1.	Frontend chama POST /api/whatsapp/connect com JWT do usuário.
2.	Backend cria instância na Evolution API com instanceName = cf-{usuario_id}.
3.	Backend salva registro em whatsapp_sessions com status = 'connecting'.
4.	Backend retorna { qrcode_base64, instanceName }.
5.	Frontend exibe o QR Code e faz polling em GET /api/whatsapp/qrcode a cada 3 segundos.
6.	Quando o usuário escaneia, Evolution chama o webhook com evento CONNECTION_UPDATE.
7.	Backend atualiza status para 'connected' e phone_number na tabela whatsapp_sessions.
8.	Frontend detecta status = 'connected' no próximo poll e exibe tela de sucesso.

Tratamento de expiração:
•	QR Code expira em ~60 segundos pela Evolution API.
•	Backend deve suportar regeneração: novo POST /connect reinicia o fluxo.
•	Se o usuário fechar o modal antes de escanear, o status permanece 'connecting' e pode ser retomado.

5. Fluxo de Processamento do Webhook
9.	Evolution API envia POST para /api/whatsapp/webhook/:instanceName.
10.	Backend valida assinatura HMAC-SHA256 no header X-Signature.
11.	Backend extrai instanceName da URL e busca o tenant em whatsapp_sessions.
12.	Se o evento for MESSAGES_UPSERT (nova mensagem):
◦	Verificar se o número remetente é o phone_number registrado (evitar spam).
◦	Verificar se existe registro em whatsapp_pending para este usuário.

5.1 Mensagem Nova (sem pendente)
•	Backend envia mensagem ao usuário via Evolution API pedindo a intenção.
•	Sistema NLP simples extrai: tipo (Entrada/Saida), valor, descrição aproximada.
•	Backend salva registro em whatsapp_pending com expires_at = NOW() + 24h.
•	Backend responde com mensagem de confirmação: tipo, valor, categoria sugerida.

5.2 Mensagem de Confirmação (com pendente)
•	Se resposta for 'Sim', 'S', '1', ou variante: gravar lançamento no JSONB.
•	Se resposta for 'Não', 'N', '2', ou variante: descartar pendente, confirmar cancelamento.
•	Qualquer outra resposta: reenviar a confirmação com instrução clara.
•	Após gravação: deletar o registro de whatsapp_pending.

6. Mapeamento instanceName para Tenant
Convenção do nome de instância:

instanceName = "cf-" + usuario_id

Exemplos:
•	Usuário ID 42 → cf-42
•	Usuário ID 1001 → cf-1001

Isso permite que o webhook identifique o tenant diretamente pelo instanceName da URL, sem precisar de lookup adicional além de verificar se a instância está ativa em whatsapp_sessions.

Isolamento garantido:
•	Cada tenant tem uma instância Evolution separada.
•	Mensagens de um tenant nunca cruzam com dados de outro.
•	Remoção de tenant: basta desconectar a instância via /disconnect e deletar o registro.

7. Gerenciamento de Mensagens Pendentes
7.1 Estrutura do Payload
O payload em whatsapp_pending.payload é o objeto do lançamento já estruturado, pronto para ser inserido no JSONB do tenant sem transformação adicional.

Campos mínimos obrigatórios:
•	id: UUID gerado no momento da extração
•	tipo: 'Entrada' ou 'Saida'
•	valor: número positivo
•	data: data do dia da mensagem (YYYY-MM-DD)
•	descricao: texto extraído da mensagem
•	pago: false (pendente por padrão — usuário paga pelo app)

7.2 Limpeza Automática
Um job de limpeza pode ser implementado como cron no servidor ou como trigger PostgreSQL:

DELETE FROM whatsapp_pending WHERE expires_at < NOW();

Alternativa: ao receber qualquer mensagem do tenant, deletar pendentes expirados antes de processar a nova mensagem.

7.3 Estado de Sessão por Usuário
Um tenant pode ter no máximo 1 pendente ativo por vez. Ao criar novo pendente, substituir o anterior (ou informar o usuário que existe uma confirmação pendente).

8. Criação de Lançamento Avulso via WhatsApp
8.1 Padrões de Mensagem Reconhecidos
O NLP simples deve reconhecer as seguintes estruturas:

Exemplo de Mensagem	Interpretação
Paguei conta de luz R$ 180	Saida | R$ 180 | Conta de Luz
Recebi salário 3500	Entrada | R$ 3.500 | Salário
Despesa alimentação 45,90	Saida | R$ 45,90 | Alimentação
Gastei 200 no mercado	Saida | R$ 200 | Mercado
Entrada 1200 freelance	Entrada | R$ 1.200 | Freelance

8.2 Campos do Lançamento Gerado
•	id: UUID v4 gerado no servidor
•	tipo: 'Entrada' ou 'Saida' (inferido por palavras-chave: paguei, gastei, despesa → Saida; recebi, salário, entrada → Entrada)
•	valor: extraído por regex: /R\$?\s*([\d,.]+)/
•	descricao: texto restante após extração do valor
•	data: data corrente no fuso do servidor (YYYY-MM-DD)
•	vencimento: igual a data (lançamento avulso)
•	pago: false — o usuário confirma o lançamento mas marca como pago no app
•	contaId: conta padrão do tenant (primeira conta ativa) — pode ser configurável futuramente
•	planoId: categoria inferida por similaridade (opcional na Fase 1)
•	historico: 'Via WhatsApp'

8.3 Gravação com Proteção de Concorrência
A gravação usa transação PostgreSQL com FOR UPDATE para evitar race conditions no JSONB:

BEGIN;
SELECT dados FROM estados WHERE usuario_id = $1 FOR UPDATE;
-- Adicionar lançamento ao array JSONB
UPDATE estados SET dados = jsonb_set(dados, ...) WHERE usuario_id = $1;
COMMIT;

9. Criação de Recorrência via WhatsApp
9.1 Padrões de Mensagem para Recorrências
Exemplo de Mensagem	Interpretação
Todo mês pago aluguel 1500	Recorrência mensal | Saida | R$ 1.500
Recorrência mensal salário 3000	Recorrência mensal | Entrada | R$ 3.000
Toda semana mercado 150	Recorrência semanal | Saida | R$ 150

9.2 Campos da Recorrência Gerada
•	id: UUID v4
•	descricao: texto extraído
•	valor: valor extraído
•	tipo: 'Entrada' ou 'Saida'
•	periodicidade: 'mensal' | 'semanal' | 'quinzenal' (inferida da mensagem)
•	proxima_data: primeiro dia do próximo mês (ou próxima semana, conforme periodicidade)
•	dia: dia do mês (para recorrências mensais, padrão = 1 ou extraído da mensagem)
•	ativa: true
•	historico: 'Via WhatsApp'

A estrutura reutiliza exatamente a mesma lógica do RecorrenciasPage.jsx para gerar lançamentos a partir de recorrências. Nenhum novo fluxo financeiro é criado — apenas uma nova forma de entrada de dados.

10. Como Evitar Duplicidade de Lançamentos
Cenário	Mitigação
Usuário envia Sim duas vezes	Deletar o pendente imediatamente após gravação; segunda resposta não encontra pendente.
Webhook recebido duas vezes (retry)	Verificar message_id único da Evolution; ignorar se já processado (tabela de message IDs ou campo na pending).
Timeout e reenvio pelo usuário	Expiração em 24h elimina pendentes antigos; novo pendente substitui anterior.
Concorrência no JSONB	SELECT FOR UPDATE no PostgreSQL garante que apenas uma gravação ocorra por vez.
Instância Evolution duplicada	Constraint UNIQUE em whatsapp_sessions(usuario_id) impede múltiplas instâncias por tenant.

11. Segurança do Webhook
11.1 Validação HMAC-SHA256
Cada instância tem um webhook_secret único gerado no momento do registro. O segredo é armazenado em whatsapp_sessions.webhook_secret e nunca exposto ao frontend.

Fluxo de validação:
13.	Evolution envia header X-Hub-Signature-256: sha256={hash}
14.	Backend lê o body cru (antes do JSON.parse)
15.	Backend calcula HMAC-SHA256 do body com o segredo da instância
16.	Comparação timing-safe (crypto.timingSafeEqual)
17.	Se inválido: responder 403 e não processar

11.2 Variáveis de Ambiente Necessárias
Variável	Descrição
EVOLUTION_API_URL	URL base da Evolution API self-hosted (ex: https://evolution.seudominio.com)
EVOLUTION_API_KEY	Chave global de administração da Evolution API
WEBHOOK_BASE_URL	URL pública do backend CenterFlow para receber webhooks

Estas variáveis NUNCA devem ser commitadas. Adicionar ao .gitignore e usar .env.local ou variáveis de ambiente do servidor de produção.

11.3 Outras Medidas de Segurança
•	Rate limiting: máximo 10 mensagens por minuto por número de WhatsApp.
•	Allowlist de remetentes: aceitar apenas o phone_number registrado em whatsapp_sessions.
•	Log de todas as mensagens recebidas (sem dados financeiros completos) para auditoria.
•	Timeout de pendente: 24 horas — nunca manter estado indefinidamente.

12. Frontend — Tela de Conexão WhatsApp
12.1 Item de Menu
•	Adicionar 'WhatsApp' ao NAV_ITEMS (PJ e PF) na lista de navegação.
•	Rota: 'open-finance-wa' ou similar — não conflitar com 'open-finance' existente.
•	Ícone: usar ícone de mensagem do conjunto NavIcon existente.

12.2 Estados da Tela
A ConexoesBancariasPage serve de referência para o padrão visual. A nova página WhatsAppPage terá 3 estados:

Estado	UI
Desconectado	Botão 'Conectar WhatsApp'. Explicação do que o módulo faz.
Conectando (QR Code)	Exibir QR Code base64 com countdown de 60s e botão 'Cancelar'. Polling a cada 3s.
Conectado	Número vinculado, data da conexão, status 'Ativo', botão 'Desconectar'. Lista de comandos aceitos.

12.3 Exemplos de Comandos Mostrados ao Usuário
•	"Paguei conta de luz R$ 180"
•	"Recebi salário 3500"
•	"Gastei 45,90 no mercado"
•	"Todo mês pago aluguel 1500" (recorrência)
•	"Entrada mensal salário 3000" (recorrência)

13. Fases de Implementação
Cada fase é independente e pode ser implementada, testada e (se necessário) revertida sem afetar as demais.

Fase	Nome	Entregáveis
1	Infraestrutura DB	Criar tabelas whatsapp_sessions e whatsapp_pending com migration SQL. Zero impacto no sistema atual.
2	Conexão e QR Code	Endpoints /connect, /status, /qrcode, /disconnect. Frontend com os 3 estados. Sem processamento de mensagens ainda.
3	Webhook Básico	Endpoint /webhook/:instanceName com validação HMAC. Log das mensagens recebidas. Sem NLP ainda.
4	NLP + Confirmação	Extração de tipo/valor/descrição. Fluxo de confirmação Sim/Não. Gravação em whatsapp_pending.
5	Gravação de Lançamentos	Gravar lançamento avulso no JSONB após confirmação. Testes com conta real.
6	Recorrências	Suporte a criação de recorrências via WhatsApp. Reutiliza lógica do RecorrenciasPage.
7	Polimento	Rate limiting, limpeza automática de pendentes, melhoria do NLP, tela de histórico de comandos.

14. O Que NÃO Implementar Agora
Os itens abaixo estão explicitamente fora do escopo desta versão para manter o foco e reduzir risco:

•	IA generativa (GPT, Gemini, Claude API) para NLP — regex simples é suficiente na Fase 1
•	Múltiplos números por tenant — uma instância por usuário
•	Grupos do WhatsApp — apenas mensagens diretas (1:1)
•	Mídia (fotos de notas fiscais, áudios) — apenas texto
•	Relatórios financeiros por WhatsApp — consultar dados pelo app
•	Notificações proativas (vencimentos, alertas) — fase posterior
•	Suporte a múltiplos idiomas — apenas português do Brasil
•	Provedor alternativo ao Evolution API — implementar depois se necessário
•	Integração com Open Finance bancário — módulo separado já existente
•	App WhatsApp Business API oficial (Meta) — Evolution API cobre o caso de uso atual

15. Riscos e Mitigações
Risco	Probabilidade	Mitigação
WhatsApp banir número por automação	Média	Usar número dedicado. Não enviar mensagens em massa. Respeitar limites da Evolution API.
Evolution API indisponível	Baixa	Sistema continua funcionando normalmente — WhatsApp é canal adicional, não primário.
Lançamento com valor errado gravado	Baixa	Fluxo de confirmação obrigatório. Usuário vê o valor antes de confirmar.
Mensagem de terceiro interceptada	Muito Baixa	Allowlist por phone_number. Apenas o número registrado pode operar a conta.
Vazamento da chave HMAC	Muito Baixa	Chave gerada por instância, nunca exposta no frontend, rotacionável via /disconnect + /connect.

16. Checklist Pré-Implementação
Infraestrutura
•	Evolution API instalada e acessível via URL pública
•	Variáveis EVOLUTION_API_URL, EVOLUTION_API_KEY, WEBHOOK_BASE_URL configuradas no .env
•	Número de WhatsApp Business dedicado disponível para vinculação
•	URL pública do backend CenterFlow (ngrok aceitável em dev; domínio real em prod)

Banco de Dados
•	Script SQL de migration preparado (CREATE TABLE IF NOT EXISTS)
•	Backup do banco feito antes da migration
•	Constraint UNIQUE em whatsapp_sessions(usuario_id) aplicada

Segurança
•	.gitignore atualizado para excluir .env e qualquer arquivo com credenciais
•	Nenhuma chave ou token presente no código-fonte
•	Rate limiting configurado no servidor antes de expor o webhook

Testes
•	Testar fluxo completo em ambiente de dev antes de produção
•	Testar mensagem mal-formada (sem valor, sem tipo) — sistema deve pedir esclarecimento
•	Testar resposta inválida no fluxo de confirmação — sistema deve reenviar confirmação
•	Testar expiração de pendente — sistema deve descartar e não gravar
•	Testar desconexão e reconexão de instância

Este documento é um plano técnico. Nenhuma linha de código foi alterada. A implementação deve seguir as fases na ordem descrita e ser revisada antes de cada deploy.
