/**
 * ConexoesBancariasPage — Open Finance / Conexões Bancárias
 *
 * Etapa Conexões 1 (roadmap honesto):
 * - Tela clara de "em preparação" — sem prometer conexão real
 * - "Avise-me" persiste em conexoes_interesse (PostgreSQL)
 * - Cards de importação manual navegam para Importações / Lançamentos
 * - Estrutura visual pronta para conectores futuros (Pluggy/Belvo/etc.)
 */
import { useState, useEffect, useCallback } from "react";
import { useGestor } from "../GestorContext.jsx";
import { conexoesApi } from "../api.js";
import { Bell, FileText, Table, PenLine, ArrowRight, Link2, AlertCircle } from "../components/icons.jsx";

const BANCOS = [
  { slug: "nubank",    nome: "Nubank",         sigla: "Nu",   cor: "oklch(0.52 0.22 295)", descricao: "Conta + Cartão de crédito"   },
  { slug: "itau",      nome: "Itaú",            sigla: "Itaú", cor: "oklch(0.58 0.17 52)",  descricao: "Conta Corrente · PF e PJ"    },
  { slug: "bradesco",  nome: "Bradesco",        sigla: "B",    cor: "oklch(0.50 0.22 27)",  descricao: "Conta Corrente e Poupança"   },
  { slug: "bb",        nome: "Banco do Brasil", sigla: "BB",   cor: "oklch(0.63 0.14 82)",  descricao: "Conta Corrente · PF e PJ"    },
  { slug: "caixa",     nome: "Caixa",           sigla: "CEF",  cor: "oklch(0.44 0.18 240)", descricao: "Poupança + Conta Corrente"   },
  { slug: "inter",     nome: "Inter",           sigla: "Int",  cor: "oklch(0.62 0.18 52)",  descricao: "Conta Digital · PIX"         },
  { slug: "c6",        nome: "C6 Bank",         sigla: "C6",   cor: "oklch(0.28 0.02 0)",   descricao: "Conta Digital · PF e PJ"     },
  { slug: "santander", nome: "Santander",       sigla: "San",  cor: "oklch(0.48 0.22 27)",  descricao: "Conta Corrente e Investimentos" },
];

const ROADMAP = [
  { fase: "Disponível", data: "Agora",     titulo: "Importação Manual",        descricao: "OFX, CSV e XLSX via menu Importações (PJ) ou lançamentos manuais (PF)", done: true  },
  { fase: "Em breve",   data: "2025–2026", titulo: "Conector Open Finance",    descricao: "Integração com APIs reguladas — ainda não implementada",                done: false },
  { fase: "Planejado",  data: "2026",      titulo: "Sincronização Automática", descricao: "Extratos direto da conta, sem upload manual",                          done: false },
  { fase: "Futuro",     data: "2026+",     titulo: "Multi-banco + Alertas",    descricao: "Painel unificado de contas conectadas",                                done: false },
];

const IMPORT_TIPOS = [
  {
    id: "ofx",
    icon: FileText,
    titulo: "OFX / QIF",
    descricao: "Formato padrão exportado pela maioria dos bancos brasileiros. Compatível com Itaú, Bradesco, BB, Caixa e mais.",
    dica: "No app do banco → Extrato → Exportar → OFX",
    pjPage: "importacoes",
    pfPage: "lancamentos",
    pjLabel: "Ir para Importações",
    pfLabel: "Cadastrar manualmente",
  },
  {
    id: "csv",
    icon: Table,
    titulo: "CSV / XLSX",
    descricao: "Planilha de extrato. Exportada pelo Mercado Pago, Nubank, Inter e outros bancos digitais.",
    dica: "No app do banco → Extrato → Exportar CSV",
    pjPage: "importacoes",
    pfPage: "lancamentos",
    pjLabel: "Ir para Importações",
    pfLabel: "Cadastrar manualmente",
  },
  {
    id: "manual",
    icon: PenLine,
    titulo: "Extrato Manual",
    descricao: "Cadastre lançamentos a partir do extrato impresso ou PDF. Total controle sobre os dados.",
    dica: "Menu → Lançamentos → + Novo Lançamento",
    pjPage: "lancamentos",
    pfPage: "lancamentos",
    pjLabel: "Ir para Lançamentos",
    pfLabel: "Ir para Lançamentos",
  },
];

