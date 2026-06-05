/**
 * Auditoria e reparo de lançamentos pagos sem conta (recorrências).
 */
import {
  auditLancamentosSemConta,
  patchContaLancamentoPago,
} from '../src/gestor/finance.js';
import { parseEstadoDados } from './integracaoPfPj/estadoMerge.js';

export function collectContasFromDados(dados) {
  const parsed = parseEstadoDados(dados);
  if (!parsed?.empresas?.length) return [];
  const { empresaAtivaId } = parsed;
  const emp =
    parsed.empresas.find((e) => e.id === empresaAtivaId) || parsed.empresas[0];
  return emp?.contas || [];
}

export function auditDadosSemConta(dados) {
  const parsed = parseEstadoDados(dados);
  if (!parsed) return { itens: [], reparaveis: 0, alertas: 0 };

  const all = [];
  for (const emp of parsed.empresas || []) {
    const contas = emp.contas || [];
    for (const item of auditLancamentosSemConta(emp.lancamentos || [], contas)) {
      all.push({ ...item, empresa: emp.nome || emp.id });
    }
  }

  return {
    itens: all,
    reparaveis: all.filter((i) => i.reparavel).length,
    alertas: all.filter((i) => !i.reparavel).length,
  };
}

export function repairDadosSemConta(dados) {
  const parsed = parseEstadoDados(dados);
  if (!parsed) return { dados, patched: 0, detalhes: [] };

  const repaired = JSON.parse(JSON.stringify(parsed));
  let patched = 0;
  const detalhes = [];

  for (const emp of repaired.empresas || []) {
    const contas = emp.contas || [];
    emp.lancamentos = (emp.lancamentos || []).map((l) => {
      const patch = patchContaLancamentoPago(l, contas);
      if (!patch) return l;
      patched += 1;
      detalhes.push({
        id: l.id,
        historico: l.historico,
        tipo: l.tipo,
        valor: l.valor,
        ...patch,
      });
      return { ...l, ...patch };
    });
  }

  return { dados: repaired, patched, detalhes };
}
