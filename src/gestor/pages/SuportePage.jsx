/**
 * SuportePage — tickets de suporte (persistência local por usuário).
 */
import { useState, useMemo } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useSupportTickets } from "../hooks/useSupportTickets.js";
import { fmtDateTime } from "../finance.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { SummaryIcon, EmptyIcon } from "../components/IconBox.jsx";
import {
  ModalShell,
  ModalSection,
  ModalFooter,
  ModalField,
} from "../components/ModalShell.jsx";
import {
  Ticket,
  Clock,
  CircleCheck,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "../components/icons.jsx";

const CATEGORIAS = [
  { value: "financeiro", label: "Financeiro" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "assinatura", label: "Assinatura" },
  { value: "equipe", label: "Equipe" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTS = [
  { value: "todos", label: "Todos os status" },
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "resolvido", label: "Resolvido" },
];

const STATUS_BADGE = {
  aberto: "pp-badge-amber",
  em_andamento: "pp-badge-blue",
  resolvido: "pp-badge-green",
};

const STATUS_LABEL = {
  aberto: "Em aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

const MAX_ANEXO_BYTES = 5 * 1024 * 1024;

function NovoTicketModal({ onClose, onCreate, viewOnly }) {
  const [categoria, setCategoria] = useState("outro");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [anexo, setAnexo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAnexo(null);
      return;
    }
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
      setError("Formato inválido. Use JPG, PNG ou GIF.");
      return;
    }
    if (file.size > MAX_ANEXO_BYTES) {
      setError("Arquivo muito grande. Máximo 5 MB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setAnexo({ nome: file.name, dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!assunto.trim()) return setError("Informe o assunto.");
    if (!descricao.trim()) return setError("Informe a descrição.");
    setLoading(true);
    setError(null);
    try {
      await onCreate({
        categoria,
        assunto,
        descricao,
        anexoNome: anexo?.nome || null,
        anexoDataUrl: anexo?.dataUrl || null,
      });
      onClose();
    } catch (e) {
      setError(e.message || "Erro ao enviar chamado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      title="Novo ticket de suporte"
      subtitle="Abra um chamado. Nossa equipe acompanha pelo e-mail cadastrado na conta."
      tone="conta"
      size="md"
      footer={
        <ModalFooter
          onClose={onClose}
          onSave={handleSubmit}
          loading={loading || viewOnly}
          saveLabel="Enviar ticket"
        />
      }
    >
      <ModalSection label="Chamado">
        <ModalField label="Categoria" required>
          <select className="form-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </ModalField>
        <ModalField label="Assunto" required>
          <input
            className="form-input"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Descreva brevemente o problema"
            autoFocus
          />
        </ModalField>
        <ModalField label="Descrição" required>
          <textarea
            className="form-textarea"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva detalhadamente seu problema ou dúvida"
            rows={5}
          />
        </ModalField>
        <ModalField
          label="Anexar imagem"
          hint="Opcional — JPG, PNG ou GIF. Máximo 5 MB."
        >
          <input
            className="form-input"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFile}
          />
          {anexo?.nome && (
            <p className="modal-field-hint">Arquivo: {anexo.nome}</p>
          )}
        </ModalField>
      </ModalSection>
      {error && <div className="modal-inline-error" role="alert">{error}</div>}
    </ModalShell>
  );
}

function SuportePageInner() {
  const { viewOnly } = useGestor();
  const { tickets, refresh, createTicket, updateStatus, removeTicket } = useSupportTickets();
  const [filtro, setFiltro] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);

  const resumo = useMemo(() => {
    const msgs = tickets.reduce((s, t) => s + (t.mensagens || 1), 0);
    return {
      total: tickets.length,
      abertos: tickets.filter((t) => t.status === "aberto").length,
      resolvidos: tickets.filter((t) => t.status === "resolvido").length,
      mensagens: msgs,
    };
  }, [tickets]);

  const filtrados = useMemo(() => {
    if (filtro === "todos") return tickets;
    return tickets.filter((t) => t.status === filtro);
  }, [tickets, filtro]);

  return (
    <div className="sys-page">
      <div className="sys-hero sys-hero--toolbar">
        <div className="sys-hero-inner">
          <h1 className="sys-hero-title">Central de Suporte</h1>
          <p className="sys-hero-sub">Abra chamados e acompanhe o status do atendimento</p>
        </div>
        <div className="sys-hero-actions">
          <button
            type="button"
            className="sys-btn sys-btn--ghost"
            onClick={refresh}
            title="Atualizar lista"
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            className="sys-btn sys-btn--primary"
            onClick={() => !viewOnly && setModalOpen(true)}
            disabled={viewOnly}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            Novo ticket
          </button>
        </div>
      </div>

      <div className="pp-summary-grid sys-summary-grid">
        <div className="pp-summary-card pp-summary-info sys-kpi-card">
          <SummaryIcon icon={Ticket} />
          <div className="pp-summary-label">Total de tickets</div>
          <div className="pp-summary-value">{resumo.total}</div>
        </div>
        <div className="pp-summary-card pp-summary-warn sys-kpi-card">
          <SummaryIcon icon={Clock} />
          <div className="pp-summary-label">Em aberto</div>
          <div className="pp-summary-value">{resumo.abertos}</div>
        </div>
        <div className="pp-summary-card pp-summary-in sys-kpi-card">
          <SummaryIcon icon={CircleCheck} />
          <div className="pp-summary-label">Resolvidos</div>
          <div className="pp-summary-value">{resumo.resolvidos}</div>
        </div>
        <div className="pp-summary-card pp-summary-muted sys-kpi-card">
          <SummaryIcon icon={MessageCircle} />
          <div className="pp-summary-label">Mensagens</div>
          <div className="pp-summary-value">{resumo.mensagens}</div>
        </div>
      </div>

      <div className="pp-card sys-panel">
        <div className="sys-panel-header">
          <span className="sys-panel-title">Meus tickets</span>
          <select
            className="form-select sys-filter-select"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Filtrar por status"
          >
            {STATUS_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <div className="pp-empty">
            <EmptyIcon icon={Ticket} />
            <div className="pp-empty-title">Nenhum ticket encontrado</div>
            <div className="pp-empty-text">
              {tickets.length === 0
                ? "Você ainda não abriu nenhum ticket de suporte."
                : "Nenhum ticket com o filtro selecionado."}
            </div>
            {!viewOnly && tickets.length === 0 && (
              <button type="button" className="pp-btn-primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Abrir primeiro ticket
              </button>
            )}
          </div>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Aberto em</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="sys-ticket-subject">{t.assunto}</div>
                      <div className="sys-ticket-preview">{t.descricao.slice(0, 80)}{t.descricao.length > 80 ? "…" : ""}</div>
                    </td>
                    <td>
                      <span className={`pp-badge ${STATUS_BADGE[t.status] || "pp-badge-muted"}`}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td className="lanc-cell-quiet" style={{ fontSize: 12 }}>{fmtDateTime(t.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="pp-row-actions">
                        {t.status !== "resolvido" && !viewOnly && (
                          <button
                            type="button"
                            className="pp-icon-btn"
                            title="Marcar como resolvido"
                            onClick={() => updateStatus(t.id, "resolvido")}
                          >
                            <CircleCheck size={14} strokeWidth={2} aria-hidden />
                          </button>
                        )}
                        {!viewOnly && (
                          <button
                            type="button"
                            className="pp-icon-btn pp-icon-btn-danger"
                            title="Excluir ticket"
                            onClick={() => {
                              if (confirm("Excluir este ticket?")) removeTicket(t.id);
                            }}
                          >
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <NovoTicketModal
          onClose={() => setModalOpen(false)}
          onCreate={createTicket}
          viewOnly={viewOnly}
        />
      )}
    </div>
  );
}

export default function SuportePage({ pfMode = false } = {}) {
  const inner = <SuportePageInner />;
  if (pfMode) {
    return (
      <PfPageShell pageId="suporte">
        {inner}
      </PfPageShell>
    );
  }
  return inner;
}
