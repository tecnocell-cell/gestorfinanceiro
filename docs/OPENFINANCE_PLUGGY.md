# Open Finance — Pluggy (Etapa 6.4)

## Quem configura o quê

| Papel | Responsabilidade |
|-------|------------------|
| **Administrador Fluxiva** | Configura o `.env` **uma única vez** no servidor (credenciais globais da aplicação). |
| **Usuário final** | **Não** preenche `.env`, **não** vê `CLIENT_SECRET`. Apenas clica em conectar e autoriza o banco no widget Pluggy. |

As variáveis `OPENFINANCE_CLIENT_ID` e `OPENFINANCE_CLIENT_SECRET` são **globais do servidor Fluxiva**, não por usuário nem por tenant.

O backend usa essas credenciais para obter um `connectToken` temporário; o frontend só recebe esse token (válido ~30 min), nunca o secret.

## Variáveis de ambiente (somente servidor)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OPENFINANCE_PROVIDER` | Sim | `mock` (Banco Demo Fluxiva) ou `pluggy` (real) |
| `OPENFINANCE_CLIENT_ID` | Sim, se `pluggy` | Client ID da Application no [Dashboard Pluggy](https://dashboard.pluggy.ai) |
| `OPENFINANCE_CLIENT_SECRET` | Sim, se `pluggy` | Client Secret — **apenas no servidor** |
| `OPENFINANCE_BASE_URL` | Sim, se `pluggy` | Ex.: `https://api.pluggy.ai` |
| `OPENFINANCE_OAUTH_REDIRECT_URL` | Não | OAuth no `connect_token` |
| `OPENFINANCE_WEBHOOK_URL` | Não | Webhook opcional |

Com `OPENFINANCE_PROVIDER=mock`, o **Banco Demo Fluxiva** permanece disponível; credenciais Pluggy não são necessárias.

## Credenciais Pluggy (administrador)

1. Conta em [https://dashboard.pluggy.ai](https://dashboard.pluggy.ai).
2. Criar **Application** → copiar Client ID e Client Secret.
3. Sandbox para testes; produção após homologação Pluggy.
4. No `.env` do servidor Fluxiva:
   ```env
   OPENFINANCE_PROVIDER=pluggy
   OPENFINANCE_CLIENT_ID=seu_client_id
   OPENFINANCE_CLIENT_SECRET=seu_client_secret
   OPENFINANCE_BASE_URL=https://api.pluggy.ai
   ```
5. Reiniciar `npm run server`.

## Fluxo por usuário (10 passos)

1. Admin Fluxiva configura Pluggy no `.env` do servidor (uma vez).
2. Usuário abre **Conexões Bancárias**.
3. Usuário clica **Conectar banco via Pluggy** (visível se `provider=pluggy` e credenciais OK).
4. Frontend chama `POST /api/open-finance/connect/init` (autenticado).
5. Backend usa credenciais **globais** e retorna `connectToken`.
6. Frontend abre o **Pluggy Connect Widget** com esse token (CDN; sem secret no browser).
7. Usuário escolhe o banco no widget e autoriza.
8. Widget retorna `itemId`.
9. Frontend chama `POST /api/open-finance/connections/pluggy` com `{ "itemId": "..." }`.
10. Backend grava conexão em `openfinance_connections` vinculada ao `usuario_id` logado; usuário usa **Sincronizar** para importar transações.

Cada usuário pode ter suas próprias conexões (`usuario_id` + `provider_item_id`); o mesmo `itemId` não pode ser reutilizado por outro usuário na mesma instalação.

## UI (Comportamento)

| `OPENFINANCE_PROVIDER` | Credenciais | O que o usuário vê |
|------------------------|-------------|-------------------|
| `mock` | — | Botão **Conectar Banco Demo Fluxiva** |
| `pluggy` | Completas | Botão **Conectar banco via Pluggy** + widget |
| `pluggy` | Incompletas | Aviso: administrador deve configurar o servidor (sem pedir `.env` ao usuário) |

## Rotas API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/open-finance/status` | Status para UI (`demoMode`, `canStartPluggyConnect`, `credentialsMissing`, `credentialsScope`) |
| POST | `/api/open-finance/connect/init` | `connectToken` via credenciais globais + `clientUserId` = id do usuário logado |
| POST | `/api/open-finance/connections/pluggy` | Body `{ "itemId" }` — salva conexão do usuário logado |
| POST | `/api/open-finance/connections/mock` | Banco Demo (somente `provider=mock`) |
| POST | `/api/open-finance/connections/:id/sync` | Sincroniza transações |

Respostas de `connect/init` e `status` **nunca** incluem `CLIENT_SECRET`.

## Testes

```bash
npm run server
npm run build
npm run test:64
npm run test:61
```

## Limitações

- Não há conexão direta Nubank/Itaú sem o conector Pluggy.
- Cartões na seção **Bancos — roadmap** são apenas registro de interesse.
- Belvo preparado por ENV, sem implementação nesta etapa.
