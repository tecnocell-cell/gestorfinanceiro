# Open Finance — Pluggy (Etapa 6.4)

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OPENFINANCE_PROVIDER` | Sim (produção real) | `mock` (demo) ou `pluggy` (provedor real) |
| `OPENFINANCE_CLIENT_ID` | Sim, se `pluggy` | Client ID da aplicação no [Dashboard Pluggy](https://dashboard.pluggy.ai) |
| `OPENFINANCE_CLIENT_SECRET` | Sim, se `pluggy` | Client Secret (somente no servidor) |
| `OPENFINANCE_BASE_URL` | Sim, se `pluggy` | URL da API, ex.: `https://api.pluggy.ai` |
| `OPENFINANCE_OAUTH_REDIRECT_URL` | Não | Redirect OAuth passado ao `connect_token` |
| `OPENFINANCE_WEBHOOK_URL` | Não | Webhook opcional no `connect_token` |

Com `OPENFINANCE_PROVIDER=mock`, o **Banco Demo Fluxiva** continua disponível; credenciais Pluggy não são necessárias.

## Como obter credenciais Pluggy

1. Criar conta em [https://dashboard.pluggy.ai](https://dashboard.pluggy.ai).
2. Criar uma **Application** no dashboard.
3. Copiar **Client ID** e **Client Secret** (nunca expor no frontend).
4. Usar ambiente **Sandbox** para testes; produção exige homologação Pluggy.
5. No servidor Fluxiva, definir:
   ```env
   OPENFINANCE_PROVIDER=pluggy
   OPENFINANCE_CLIENT_ID=seu_client_id
   OPENFINANCE_CLIENT_SECRET=seu_client_secret
   OPENFINANCE_BASE_URL=https://api.pluggy.ai
   ```
6. Reiniciar `npm run server`.

## Fluxo na aplicação

1. Usuário abre **Conexões Bancárias** → seção **Open Finance real (provedor)**.
2. Se credenciais OK: **Conectar via Pluggy**.
3. Backend `POST /api/open-finance/connect/init` → `connectToken` (válido ~30 min).
4. Frontend abre widget Pluggy Connect (CDN).
5. Após autorização, widget retorna `itemId` → `POST /api/open-finance/connections/pluggy` grava conexão e contas.
6. **Sincronizar** na conexão importa transações via API Pluggy (deduplicação por fingerprint).

## Rotas API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/open-finance/status` | `demoMode`, `pluggyReady`, `canStartPluggyConnect`, `credentialsMissing` |
| POST | `/api/open-finance/connect/init` | Inicia Pluggy (requer provider `pluggy` + credenciais) |
| POST | `/api/open-finance/connections/pluggy` | Body: `{ "itemId": "..." }` — finaliza conexão |
| POST | `/api/open-finance/connections/mock` | Banco Demo Fluxiva (apenas `OPENFINANCE_PROVIDER=mock`) |
| POST | `/api/open-finance/connections/:id/sync` | Sincroniza (mock ou pluggy conforme `connection.provider`) |

## Testes

```bash
npm run server
npm run test:64
npm run test:61
```

`test:64` valida status, bloqueio de `connect/init` em modo mock e configuração Pluggy incompleta (módulo).

## Limitações (proposital)

- Não há conexão direta Nubank/Itaú sem o conector Pluggy.
- Cartões na seção **Bancos — roadmap** são apenas registro de interesse.
- Belvo permanece preparado por ENV, sem implementação nesta etapa.
