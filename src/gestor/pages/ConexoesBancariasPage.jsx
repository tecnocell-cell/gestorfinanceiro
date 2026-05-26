/**
 * ConexoesBancariasPage — Open Finance / Conexões Bancárias (Fase 5b)
 *
 * PREPARATÓRIO — nenhuma integração real implementada.
 * - Bancos mostrados com status "Em breve"
 * - "Avise-me" registra interesse localmente (visual)
 * - Seção de importação manual redireciona para ImportacoesPage
 * - Estrutura visual pronta para receber conectores reais futuramente
 *
 * Rollback: remover import + entradas nos PAGE_MAPs em GestorApp.jsx
 *           e os nav items em constants.js
 */
import { useState } from "react";
import { useGestor } from "../GestorContext.jsx";

// ─── Dados dos bancos ─────────────────────────────────────────────────────────

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

// ─── Roadmap ──────────────────────────────────────────────────────────────────

const ROADMAP = [
  { fase: "Concluído",  data: "Fase 1–5",  titulo: "Importação Manual",        descricao: "OFX, CSV, XLSX — disponível agora",                    done: true  },
  { fase: "Em breve",   data: "2025",      titulo: "Conector Open Finance",    descricao: "Integração com APIs do Banco Central do Brasil",        done: false },
  { fase: "Planejado",  data: "2026",      titulo: "Sincronização Automática", descricao: "Lançamentos direto da conta, sem upload manual",        done: false },
  { fase: "Futuro",     data: "2026+",     titulo: "Multi-banco + Alertas",    descricao: "Controle de todas as contas em um único painel",        done: false },
];

// ─── Formatos de importação manual ───────────────────────────────────────────

const IMPORT_TIPOS = [
  {
    icon: "📄",
    titulo: "OFX / QIF",
    descricao: "Formato padrão exportado pela maioria dos bancos brasileiros. Compatível com Itaú, Bradesco, BB, Caixa e mais.",
    dica: "No app do banco → Extrato → Exportar → OFX",
    badge: "Disponível",
  },
  {
    icon: "📊",
    titulo: "CSV / XLSX",
    descricao: "Planilha de extrato. Exportada pelo Mercado Pago, Nubank, Inter e outros bancos digitais.",
    dica: "No app do banco → Extrato → Exportar CSV",
    badge: "Disponível",
  },
  {
    icon: "✏️",
    titulo: "Extrato Manual",
    descricao: "Cadastre lançamentos manualmente a partir do extrato impresso ou PDF. Total controle sobre os dados.",
    dica: "Menu → Lançamentos → + Novo Lançamento",
    badge: "Disponível",
  },
];

// ─── Componentes ──────────────────────────────────────────────────────────────

