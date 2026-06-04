/**
 * Onboarding primeiro acesso — Etapa 7.1
 * Persistência: empresa.onboardingConcluido, empresa.onboardingEtapa
 */

export const PF_STEPS = [
  { id: "pf-1", title: "Seu nome", desc: "Confirme como quer ser chamado no app." },
  { id: "pf-2", title: "WhatsApp", desc: "Cadastre o número que enviará lançamentos." },
  { id: "pf-3", title: "Primeira conta", desc: "Onde seu dinheiro entra e sai." },
  { id: "pf-4", title: "Primeiro lançamento", desc: "Registre uma receita ou despesa." },
  { id: "pf-5", title: "Pronto!", desc: "Seu painel está configurado." },
];

export const PJ_STEPS = [
  { id: "pj-1", title: "Dados da empresa", desc: "Nome fantasia e identificação." },
  { id: "pj-2", title: "Conta bancária", desc: "Caixa ou banco principal." },
  { id: "pj-3", title: "Centro de custo", desc: "Organize despesas por área." },
  { id: "pj-4", title: "Primeiro cliente", desc: "Cadastre quem paga ou recebe." },
  { id: "pj-5", title: "Pronto!", desc: "Sua empresa está pronta para operar." },
];

export function stepsForTipo(isPF) {
  return isPF ? PF_STEPS : PJ_STEPS;
}

export function firstStepId(isPF) {
  return isPF ? "pf-1" : "pj-1";
}

export function isOnboardingDone(empresa) {
  return Boolean(empresa?.onboardingConcluido);
}

export function currentStepId(empresa, isPF) {
  if (isOnboardingDone(empresa)) return null;
  const steps = stepsForTipo(isPF);
  const etapa = empresa?.onboardingEtapa;
  if (etapa && steps.some((s) => s.id === etapa)) return etapa;
  return steps[0]?.id || null;
}

export function stepIndex(stepId, isPF) {
  const steps = stepsForTipo(isPF);
  const i = steps.findIndex((s) => s.id === stepId);
  return i >= 0 ? i : 0;
}

/** Sugere etapa com base no que já existe no estado (não conclui sozinho). */
export function suggestStepFromData(empresa, isPF) {
  if (!empresa || isOnboardingDone(empresa)) return null;
  if (isPF) {
    const nome = empresa.pessoa?.nome?.trim();
    if (!nome) return "pf-1";
    const hasWa = false; // verificado na página via API
    if (!hasWa) return "pf-2";
    const contas = (empresa.contas || []).filter((c) => !c.inativo);
    if (!contas.length) return "pf-3";
    const lanc = empresa.lancamentos || [];
    if (!lanc.length) return "pf-4";
    return "pf-5";
  }
  const company = empresa.company || {};
  if (!company.nomeFantasia?.trim()) return "pj-1";
  const contas = (empresa.contas || []).filter((c) => !c.inativo);
  if (!contas.length) return "pj-2";
  const cc = empresa.centroCustos || [];
  if (!cc.length) return "pj-3";
  const clientes = empresa.clientes || [];
  if (!clientes.length) return "pj-4";
  return "pj-5";
}

export function nextStepId(stepId, isPF) {
  const steps = stepsForTipo(isPF);
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0 || i >= steps.length - 1) return null;
  return steps[i + 1].id;
}

export function onboardingPatchForStep(stepId, isPF) {
  const next = nextStepId(stepId, isPF);
  if (stepId === (isPF ? "pf-5" : "pj-5")) {
    return { onboardingConcluido: true, onboardingEtapa: stepId };
  }
  return {
    onboardingConcluido: false,
    onboardingEtapa: next || stepId,
  };
}
