/**
 * Guia de Produção — Etapa 8.0 (conteúdo operacional)
 */
import { getEmailConfigStatus } from '../emailProvider.js';
import { getWhatsappConfigStatus } from '../system/configStatus.js';
import { isMercadoPagoActive } from '../billing/gateways/mercadoPago.js';
import {
  expectedMpWebhookUrl,
  publicApiBaseUrl,
} from '../billing/billingUrls.js';
import { checkAdminMaster } from './productionCheck.js';

export const GUIDE_SECTIONS = [
  {
    id: 'mercado_pago',
    title: 'Configurar Mercado Pago',
    steps: [
      'Super Admin → Config. Pagamento → Mercado Pago.',
      'Informe Public Key e Access Token do painel Mercado Pago.',
      'Clique em «Testar conexão» e depois «Ativar».',
      'Confirme que PIX está disponível no portal do cliente.',
    ],
  },
  {
    id: 'webhook',
    title: 'Webhook Mercado Pago',
    steps: [
      'Defina PUBLIC_API_URL no servidor (ex.: https://financeiro.fluxiva.app).',
      'Copie a URL em Super Admin → Config. Pagamento → Webhooks.',
      'Cadastre no painel Mercado Pago → Webhooks → evento payment.',
      'Opcional: configure webhook_secret no Super Admin.',
    ],
  },
  {
    id: 'pix_test',
    title: 'Testar PIX',
    steps: [
      'Super Admin → Release Candidate → «Testar PIX Mercado Pago».',
      'Gere cobrança de homologação (R$ 0,01 — não ativa assinatura).',
      'Pague no app do banco ou simule webhook em sandbox.',
      'Use «Consultar status» e verifique webhooks recentes.',
      'Comandos: npm run test:mp-pix e npm run test:78.',
    ],
  },
  {
    id: 'email',
    title: 'Configurar e-mail',
    steps: [
      'Defina EMAIL_PROVIDER (resend ou smtp) no .env do servidor.',
      'Resend: RESEND_API_KEY + EMAIL_FROM.',
      'SMTP: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM.',
      'Teste cadastro/convite em ambiente de homologação.',
    ],
  },
  {
    id: 'whatsapp',
    title: 'Configurar WhatsApp',
    steps: [
      'Defina EVOLUTION_API_URL e EVOLUTION_API_KEY (ou WhatsApp-Gateway).',
      'Super Admin → Operações → painel WhatsApp.',
      'Conecte a instância e valide OTP de segurança.',
      'Sem WhatsApp, lançamentos manuais continuam disponíveis.',
    ],
  },
  {
    id: 'deploy',
    title: 'Publicar atualização',
    steps: [
      'git pull na VPS / container.',
      'npm install (se package.json mudou).',
      'npm run build && reinicie o serviço Node (PORT=3001).',
      'Confirme GET /api/health e checklist Release Candidate.',
      'Monitore logs de billing/ops nas primeiras horas.',
    ],
  },
];

export async function getProductionGuide() {
  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const mpActive = await isMercadoPagoActive();
  const adminMaster = await checkAdminMaster();
  const publicUrl = publicApiBaseUrl();

  const status = {
    mercado_pago: mpActive,
    public_api_url: Boolean(publicUrl),
    webhook_url: expectedMpWebhookUrl(),
    email: email.configured,
    whatsapp: whatsapp.configured,
    admin_master: adminMaster.ok,
  };

  return {
    sections: GUIDE_SECTIONS.map((s) => ({
      ...s,
      statusKey: s.id === 'webhook' ? 'public_api_url' : s.id === 'pix_test' ? 'mercado_pago' : s.id,
    })),
    status,
    commands: [
      'npm run check:production',
      'npm run test:mp-pix',
      'npm run test:78',
      'npm run build',
    ],
  };
}
