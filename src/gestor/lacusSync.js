/** Mescla payload da API Lacus no estado web */
export function mergeSyncPayload(empresa, data) {
  const patch = {};

  if (data.contas?.length) patch.contas = data.contas;
  if (data.planoContas?.length) patch.planoContas = data.planoContas;
  if (data.lancamentos?.length) patch.lancamentos = data.lancamentos;
  if (data.clientes?.length) patch.clientes = data.clientes;
  if (data.fornecedores?.length) patch.fornecedores = data.fornecedores;

  if (data.company) {
    patch.company = {
      ...empresa.company,
      ...data.company,
      caminhoBanco: empresa.company.caminhoBanco,
      senhaBanco: empresa.company.senhaBanco,
    };
  }

  const statePatch = {};
  if (data.versaoBanco) statePatch.versaoBanco = data.versaoBanco;
  const fechamento = data.dataFechamento || data.company?.dataFechamento;
  if (fechamento) statePatch.dataFechamento = fechamento;

  return { empresaPatch: patch, statePatch, meta: data.meta };
}
