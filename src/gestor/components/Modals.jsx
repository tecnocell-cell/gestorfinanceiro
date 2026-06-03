import { useState } from "react";
import { generateId, safeNum } from "../finance.js";
import { useGestor } from "../GestorContext.jsx";
import { isLancamentoPago } from "../pfDueDates.js";
import {
  lancamentoTipoOptions,
  contaFieldLabels,
  labelLancamentoTipo,
  isPerfilFisica,
} from "../profileLabels.js";
import { centrosCustoAtivos } from "../centroCusto.js";
import { projetosAtivos } from "../projetoFinanceiro.js";
import {
  ModalShell,
  ModalSection,
  ModalFooter,
  ModalGrid,
  ModalField,
  ModalTipoPills,
  modalToneFromTipo,
} from "./ModalShell.jsx";
import ContaInstituicaoPicker from "./ContaInstituicaoPicker.jsx";
import { CONTA_ICONES } from "../bancosBrasil.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ── Seletor de ícone / emoji ──────────────────────────────────────────────────

const EMOJI_LIST = [
  "🏠","🚗","🍔","💊","📚","🎭","🛍️","✈️","💪","🐾",
  "💰","📈","💳","🏦","🤝","📦","🔧","📊","🎓","🌿",
  "👗","💻","📱","☕","🎵","🛒","🎮","💡","🌍","⚡",
  "🏥","📮","🎁","🎯","🔑","🏋️","👥","🎬","🍷","🐕",
  "🐈","🌺","🎪","🥂","🚀","🎀","📺","🎻","🌮","🏄",
];