function BancoCard({ banco, avisado, loading, disabled, onAviso }) {
  return (
    <div className="of-banco-card">
      <div className="of-banco-header">
        <div className="of-banco-sigla" style={{ background: banco.cor }}>
          {banco.sigla}
        </div>
        <div className="of-badge-breve">Em breve</div>
      </div>

      <div className="of-banco-nome">{banco.nome}</div>
      <div className="of-banco-desc">{banco.descricao}</div>

      <button
        type="button"
        className={`btn btn-sm of-aviso-btn${avisado ? " of-aviso-btn-done" : ""}`}
        onClick={() => !avisado && !disabled && onAviso(banco.slug)}
        disabled={avisado || disabled || loading}
      >
        {avisado ? (
          <>✓ Interesse registrado</>
        ) : (
          <>
            <Bell size={14} strokeWidth={2} aria-hidden />
            Avise-me
          </>
        )}
      </button>
    </div>
  );
}

function RoadmapItem({ item, isLast }) {
  return (
    <div className="of-roadmap-item">
      <div className="of-roadmap-dot-wrap">
        <div className={`of-roadmap-dot${item.done ? " done" : ""}`} />
        {!isLast && <div className="of-roadmap-line" />}
      </div>
      <div className="of-roadmap-content">
        <div className="of-roadmap-fase">
          <span className={`badge ${item.done ? "badge-cp-pago" : "badge-cp-pendente"}`}>
            {item.fase}
          </span>
          <span className="of-roadmap-data">{item.data}</span>
        </div>
        <div className="of-roadmap-titulo">{item.titulo}</div>
        <div className="of-roadmap-desc">{item.descricao}</div>
      </div>
    </div>
  );
}

