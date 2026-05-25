import { useState } from "react";
import { generateId } from "../finance.js";
import { useGestor } from "../GestorContext.jsx";

const cadastroFields = [
  ["codigo", "Código (TB_Codigo)", "number"],
  ["tipo", "Tipo", "text"],
  ["nome", "Nome *", "text", true],
  ["apelido", "Apelido", "text"],
  ["contato", "Contato", "text"],
  ["documento", "CPF/CNPJ", "text"],
  ["rgInscricao", "RG / Inscrição", "text"],
  ["telefone", "Telefone", "text"],
  ["email", "E-mail", "email"],
  ["endereco", "Endereço", "text", true],
  ["bairro", "Bairro", "text"],
  ["cidade", "Cidade", "text"],
  ["estado", "Estado", "text"],
];

function CadastroForm({ form, set }) {
  return (
    <div className="form-grid">
      {cadastroFields.map(([key, label, type, full]) => (
        <div className="form-group" key={key} style={full ? { gridColumn: "1 / -1" } : undefined}>
          <label className="form-label">{label}</label>
          <input
            className="form-input"
            type={type === "number" ? "number" : type === "email" ? "email" : "text"}
            value={form[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            maxLength={key === "estado" ? 2 : undefined}
            placeholder={key === "codigo" ? "Auto" : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export function ModalLancamento() {
  const { editingItem, contas, planoContas, clientes, fornecedores, closeModal, saveLancamento, lancamentos } = useGestor();
  const item = editingItem;
  const [form, setForm] = useState({
    codigo: item?.codigo ?? "",
    lote: item?.lote || "",
    data: item?.data || new Date().toISOString().slice(0, 10),
    tipo: item?.tipo || "Entrada",
    contaEntradaId: item?.contaEntradaId || "",
    contaSaidaId: item?.contaSaidaId || "",
    planoId: item?.planoId || "",
    valor: item?.valor ?? "",
    historico: item?.historico || "",
    contaContabil: item?.contaContabil || "",
    natureza: item?.natureza || "",
    exportado: item?.exportado || false,
    consiliado: item?.consiliado || false,
    clienteId: item?.clienteId || "",
    fornecedorId: item?.fornecedorId || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.data || !form.valor || !form.planoId) {
      alert("Preencha data, valor e plano de contas.");
      return;
    }
    const lote = form.lote || (() => {
      const nums = lancamentos.map((l) => parseInt(String(l.lote || "").replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      return `L${String(next).padStart(3, "0")}`;
    })();
    saveLancamento({ ...form, lote });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Lançamento" : "Novo Lançamento"}</span>
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Código (TB_Codigo)</label>
              <input className="form-input" type="number" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Auto" />
            </div>
            <div className="form-group">
              <label className="form-label">Lote</label>
              <input className="form-input" value={form.lote} onChange={(e) => set("lote", e.target.value)} placeholder="Auto se vazio" />
            </div>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input className="form-input" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-select" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option>Entrada</option>
                <option>Saida</option>
                <option>Transferencia</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor *</label>
              <input className="form-input" type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Conta Contábil</label>
              <input className="form-input" value={form.contaContabil} onChange={(e) => set("contaContabil", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Natureza</label>
              <input className="form-input" value={form.natureza} onChange={(e) => set("natureza", e.target.value)} />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            {(form.tipo === "Entrada" || form.tipo === "Transferencia") && (
              <div className="form-group">
                <label className="form-label">Conta Entrada</label>
                <select className="form-select" value={form.contaEntradaId} onChange={(e) => set("contaEntradaId", e.target.value)}>
                  <option value="">— Selecione —</option>
                  {contas.filter((c) => !c.inativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            {(form.tipo === "Saida" || form.tipo === "Transferencia") && (
              <div className="form-group">
                <label className="form-label">Conta Saída</label>
                <select className="form-select" value={form.contaSaidaId} onChange={(e) => set("contaSaidaId", e.target.value)}>
                  <option value="">— Selecione —</option>
                  {contas.filter((c) => !c.inativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Plano de Contas *</label>
              <select className="form-select" value={form.planoId} onChange={(e) => set("planoId", e.target.value)}>
                <option value="">— Selecione —</option>
                {planoContas.map((p) => <option key={p.id} value={p.id}>[{p.tipo}] {p.descricao}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cliente</label>
              <select className="form-select" value={form.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
                <option value="">— Nenhum —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fornecedor</label>
              <select className="form-select" value={form.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}>
                <option value="">— Nenhum —</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Histórico</label>
            <textarea className="form-textarea" value={form.historico} onChange={(e) => set("historico", e.target.value)} />
          </div>
          <p style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.exportado} onChange={(e) => set("exportado", e.target.checked)} />
              Exportado Domínio
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.consiliado} onChange={(e) => set("consiliado", e.target.checked)} />
              Conciliado
            </label>
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export function ModalConta() {
  const { editingItem, closeModal, contaCrud } = useGestor();
  const item = editingItem;
  const [form, setForm] = useState({
    codigo: item?.codigo ?? "",
    nome: item?.nome || "",
    apelido: item?.apelido || "",
    tipo: item?.tipo || "Banco",
    saldoInicial: item?.saldoInicial ?? 0,
    contaContabil: item?.contaContabil || "",
    codigoClassificacao: item?.codigoClassificacao ?? "",
    classificacao: item?.classificacao || "",
    nomeClassificacao: item?.nomeClassificacao || "",
    natureza: item?.natureza || "",
    inativo: item?.inativo || false,
    usarSaldo: item?.usarSaldo !== false,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    const data = {
      ...form,
      codigo: Number(form.codigo) || form.codigo,
      saldoInicial: parseFloat(form.saldoInicial) || 0,
      codigoClassificacao: form.codigoClassificacao ? Number(form.codigoClassificacao) : null,
    };
    if (item?.id) contaCrud.update(item.id, data);
    else contaCrud.add({ ...data, id: generateId() });
    closeModal();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Conta" : "Nova Conta"}</span>
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" type="number" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Conta Contábil</label>
              <input className="form-input" value={form.contaContabil} onChange={(e) => set("contaContabil", e.target.value)} placeholder="1.1.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option>Banco</option><option>Caixa</option><option>Outros</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Saldo Inicial</label>
              <input className="form-input" type="number" step="0.01" value={form.saldoInicial} onChange={(e) => set("saldoInicial", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cód. Classificação DRE</label>
              <input className="form-input" type="number" value={form.codigoClassificacao} onChange={(e) => set("codigoClassificacao", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Apelido (exibição)</label>
              <input className="form-input" value={form.apelido} onChange={(e) => set("apelido", e.target.value)} placeholder="Ex: Itaú CC" />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.usarSaldo} onChange={(e) => set("usarSaldo", e.target.checked)} />
              Usar saldo no total
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.inativo} onChange={(e) => set("inativo", e.target.checked)} />
              Inativo
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export function ModalPlano() {
  const { editingItem, closeModal, planoCrud } = useGestor();
  const item = editingItem;
  const [form, setForm] = useState({
    codigo: item?.codigo || "",
    classificacao: item?.classificacao || "RECEITA",
    descricao: item?.descricao || "",
    tipo: item?.tipo || "Receita",
    natureza: item?.natureza || "Credito",
    caixaBanco: item?.caixaBanco || "",
    contaContabil: item?.contaContabil || "",
    inativo: item?.inativo || false,
    usarSaldo: item?.usarSaldo !== false,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (item?.id) planoCrud.update(item.id, form);
    else planoCrud.add({ ...form, id: generateId() });
    closeModal();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Plano" : "Novo Plano"}</span>
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={(e) => { set("tipo", e.target.value); set("classificacao", e.target.value.toUpperCase()); }}>
                <option>Receita</option><option>Custo</option><option>Despesa</option><option>Imposto</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Natureza</label>
              <select className="form-select" value={form.natureza} onChange={(e) => set("natureza", e.target.value)}>
                <option>Credito</option><option>Debito</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Conta Contábil</label>
              <input className="form-input" value={form.contaContabil} onChange={(e) => set("contaContabil", e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Descrição</label>
              <input className="form-input" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Classificação</label>
              <input className="form-input" value={form.classificacao} onChange={(e) => set("classificacao", e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.usarSaldo} onChange={(e) => set("usarSaldo", e.target.checked)} />
              Usar saldo no DRE
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.inativo} onChange={(e) => set("inativo", e.target.checked)} />
              Inativo
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function useCadastroForm(item) {
  return useState({
    codigo: item?.codigo ?? "",
    nome: item?.nome || "",
    apelido: item?.apelido || "",
    documento: item?.documento || "",
    email: item?.email || "",
    telefone: item?.telefone || "",
    endereco: item?.endereco || "",
    bairro: item?.bairro || "",
    cidade: item?.cidade || "",
    estado: item?.estado || "",
    contato: item?.contato || "",
    tipo: item?.tipo || "",
    rgInscricao: item?.rgInscricao || "",
  });
}

export function ModalCliente() {
  const { editingItem, closeModal, clienteCrud } = useGestor();
  const item = editingItem;
  const [form, setForm] = useCadastroForm(item);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.nome) return alert("Nome obrigatório.");
    const data = { ...form, codigo: form.codigo ? Number(form.codigo) : undefined };
    if (item?.id) clienteCrud.update(item.id, data);
    else clienteCrud.add({ ...data, id: generateId(), codigo: data.codigo ?? Date.now() % 100000 });
    closeModal();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Cliente" : "Novo Cliente"}</span>
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <CadastroForm form={form} set={set} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export function ModalFornecedor() {
  const { editingItem, closeModal, fornecedorCrud } = useGestor();
  const item = editingItem;
  const [form, setForm] = useCadastroForm(item);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.nome) return alert("Nome obrigatório.");
    const data = { ...form, codigo: form.codigo ? Number(form.codigo) : undefined };
    if (item?.id) fornecedorCrud.update(item.id, data);
    else fornecedorCrud.add({ ...data, id: generateId(), codigo: data.codigo ?? Date.now() % 100000 });
    closeModal();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Fornecedor" : "Novo Fornecedor"}</span>
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <CadastroForm form={form} set={set} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