function ContaIconePicker({ value, onChange }) {
  return (
    <div className="conta-icone-picker" role="listbox" aria-label="Ícone da conta">
      {CONTA_ICONES.map((e) => (
        <button
          key={e}
          type="button"
          role="option"
          aria-selected={value === e}
          className={`conta-icone-btn${value === e ? " is-active" : ""}`}
          onClick={() => onChange(e)}
          title={e}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function IconePicker({ value, onChange }) {
  return (
    <div className="icone-picker">
      {EMOJI_LIST.map((e) => (
        <button
          key={e}
          type="button"
          className={`icone-btn${value === e ? " active" : ""}`}
          onClick={() => onChange(e)}
          title={e}
        >{e}</button>
      ))}
    </div>
  );
}

// ── Seletor de cor ────────────────────────────────────────────────────────────

const CORES = [
  { label: "Verde",     v: "oklch(0.55 0.14 150)" },
  { label: "Esmeralda", v: "oklch(0.55 0.18 163)" },
  { label: "Ciano",     v: "oklch(0.60 0.13 195)" },
  { label: "Azul",      v: "oklch(0.52 0.17 240)" },
  { label: "Índigo",    v: "oklch(0.52 0.18 270)" },
  { label: "Roxo",      v: "oklch(0.52 0.18 280)" },
  { label: "Rosa",      v: "oklch(0.58 0.20 330)" },
  { label: "Vermelho",  v: "oklch(0.58 0.22 27)"  },
  { label: "Laranja",   v: "oklch(0.65 0.18 50)"  },
  { label: "Âmbar",     v: "oklch(0.70 0.15 75)"  },
  { label: "Cinza",     v: "oklch(0.55 0.01 0)"   },
  { label: "Ardósia",   v: "oklch(0.50 0.03 220)" },
];

function CorPicker({ value, onChange }) {
  return (
    <div className="cor-picker">
      {CORES.map((c) => (
        <button
          key={c.v}
          type="button"
          className={`cor-btn${value === c.v ? " active" : ""}`}
          style={{ background: c.v }}
          title={c.label}
          onClick={() => onChange(c.v)}
        />
      ))}
    </div>
  );
}

// ── Preview de categoria ───────────────────────────────────────────────────────

function CatPreview({ icone, cor, descricao }) {
  if (!icone && !cor) return null;
  return (
    <span className="cat-icone" style={{ background: cor || "var(--muted)", fontSize: 16 }}>
      {icone || "◼"}
    </span>
  );
}

const Hdr = ({ onClose, title }) => (
  <div className="modal-header">
    <span className="modal-title">{title}</span>
    <button type="button" className="modal-close" onClick={onClose}>✕</button>
  </div>
);

const Ftr = ({ onClose, onSave, saveLabel = "Salvar" }) => (
  <div className="modal-footer">
    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
    <button type="button" className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
  </div>
);

function lancamentoModalMeta(formTipo, isPF, isEdit) {
  const tone = modalToneFromTipo(formTipo, isPF);
  const tipoLabel = labelLancamentoTipo(formTipo, isPF);
  if (isEdit) {
    return {
      tone,
      title: "Editar lançamento",
      subtitle: `Altere os dados deste lançamento (${tipoLabel.toLowerCase()}).`,
    };
  }
  return {
    tone,
    title: `Novo lançamento — ${tipoLabel}`,
    subtitle: `Preencha as informações abaixo para registrar uma ${tipoLabel.toLowerCase()}.`,
  };
}

function categoriaModalMeta(formTipo, isEdit) {
  const tone = formTipo === "Receita" ? "receita" : "despesa";
  const tipoLabel = formTipo === "Receita" ? "receita" : "despesa";
  if (isEdit) {
    return {
      tone,
      title: "Editar categoria",
      subtitle: "Atualize nome, ícone e cor da categoria.",
    };
  }
  return {
    tone,
    title: "Nova categoria",
    subtitle: `Cadastre uma categoria de ${tipoLabel} para classificar seus lançamentos.`,
  };
}

const CATEGORIA_TIPO_OPTIONS = [
  { value: "Receita", label: "Receita" },
  { value: "Despesa", label: "Despesa" },
];

// ─── Modal Lançamento ─────────────────────────────────────────────────────────

export function ModalLancamento() {
  const {
    editingItem, contas, planoContas, clientes, fornecedores, centroCustos, projetos,
    closeModal, saveLancamento, lancamentos, tipo,
  } = useGestor();
  const isPF = isPerfilFisica(tipo);
  const contaLabels = contaFieldLabels(isPF);
  const tipoOptions = lancamentoTipoOptions(isPF);
  const item = editingItem;
  const todayIso = new Date().toISOString().slice(0, 10);
  const initVenc = item?.vencimento || item?.data || todayIso;
  const initTipo = item?.tipo || "Entrada";

  const [form, setForm] = useState({
    codigo:       item?.codigo        ?? "",
    lote:         item?.lote          || "",
    data:         item?.data          || todayIso,
    vencimento:   initVenc,
    pago:         item?.pago ?? (item ? isLancamentoPago(item) : initTipo !== "Saida"),
    tipo:         initTipo,
    contaEntradaId: item?.contaEntradaId || "",
    contaSaidaId: item?.contaSaidaId  || "",
    planoId:      item?.planoId       || "",
    valor:        item?.valor         ?? "",
    historico:    item?.historico     || "",
    contaContabil:item?.contaContabil || "",
    natureza:     item?.natureza      || "",
    exportado:    item?.exportado     || false,
    consiliado:   item?.consiliado    || false,
    clienteId:    item?.clienteId     || "",
    fornecedorId: item?.fornecedorId  || "",
    centroCustoId: item?.centroCustoId || "",
    projetoId: item?.projetoId || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.data || !form.valor || !form.planoId) {
      alert(`Preencha data, valor e ${isPF ? "categoria" : "plano de contas"}.`);
      return;
    }
    const nums = lancamentos.map((l) => parseInt(String(l.lote || "").replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
    const lote = form.lote || `L${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
    saveLancamento({ ...form, lote });
  };

  const contasAtivas = contas.filter((c) => !c.inativo);
  const showEntrada = form.tipo === "Entrada" || form.tipo === "Transferencia";
  const showSaida   = form.tipo === "Saida"   || form.tipo === "Transferencia";

  // Filtra categorias por tipo de lançamento
  const categoriasFiltradas = planoContas.filter((p) => {
    if (p.inativo) return false;
    if (form.tipo === "Entrada") return p.tipo === "Receita";
    if (form.tipo === "Saida") {
      return isPF
        ? p.tipo === "Despesa"
        : p.tipo === "Despesa" || p.tipo === "Custo" || p.tipo === "Imposto";
    }
    if (form.tipo === "Transferencia") return true;
    return true;
  });

  const filterPlanoByTipo = (v) => planoContas.filter((p) => {
    if (p.inativo) return false;
    if (v === "Entrada") return p.tipo === "Receita";
    if (v === "Saida") {
      return isPF
        ? p.tipo === "Despesa"
        : p.tipo === "Despesa" || p.tipo === "Custo" || p.tipo === "Imposto";
    }
    return true;
  });

  // Reseta planoId se a categoria selecionada não existe mais no filtro
  const handleTipoChange = (v) => {
    const novaLista = filterPlanoByTipo(v);
    const planoValido = novaLista.some((p) => p.id === form.planoId);
    const isSaida = v === "Saida";
    setForm((prev) => ({
      ...prev,
      tipo: v,
      planoId: planoValido ? prev.planoId : "",
      vencimento: prev.vencimento || prev.data,
      pago: isSaida ? prev.pago : true,
    }));
  };

  const meta = lancamentoModalMeta(form.tipo, isPF, !!item?.id);

  return (
    <ModalShell
      onClose={closeModal}
      title={meta.title}
      subtitle={meta.subtitle}
      tone={meta.tone}
      size={isPF ? "lg" : "xl"}
      footer={
        <ModalFooter
          onClose={closeModal}
          onSave={handleSave}
          saveLabel={item?.id ? "Atualizar" : "Salvar"}
        />
      }
    >
      <ModalSection label="Tipo e valores">
        <ModalField label="Tipo" required>
          <ModalTipoPills
            value={form.tipo}
            onChange={handleTipoChange}
            options={tipoOptions}
            ariaLabel="Tipo do lançamento"
          />
        </ModalField>
        <ModalGrid cols={form.tipo === "Transferencia" ? 2 : 3}>
          <ModalField label="Data" required>
            <input className="form-input" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
          </ModalField>
          {form.tipo !== "Transferencia" && (
            <ModalField label="Valor (R$)" required className="modal-field--span-2">
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                placeholder="0,00"
              />
            </ModalField>
          )}
          {form.tipo === "Transferencia" && (
            <ModalField label="Valor (R$)" required>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                placeholder="0,00"
              />
            </ModalField>
          )}
        </ModalGrid>

        {isPF && form.tipo === "Saida" && (
          <ModalGrid cols={2}>
            <ModalField label="Vencimento">
              <input
                className="form-input"
                type="date"
                value={form.vencimento}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) => ({
                    ...p,
                    vencimento: v,
                    pago: v <= todayIso ? p.pago : false,
                  }));
                }}
              />
            </ModalField>
            <ModalField label="Pagamento">
              <label className="check-item" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={!!form.pago} onChange={(e) => set("pago", e.target.checked)} />
                Conta já paga
              </label>
              {!form.pago && (
                <p className="modal-field-hint">Você será avisado 3 dias antes do vencimento.</p>
              )}
            </ModalField>
          </ModalGrid>
        )}
      </ModalSection>

      <ModalSection label={contaLabels.section}>
        <ModalGrid cols={showEntrada && showSaida ? 2 : 1}>
          {showEntrada && (
            <ModalField label={form.tipo === "Transferencia" ? contaLabels.origem : contaLabels.entrada}>
              <select className="form-select" value={form.contaEntradaId} onChange={(e) => set("contaEntradaId", e.target.value)}>
                <option value="">— Selecione —</option>
                {contasAtivas.map((c) => <option key={c.id} value={c.id}>{c.apelido || c.nome}</option>)}
              </select>
            </ModalField>
          )}
          {showSaida && (
            <ModalField label={form.tipo === "Transferencia" ? contaLabels.destino : contaLabels.saida}>
              <select className="form-select" value={form.contaSaidaId} onChange={(e) => set("contaSaidaId", e.target.value)}>
                <option value="">— Selecione —</option>
                {contasAtivas.map((c) => <option key={c.id} value={c.id}>{c.apelido || c.nome}</option>)}
              </select>
            </ModalField>
          )}
        </ModalGrid>
      </ModalSection>

      <ModalSection label={isPF ? "Categoria" : "Classificação"}>
        <ModalField label={isPF ? "Categoria" : "Plano de contas"} required>
          <select className="form-select" value={form.planoId} onChange={(e) => set("planoId", e.target.value)}>
            <option value="">— Selecione —</option>
            {categoriasFiltradas.map((p) => (
              <option key={p.id} value={p.id}>{p.descricao}</option>
            ))}
          </select>
        </ModalField>

        {(centrosCustoAtivos(centroCustos).length > 0 || form.centroCustoId) && (
          <ModalField label="Centro de custo / projeto">
            <select
              className="form-select"
              value={form.centroCustoId}
              onChange={(e) => set("centroCustoId", e.target.value)}
            >
              <option value="">— Nenhum (opcional) —</option>
              {centrosCustoAtivos(centroCustos).map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.nome}</option>
              ))}
              {form.centroCustoId &&
                !(centroCustos || []).find((c) => c.id === form.centroCustoId && c.status === "ativo") && (
                <option value={form.centroCustoId}>Centro inativo / legado</option>
              )}
            </select>
          </ModalField>
        )}

        {(clientes?.length > 0 || form.clienteId) && (
          <ModalField label="Cliente">
            <select className="form-select" value={form.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
              <option value="">— Nenhum (opcional) —</option>
              {(clientes || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </ModalField>
        )}

        {(projetosAtivos(projetos).length > 0 || form.projetoId) && (
          <ModalField label="Projeto">
            <select
              className="form-select"
              value={form.projetoId}
              onChange={(e) => set("projetoId", e.target.value)}
            >
              <option value="">— Nenhum (opcional) —</option>
              {projetosAtivos(projetos)
                .filter((p) => !form.clienteId || p.clienteId === form.clienteId || !p.clienteId)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              {form.projetoId &&
                !(projetos || []).find((p) => p.id === form.projetoId && p.status === "ativo") && (
                <option value={form.projetoId}>Projeto inativo / legado</option>
              )}
            </select>
          </ModalField>
        )}

        {!isPF && (
          <ModalField label="Fornecedor">
            <select className="form-select" value={form.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}>
              <option value="">— Nenhum —</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </ModalField>
        )}
      </ModalSection>

      <ModalSection label="Descrição">
        <ModalField label="Histórico / observação">
          <textarea
            className="form-textarea"
            value={form.historico}
            onChange={(e) => set("historico", e.target.value)}
            placeholder="Descreva o lançamento…"
          />
        </ModalField>
      </ModalSection>

      {!isPF && (
        <ModalSection label="Identificação contábil">
          <ModalGrid cols={4}>
            <ModalField label="Código">
              <input className="form-input" type="number" value={form.codigo}
                onChange={(e) => set("codigo", e.target.value)} placeholder="Auto" />
            </ModalField>
            <ModalField label="Lote">
              <input className="form-input" value={form.lote}
                onChange={(e) => set("lote", e.target.value)} placeholder="Auto" />
            </ModalField>
            <ModalField label="Conta contábil">
              <input className="form-input" value={form.contaContabil}
                onChange={(e) => set("contaContabil", e.target.value)} />
            </ModalField>
            <ModalField label="Natureza">
              <input className="form-input" value={form.natureza}
                onChange={(e) => set("natureza", e.target.value)} />
            </ModalField>
          </ModalGrid>
          <div className="check-row">
            <label className="check-item">
              <input type="checkbox" checked={form.exportado} onChange={(e) => set("exportado", e.target.checked)} />
              Exportado Domínio
            </label>
            <label className="check-item">
              <input type="checkbox" checked={form.consiliado} onChange={(e) => set("consiliado", e.target.checked)} />
              Conciliado
            </label>
          </div>
        </ModalSection>
      )}

      {isPF && (
        <div className="check-row">
          <label className="check-item">
            <input type="checkbox" checked={form.consiliado} onChange={(e) => set("consiliado", e.target.checked)} />
            Confirmado
          </label>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Modal Conta ──────────────────────────────────────────────────────────────

export function ModalConta() {
  const { editingItem, closeModal, contaCrud, tipo } = useGestor();
  const isPF = isPerfilFisica(tipo);
  const item = editingItem;

  const [form, setForm] = useState({
    codigo:              item?.codigo              ?? "",
    nome:                item?.nome                || "",
    apelido:             item?.apelido             || "",
    tipo:                item?.tipo                || "Banco",
    instituicao:         item?.instituicao         || "",
    icone:               item?.icone               || "🏦",
    cor:                 item?.cor                 || "",
    saldoInicial:        item?.saldoInicial        ?? 0,
    contaContabil:       item?.contaContabil       || "",
    codigoClassificacao: item?.codigoClassificacao ?? "",
    classificacao:       item?.classificacao       || "",
    nomeClassificacao:   item?.nomeClassificacao   || "",
    natureza:            item?.natureza            || "",
    inativo:             item?.inativo             || false,
    usarSaldo:           item?.usarSaldo           !== false,
  });
  const [showContabilPJ, setShowContabilPJ] = useState(!!item?.contaContabil);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleInstituicao = (preset) => {
    setForm((p) => ({
      ...p,
      instituicao: preset.instituicao,
      icone: preset.icone || p.icone,
      cor: preset.cor || p.cor,
      tipo: preset.tipo || p.tipo,
      nome: p.nome.trim() ? p.nome : preset.nome,
      apelido: p.apelido.trim() ? p.apelido : preset.apelido,
    }));
  };

  const handleSave = () => {
    if (!form.nome.trim()) return alert("Informe o nome da conta.");
    const data = {
      ...form,
      codigo: Number(form.codigo) || form.codigo,
      saldoInicial: safeNum(form.saldoInicial),
      codigoClassificacao: form.codigoClassificacao ? Number(form.codigoClassificacao) : null,
      instituicao: form.instituicao || null,
      icone: form.icone || null,
      cor: form.cor || null,
    };
    if (item?.id) contaCrud.update(item.id, data);
    else contaCrud.add({ ...data, id: generateId() });
    closeModal();
  };

  const tipoOptions = isPF
    ? ["Banco", "Caixa", "Poupança", "Investimento", "Outros"]
    : ["Banco", "Caixa", "Outros"];

  const saldoFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    safeNum(form.saldoInicial)
  );

  return (
    <ModalShell
      onClose={closeModal}
      title={item?.id ? "Editar conta" : "Nova conta bancária"}
      subtitle="Escolha o banco ou tipo de conta, personalize o ícone e defina o saldo inicial."
      tone="conta"
      size="lg"
      footer={
        <ModalFooter
          onClose={closeModal}
          onSave={handleSave}
          saveLabel={item?.id ? "Atualizar" : "Criar conta"}
        />
      }
    >
      <ModalSection label="Banco ou instituição">
        <ContaInstituicaoPicker
          value={form.instituicao}
          onSelect={handleInstituicao}
        />
      </ModalSection>

      <ModalSection label="Identificação">
        <ModalGrid cols={2}>
          <ModalField label="Nome da conta" required className="modal-field--full">
            <input
              className="form-input"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Conta Nubank, Carteira…"
            />
          </ModalField>
          <ModalField label="Apelido (exibição)">
            <input
              className="form-input"
              value={form.apelido}
              onChange={(e) => set("apelido", e.target.value)}
              placeholder="Como aparece nos lançamentos"
            />
          </ModalField>
          <ModalField label="Tipo de conta">
            <select className="form-select" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {tipoOptions.map((t) => <option key={t}>{t}</option>)}
            </select>
          </ModalField>
        </ModalGrid>
      </ModalSection>

      <ModalSection label="Ícone da conta">
        <ModalField
          label="Ícone"
          hint="Toque em um ícone ou selecione um banco acima para preencher automaticamente."
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span className="cat-icone" style={{ background: form.cor || "var(--muted)", fontSize: 20 }}>
              {form.icone || "🏦"}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Pré-visualização</span>
          </div>
          <ContaIconePicker value={form.icone} onChange={(v) => set("icone", v)} />
        </ModalField>
      </ModalSection>

      <ModalSection label="Saldo">
        <div className="modal-info-box">
          <strong>Saldo inicial: {saldoFmt}</strong>
          <p>
            Use este valor se já tinha dinheiro na conta no dia em que começou a usar o sistema.
            Depois, ajuste lançamentos para refletir o saldo real do banco.
          </p>
        </div>
        <ModalGrid cols={2}>
          <ModalField label="Saldo inicial (R$)">
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={form.saldoInicial}
              onChange={(e) => set("saldoInicial", e.target.value)}
            />
          </ModalField>
          <ModalField label="Código interno" hint="Opcional — numeração automática se vazio.">
            <input
              className="form-input"
              type="number"
              value={form.codigo}
              onChange={(e) => set("codigo", e.target.value)}
              placeholder="Auto"
            />
          </ModalField>
        </ModalGrid>
      </ModalSection>

      {!isPF && (
        <ModalSection label="Contabilidade (empresa)">
          <button
            type="button"
            className="modal-advanced-toggle"
            onClick={() => setShowContabilPJ((v) => !v)}
          >
            {showContabilPJ ? "▾ Ocultar campos contábeis" : "▸ Código contábil (opcional, só PJ)"}
          </button>
          {showContabilPJ && (
            <>
              <p className="modal-field-hint" style={{ marginBottom: 12 }}>
                <strong>Contábil</strong> é o código da conta no plano contábil da empresa (ex.: 1.1.01),
                usado em exportações e relatórios PJ — não é o número da agência/conta bancária.
              </p>
              <ModalGrid cols={2}>
                <ModalField label="Conta contábil">
                  <input
                    className="form-input"
                    value={form.contaContabil}
                    onChange={(e) => set("contaContabil", e.target.value)}
                    placeholder="1.1.01"
                  />
                </ModalField>
                <ModalField label="Cód. classificação DRE">
                  <input
                    className="form-input"
                    type="number"
                    value={form.codigoClassificacao}
                    onChange={(e) => set("codigoClassificacao", e.target.value)}
                  />
                </ModalField>
              </ModalGrid>
            </>
          )}
        </ModalSection>
      )}

      <div className="check-row">
        <label className="check-item">
          <input type="checkbox" checked={form.usarSaldo} onChange={(e) => set("usarSaldo", e.target.checked)} />
          Incluir no saldo total
        </label>
        <label className="check-item">
          <input type="checkbox" checked={form.inativo} onChange={(e) => set("inativo", e.target.checked)} />
          Inativo
        </label>
      </div>
    </ModalShell>
  );
}

// ─── Modal Plano de Contas ────────────────────────────────────────────────────

export function ModalPlano() {
  const { editingItem, closeModal, planoCrud } = useGestor();
  const item = editingItem;

  const [form, setForm] = useState({
    codigo:        item?.codigo        || "",
    classificacao: item?.classificacao || "RECEITA",
    descricao:     item?.descricao     || "",
    tipo:          item?.tipo          || "Receita",
    natureza:      item?.natureza      || "Credito",
    caixaBanco:    item?.caixaBanco    || "",
    contaContabil: item?.contaContabil || "",
    inativo:       item?.inativo       || false,
    usarSaldo:     item?.usarSaldo     !== false,
    // Phase 5 — optional visual fields (retrocompatível)
    icone:         item?.icone         || "",
    cor:           item?.cor           || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleTipo = (v) => {
    const nat = v === "Receita" ? "Credito" : "Debito";
    setForm((p) => ({ ...p, tipo: v, classificacao: v.toUpperCase(), natureza: nat }));
  };

  const handleSave = () => {
    if (!form.descricao.trim()) return alert("Descrição obrigatória.");
    if (item?.id) planoCrud.update(item.id, form);
    else planoCrud.add({ ...form, id: generateId() });
    closeModal();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <Hdr onClose={closeModal} title={item?.id ? "Editar Plano" : "Novo Plano de Contas"} />

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Descrição *</label>
            <input className="form-input" value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Ex: Venda de Produtos" />
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-select" value={form.tipo} onChange={(e) => handleTipo(e.target.value)}>
                <option>Receita</option>
                <option>Custo</option>
                <option>Despesa</option>
                <option>Imposto</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Natureza</label>
              <select className="form-select" value={form.natureza} onChange={(e) => set("natureza", e.target.value)}>
                <option>Credito</option>
                <option>Debito</option>
              </select>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-label">Identificação Contábil</div>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="form-group">
                <label className="form-label">Código</label>
                <input className="form-input" value={form.codigo}
                  onChange={(e) => set("codigo", e.target.value)} placeholder="Ex: 1.1.001" />
              </div>
              <div className="form-group">
                <label className="form-label">Conta Contábil</label>
                <input className="form-input" value={form.contaContabil}
                  onChange={(e) => set("contaContabil", e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Classificação</label>
                <input className="form-input" value={form.classificacao}
                  onChange={(e) => set("classificacao", e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Fase 5: Ícone + Cor ─────────────────────────────────────── */}
          <div className="modal-section">
            <div className="modal-section-label">Visual (opcional)</div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Ícone</label>
                {form.icone && (
                  <span className="cat-icone" style={{ background: form.cor || "var(--muted)", fontSize: 18 }}>
                    {form.icone}
                  </span>
                )}
              </div>
              <IconePicker value={form.icone} onChange={(v) => set("icone", v)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cor</label>
              <CorPicker value={form.cor} onChange={(v) => set("cor", v)} />
            </div>
          </div>

          <div className="check-row">
            <label className="check-item">
              <input type="checkbox" checked={form.usarSaldo} onChange={(e) => set("usarSaldo", e.target.checked)} />
              Usar no DRE
            </label>
            <label className="check-item">
              <input type="checkbox" checked={form.inativo} onChange={(e) => set("inativo", e.target.checked)} />
              Inativo
            </label>
          </div>
        </div>

        <Ftr onClose={closeModal} onSave={handleSave} saveLabel={item?.id ? "Atualizar" : "Criar"} />
      </div>
    </div>
  );
}

// ─── Modal Cliente / Fornecedor ───────────────────────────────────────────────

function CadastroModal({ title, item, onSave, onClose }) {
  const [form, setForm] = useState({
    codigo:     item?.codigo     ?? "",
    nome:       item?.nome       || "",
    apelido:    item?.apelido    || "",
    tipo:       item?.tipo       || "",
    documento:  item?.documento  || "",
    rgInscricao:item?.rgInscricao|| "",
    contato:    item?.contato    || "",
    telefone:   item?.telefone   || "",
    email:      item?.email      || "",
    endereco:   item?.endereco   || "",
    bairro:     item?.bairro     || "",
    cidade:     item?.cidade     || "",
    estado:     item?.estado     || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.nome.trim()) return alert("Nome obrigatório.");
    onSave({ ...form, codigo: form.codigo ? Number(form.codigo) : undefined });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 780 }}>
        <Hdr onClose={onClose} title={title} />

        <div className="modal-body">
          {/* Identificação */}
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Nome / Razão Social *</label>
              <input className="form-input" value={form.nome}
                onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo ou razão social" />
            </div>
            <div className="form-group">
              <label className="form-label">Apelido</label>
              <input className="form-input" value={form.apelido}
                onChange={(e) => set("apelido", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <input className="form-input" value={form.tipo}
                onChange={(e) => set("tipo", e.target.value)} placeholder="PF / PJ" />
            </div>
            <div className="form-group">
              <label className="form-label">CPF / CNPJ</label>
              <input className="form-input" value={form.documento}
                onChange={(e) => set("documento", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">RG / Inscrição Estadual</label>
              <input className="form-input" value={form.rgInscricao}
                onChange={(e) => set("rgInscricao", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" type="number" value={form.codigo}
                onChange={(e) => set("codigo", e.target.value)} placeholder="Auto" />
            </div>
          </div>

          {/* Contato */}
          <div className="modal-section">
            <div className="modal-section-label">Contato</div>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="form-group">
                <label className="form-label">Responsável / Contato</label>
                <input className="form-input" value={form.contato}
                  onChange={(e) => set("contato", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" value={form.email}
                  onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="modal-section">
            <div className="modal-section-label">Endereço</div>
            <div className="form-grid" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Logradouro</label>
                <input className="form-input" value={form.endereco}
                  onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, complemento" />
              </div>
              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input className="form-input" value={form.bairro}
                  onChange={(e) => set("bairro", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input className="form-input" value={form.cidade}
                  onChange={(e) => set("cidade", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Estado (UF)</label>
                <input className="form-input" value={form.estado}
                  onChange={(e) => set("estado", e.target.value)} maxLength={2} placeholder="SP" />
              </div>
            </div>
          </div>
        </div>

        <Ftr onClose={onClose} onSave={handleSave} saveLabel={item?.id ? "Atualizar" : "Salvar"} />
      </div>
    </div>
  );
}

export function ModalCliente() {
  const { editingItem, closeModal, clienteCrud } = useGestor();
  const item = editingItem;
  const handleSave = (data) => {
    if (item?.id) clienteCrud.update(item.id, data);
    else clienteCrud.add({ ...data, id: generateId(), codigo: data.codigo ?? Date.now() % 100000 });
    closeModal();
  };
  return <CadastroModal title={item?.id ? "Editar Cliente" : "Novo Cliente"} item={item} onSave={handleSave} onClose={closeModal} />;
}

export function ModalFornecedor() {
  const { editingItem, closeModal, fornecedorCrud } = useGestor();
  const item = editingItem;
  const handleSave = (data) => {
    if (item?.id) fornecedorCrud.update(item.id, data);
    else fornecedorCrud.add({ ...data, id: generateId(), codigo: data.codigo ?? Date.now() % 100000 });
    closeModal();
  };
  return <CadastroModal title={item?.id ? "Editar Fornecedor" : "Novo Fornecedor"} item={item} onSave={handleSave} onClose={closeModal} />;
}

// ─── Modais Pessoa Física ─────────────────────────────────────────────────────

export function ModalCategoriaPF() {
  const { editingItem, closeModal, planoCrud } = useGestor();
  const item = editingItem;

  const [form, setForm] = useState({
    codigo:        item?.codigo        || "",
    descricao:     item?.descricao     || "",
    tipo:          item?.tipo          || "Despesa",
    classificacao: item?.classificacao || "DESPESA",
    natureza:      item?.natureza      || "Debito",
    caixaBanco:    "",
    contaContabil: "",
    inativo:       item?.inativo       || false,
    usarSaldo:     item?.usarSaldo     !== false,
    // Phase 5 — optional visual fields (retrocompatível)
    icone:         item?.icone         || "",
    cor:           item?.cor           || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleTipo = (v) => setForm((p) => ({
    ...p, tipo: v,
    classificacao: v.toUpperCase(),
    natureza: v === "Receita" ? "Credito" : "Debito",
  }));

  const handleSave = () => {
    if (!form.descricao.trim()) return alert("Descrição obrigatória.");
    const data = { ...form, classificacao: form.tipo.toUpperCase(), natureza: form.tipo === "Receita" ? "Credito" : "Debito" };
    if (item?.id) planoCrud.update(item.id, data);
    else planoCrud.add({ ...data, id: generateId() });
    closeModal();
  };

  const meta = categoriaModalMeta(form.tipo, !!item?.id);

  return (
    <ModalShell
      onClose={closeModal}
      title={meta.title}
      subtitle={meta.subtitle}
      tone={meta.tone}
      size="lg"
      footer={
        <ModalFooter
          onClose={closeModal}
          onSave={handleSave}
          saveLabel={item?.id ? "Atualizar" : "Criar categoria"}
        />
      }
    >
      <ModalSection label="Identificação">
        <ModalField label="Tipo" required>
          <ModalTipoPills
            value={form.tipo}
            onChange={handleTipo}
            options={CATEGORIA_TIPO_OPTIONS}
            ariaLabel="Tipo da categoria"
          />
        </ModalField>
        <ModalField label="Nome da categoria" required>
          <input
            className="form-input"
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Ex: Alimentação, Salário, Academia…"
            autoFocus
          />
        </ModalField>
        <ModalField label="Código" hint="Opcional — ex.: 2.9">
          <input
            className="form-input"
            value={form.codigo}
            onChange={(e) => set("codigo", e.target.value)}
            placeholder="Ex: 2.9"
          />
        </ModalField>
      </ModalSection>

      <ModalSection label="Visual (opcional)">
        <ModalField label="Ícone">
          {form.icone && (
            <span className="cat-icone" style={{ background: form.cor || "var(--muted)", fontSize: 18, marginBottom: 8, display: "inline-flex" }}>
              {form.icone}
            </span>
          )}
          <IconePicker value={form.icone} onChange={(v) => set("icone", v)} />
        </ModalField>
        <ModalField label="Cor">
          <CorPicker value={form.cor} onChange={(v) => set("cor", v)} />
        </ModalField>
      </ModalSection>

      <div className="check-row">
        <label className="check-item">
          <input type="checkbox" checked={form.inativo} onChange={(e) => set("inativo", e.target.checked)} />
          Inativo (ocultar nas listas)
        </label>
      </div>
    </ModalShell>
  );
}

export function ModalMeta() {
  const { editingItem, closeModal, metaCrud } = useGestor();
  const item = editingItem;

  const [form, setForm] = useState({
    descricao:  item?.descricao  || "",
    valorAlvo:  item?.valorAlvo  ?? "",
    valorAtual: item?.valorAtual ?? 0,
    prazo:      item?.prazo      || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.descricao.trim()) return alert("Descrição obrigatória.");
    if (!form.valorAlvo)        return alert("Valor alvo obrigatório.");
    const data = { ...form, valorAlvo: safeNum(form.valorAlvo), valorAtual: safeNum(form.valorAtual) };
    if (item?.id) metaCrud.update(item.id, data);
    else metaCrud.add({ ...data, id: generateId() });
    closeModal();
  };

  const pct = form.valorAlvo > 0 ? Math.min(((form.valorAtual || 0) / form.valorAlvo) * 100, 100) : 0;

  return (
    <ModalShell
      onClose={closeModal}
      title={item?.id ? "Editar meta" : "Nova meta de poupança"}
      subtitle="Defina o valor alvo e acompanhe o progresso da sua meta financeira."
      tone="meta"
      size="lg"
      footer={
        <ModalFooter
          onClose={closeModal}
          onSave={handleSave}
          saveLabel={item?.id ? "Atualizar" : "Criar meta"}
        />
      }
    >
      <ModalSection label="Dados da meta">
        <ModalField label="Nome da meta" required>
          <input
            className="form-input"
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Ex: Reserva de emergência, Viagem, Carro…"
            autoFocus
          />
        </ModalField>
        <ModalGrid cols={2}>
          <ModalField label="Valor alvo (R$)" required>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              value={form.valorAlvo}
              onChange={(e) => set("valorAlvo", e.target.value)}
              placeholder="0,00"
            />
          </ModalField>
          <ModalField label="Já acumulado (R$)">
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              value={form.valorAtual}
              onChange={(e) => set("valorAtual", e.target.value)}
              placeholder="0,00"
            />
          </ModalField>
          <ModalField label="Prazo" className="modal-field--full">
            <input
              className="form-input"
              value={form.prazo}
              onChange={(e) => set("prazo", e.target.value)}
              placeholder="Ex: Dez/2025 ou Dezembro de 2025"
            />
          </ModalField>
        </ModalGrid>
      </ModalSection>

      {form.valorAlvo > 0 && (
        <div className="modal-panel">
          <div className="modal-panel-label">Progresso atual</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
            <span>Percentual alcançado</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>{pct.toFixed(0)}%</span>
          </div>
          <div className="progress-wrap">
            <div className={`progress-fill ${pct >= 100 ? "green" : pct >= 50 ? "blue" : "purple"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </ModalShell>
  );
}
