# Guia — Homologação Asaas Sandbox (Etapa 7.5)

## Variáveis

```env
ASAAS_ENV=sandbox
ASAAS_API_KEY=sua_chave_sandbox
ASAAS_WEBHOOK_TOKEN=token_secreto_webhook
PUBLIC_API_URL=https://sua-api.exemplo.com
BILLING_USE_MOCK_GATEWAY=false
```

No painel Asaas (sandbox), cadastre o webhook:

`https://sua-api.exemplo.com/api/billing/webhook/asaas`

Eventos: `PAYMENT_CREATED`, `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`.

## Comandos

```bash
npm run billing:health
npm run check:production
npm run test:asaas:sandbox
```

`test:asaas:sandbox` valida:

1. Criar cliente e cobrança PIX no sandbox
2. Consultar cobrança
3. Checkout via API do Fluxiva
4. Webhook simulado (`PAYMENT_CONFIRMED`) → assinatura ativa
5. Logs operacionais (`billing_ops_log`)
6. Cancelar cobrança de teste no Asaas

## Checklist manual

- [ ] PIX exibido no portal (QR ou link)
- [ ] Pagamento real no sandbox confirma assinatura
- [ ] Webhook duplicado não duplica efeito
- [ ] Admin → Go-Live mostra status verde/amarelo coerente