function BancoCard({ banco, avisado, onAviso }) {
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
        onClick={() => !avisado && onAviso(banco.slug)}
        disabled={avisado}
      >
        {avisado ? "✓ Interesse registrado" : "🔔 Avise-me"}
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

function ImportCard({ tipo }) {
  return (
    <div className="of-import-card">
      <div className="of-import-icon">{tipo.icon}</div>
      <div className="of-import-titulo">{tipo.titulo}</div>
      <div className="of-import-desc">{tipo.descricao}</div>
      <div className="of-import-dica">💡 {tipo.dica}</div>
      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <span className="badge badge-cp-pago" style={{ fontSize: 10 }}>{tipo.badge}</span>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConexoesBancariasPage() {
  const { tipo } = useGestor();
  const isPF = tipo === "fisica";

  // Estado local de interesse — "Avise-me" por slug de banco
  // (sem backend agora — visual/preparatório)
  const [avisados, setAvisados] = useState(new Set());

  const handleAviso = (slug) => {
    setAvisados((prev) => new Set([...prev, slug]));
  };

  const totalAvisados = avisados.size;

  return (
    <div className="of-page">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="of-hero">
        <div className="of-hero-inner">

          <div className="of-hero-badge">⚡ Open Finance · Em preparação</div>
          <h2 className="of-hero-title">Conexões Bancárias</h2>
          <p className="of-hero-sub">
            Em breve você poderá conectar suas contas bancárias diretamente ao Gestor,
            via Open Finance. Seus lançamentos serão importados automaticamente,
            com total segurança e sem armazenar senhas.
          </p>

          <div className="of-hero-chips">
            <span className="of-chip">🔐 Sem armazenar senhas</span>
            <span className="of-chip">🏦 Padrão Banco Central BR</span>
            <span className="of-chip">🔄 Sync automático</span>
            <span className="of-chip">✋ Você controla o acesso</span>
          </div>

        </div>
      </div>

      {/* ── Bancos disponíveis ────────────────────────────────────────────── */}
      <div className="of-section">
        <div className="of-section-header">
          <div>
            <div className="of-section-title">Bancos suportados em breve</div>
            <div className="of-section-sub">
              Clique em "Avise-me" para ser notificado quando o conector estiver disponível.
              {totalAvisados > 0 && (
                <span className="of-interesse-count">
                  {totalAvisados} interesse{totalAvisados !== 1 ? "s" : ""} registrado{totalAvisados !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="of-bancos-grid">
          {BANCOS.map((banco) => (
            <BancoCard
              key={banco.slug}
              banco={banco}
              avisado={avisados.has(banco.slug)}
              onAviso={handleAviso}
            />
          ))}
        </div>
      </div>

      {/* ── Roadmap ───────────────────────────────────────────────────────── */}
      <div className="of-section of-section-alt">
        <div className="of-section-title">Roadmap de integração</div>
        <div className="of-section-sub" style={{ marginBottom: 24 }}>
          Como planejamos evoluir as conexões ao longo do tempo.
        </div>
        <div className="of-roadmap">
          {ROADMAP.map((item, i) => (
            <RoadmapItem key={item.titulo} item={item} isLast={i === ROADMAP.length - 1} />
          ))}
        </div>
      </div>

      {/* ── Importação manual ─────────────────────────────────────────────── */}
      <div className="of-section">
        <div className="of-section-title">Importação manual — disponível agora</div>
        <div className="of-section-sub" style={{ marginBottom: 20 }}>
          Enquanto as conexões automáticas não estão disponíveis, você pode importar
          extratos manualmente nos formatos abaixo.
          {!isPF && (
            <span style={{ marginLeft: 6 }}>
              Acesse <strong>Menu → Importações</strong> para usar esses recursos.
            </span>
          )}
        </div>

        <div className="of-import-grid">
          {IMPORT_TIPOS.map((tipo) => (
            <ImportCard key={tipo.titulo} tipo={tipo} />
          ))}
        </div>

        {!isPF && (
          <div className="of-import-hint">
            <span style={{ fontSize: 16 }}>📥</span>
            <span>
              Acesse <strong>Importações</strong> no menu lateral para fazer upload de arquivos OFX, CSV ou XLSX.
              Os lançamentos são importados diretamente na conta selecionada.
            </span>
          </div>
        )}
        {isPF && (
          <div className="of-import-hint">
            <span style={{ fontSize: 16 }}>📥</span>
            <span>
              Use <strong>Lançamentos → + Novo</strong> para cadastrar entradas e saídas manualmente,
              ou aguarde os conectores automáticos desta página.
            </span>
          </div>
        )}
      </div>

      {/* ── Rodapé informativo ────────────────────────────────────────────── */}
      <div className="of-footer-note">
        <span style={{ fontSize: 15 }}>🔒</span>
        <span>
          As conexões bancárias seguirão o padrão <strong>Open Finance Brasil</strong> regulamentado pelo Banco Central.
          Nenhuma senha ou token bancário será armazenado em nossos servidores.
          Você poderá revogar o acesso a qualquer momento diretamente no app do seu banco.
        </span>
      </div>

    </div>
  );
}