function ImportCard({ tipo, isPF, onNavigate }) {
  const Icon = tipo.icon;
  const targetPage = isPF ? tipo.pfPage : tipo.pjPage;
  const actionLabel = isPF ? tipo.pfLabel : tipo.pjLabel;

  return (
    <div className="of-import-card of-import-card--action">
      <div className="of-import-icon-wrap" aria-hidden>
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div className="of-import-titulo">{tipo.titulo}</div>
      <div className="of-import-desc">{tipo.descricao}</div>
      <div className="of-import-dica">{tipo.dica}</div>
      <div className="of-import-footer">
        <span className="badge badge-cp-pago of-import-badge">Disponível agora</span>
        {onNavigate && (
          <button
            type="button"
            className="btn btn-sm of-import-action-btn"
            onClick={() => onNavigate(targetPage)}
          >
            {actionLabel}
            <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConexoesBancariasPage({ onNavigate }) {
  const { tipo, viewOnly } = useGestor();
  const isPF = tipo === "fisica";

  const [avisados, setAvisados] = useState(new Set());
  const [loadingInteresse, setLoadingInteresse] = useState(true);
  const [savingSlug, setSavingSlug] = useState(null);
  const [interesseError, setInteresseError] = useState(null);

  const loadInteresses = useCallback(async () => {
    setLoadingInteresse(true);
    setInteresseError(null);
    try {
      const { interesses } = await conexoesApi.listInteresse();
      setAvisados(new Set((interesses || []).map((i) => i.banco_slug)));
    } catch {
      setInteresseError("Não foi possível carregar seus avisos. Tente recarregar a página.");
    } finally {
      setLoadingInteresse(false);
    }
  }, []);

  useEffect(() => { loadInteresses(); }, [loadInteresses]);

  const handleAviso = async (slug) => {
    if (viewOnly) return;
    setSavingSlug(slug);
    setInteresseError(null);
    try {
      await conexoesApi.registerInteresse(slug);
      setAvisados((prev) => new Set([...prev, slug]));
    } catch (err) {
      setInteresseError(err.message || "Erro ao registrar interesse.");
    } finally {
      setSavingSlug(null);
    }
  };

  const totalAvisados = avisados.size;

  return (
    <div className="of-page">

      {/* Status honesto */}
      <div className="of-status-banner" role="status">
        <AlertCircle size={18} strokeWidth={2} aria-hidden />
        <div>
          <strong>Conexão automática ainda não disponível.</strong>
          {" "}Esta área é um roadmap — nenhum banco pode ser conectado agora.
          Use a importação manual abaixo enquanto o Open Finance não estiver pronto.
        </div>
      </div>

      {/* Hero */}
      <div className="of-hero">
        <div className="of-hero-inner">
          <div className="of-hero-badge">
            <Link2 size={13} strokeWidth={2} aria-hidden />
            Open Finance · Em preparação
          </div>
          <h2 className="of-hero-title">Conexões Bancárias</h2>
          <p className="of-hero-sub">
            Estamos preparando a integração com Open Finance Brasil para importar
            extratos automaticamente — com consentimento regulado e sem armazenar senhas.
            Por enquanto, utilize importação manual ou cadastro de lançamentos.
          </p>

          <div className="of-hero-chips">
            <span className="of-chip">Sem armazenar senhas</span>
            <span className="of-chip">Padrão Banco Central BR</span>
            <span className="of-chip">Sync automático (futuro)</span>
            <span className="of-chip">Você controla o acesso</span>
          </div>
        </div>
      </div>

      {/* Bancos */}
      <div className="of-section">
        <div className="of-section-header">
          <div>
            <div className="of-section-title">Bancos na fila de integração</div>
            <div className="of-section-sub">
              Registre interesse para ser avisado quando o conector estiver disponível.
              {totalAvisados > 0 && (
                <span className="of-interesse-count">
                  {totalAvisados} interesse{totalAvisados !== 1 ? "s" : ""} registrado{totalAvisados !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {interesseError && (
          <div className="alert alert-warn" style={{ marginBottom: 14 }}>{interesseError}</div>
        )}

        <div className="of-bancos-grid">
          {BANCOS.map((banco) => (
            <BancoCard
              key={banco.slug}
              banco={banco}
              avisado={avisados.has(banco.slug)}
              loading={loadingInteresse || savingSlug === banco.slug}
              disabled={viewOnly}
              onAviso={handleAviso}
            />
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="of-section of-section-alt">
        <div className="of-section-title">Roadmap de integração</div>
        <div className="of-section-sub" style={{ marginBottom: 24 }}>
          Evolução planejada — apenas a importação manual está operacional hoje.
        </div>
        <div className="of-roadmap">
          {ROADMAP.map((item, i) => (
            <RoadmapItem key={item.titulo} item={item} isLast={i === ROADMAP.length - 1} />
          ))}
        </div>
      </div>

      {/* Importação manual */}
      <div className="of-section">
        <div className="of-section-title">Importação manual — disponível agora</div>
        <div className="of-section-sub" style={{ marginBottom: 20 }}>
          {isPF
            ? "Como Pessoa Física, cadastre lançamentos manualmente. A importação de arquivos OFX/CSV está disponível no perfil Pessoa Jurídica."
            : "Enquanto o Open Finance não está pronto, importe extratos OFX, CSV ou XLSX pelo menu Importações."}
        </div>

        <div className="of-import-grid">
          {IMPORT_TIPOS.map((t) => (
            <ImportCard key={t.id} tipo={t} isPF={isPF} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="of-import-hint">
          <span style={{ fontSize: 16 }}>📥</span>
          <span>
            {isPF ? (
              <>Use <strong>Lançamentos → + Novo</strong> para registrar entradas e saídas manualmente.</>
            ) : (
              <>Acesse <strong>Importações</strong> no menu lateral para upload de OFX, CSV ou XLSX.</>
            )}
          </span>
        </div>
      </div>

      {/* Rodapé */}
      <div className="of-footer-note">
        <span style={{ fontSize: 15 }}>🔒</span>
        <span>
          Quando implementado, o Open Finance seguirá o padrão regulado pelo Banco Central.
          Nenhuma senha bancária será armazenada — apenas tokens de consentimento gerenciados pelo provedor.
        </span>
      </div>

    </div>
  );
}
