/**
 * TutoriaisPage — vídeos de como usar o sistema (catálogo editável em tutorialsCatalog.js).
 */
import { useState, useMemo } from "react";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { EmptyIcon } from "../components/IconBox.jsx";
import {
  TUTORIAIS_CATALOG,
  tutorialYoutubeWatchUrl,
  tutorialEmbedUrl,
} from "../tutorialsCatalog.js";
import {
  ModalShell,
  ModalFooter,
} from "../components/ModalShell.jsx";
import {
  GraduationCap,
  Play,
  ExternalLink,
  Video,
} from "../components/icons.jsx";

function formatSyncLabel() {
  const d = new Date();
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PlayerModal({ tutorial, onClose }) {
  const embed = tutorialEmbedUrl(tutorial);
  const watch = tutorialYoutubeWatchUrl(tutorial);

  return (
    <ModalShell
      onClose={onClose}
      title={tutorial.title}
      subtitle={tutorial.category}
      tone="recorrencia"
      size="lg"
      footer={
        <ModalFooter onClose={onClose} saveLabel="Fechar" onSave={onClose} />
      }
    >
      {embed ? (
        <div className="tut-player-wrap">
          <iframe
            title={tutorial.title}
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="tut-player-placeholder">
          <Video size={40} strokeWidth={1.5} aria-hidden />
          <p><strong>Vídeo em produção</strong></p>
          <p className="modal-field-hint">
            Este tutorial será publicado em breve. Quando o link estiver disponível,
            atualizamos o catálogo em <code>tutorialsCatalog.js</code>.
          </p>
          {watch && (
            <a href={watch} target="_blank" rel="noopener noreferrer" className="pp-btn-primary tut-external-link">
              <ExternalLink size={16} strokeWidth={2} aria-hidden />
              Abrir no YouTube
            </a>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function TutorialCard({ item, onPlay }) {
  const watchUrl = tutorialYoutubeWatchUrl(item);
  const hasVideo = !!item.videoId || !!item.youtubeUrl;

  return (
    <article className="tut-card">
      <div className="tut-card-thumb" aria-hidden>
        <span className="tut-card-emoji">{item.thumb}</span>
        <span className="tut-card-cat">{item.category}</span>
      </div>
      <div className="tut-card-body">
        <h3 className="tut-card-title">{item.title}</h3>
        <span className="tut-card-duration">{item.duration}</span>
        <div className="tut-card-actions">
          <button
            type="button"
            className="tut-btn tut-btn--yt"
            disabled={!watchUrl}
            onClick={() => watchUrl && window.open(watchUrl, "_blank", "noopener,noreferrer")}
            title={watchUrl ? "Abrir no YouTube" : "Link ainda não disponível"}
          >
            <Play size={15} strokeWidth={2} aria-hidden />
            Assistir no YouTube
          </button>
          <button
            type="button"
            className="tut-btn tut-btn--here"
            onClick={() => onPlay(item)}
            title={hasVideo ? "Reproduzir aqui" : "Ver detalhes"}
          >
            <Video size={15} strokeWidth={2} aria-hidden />
            Assistir aqui
          </button>
        </div>
      </div>
    </article>
  );
}

function TutoriaisPageInner() {
  const [categoria, setCategoria] = useState("todas");
  const [player, setPlayer] = useState(null);
  const syncLabel = useMemo(() => formatSyncLabel(), []);

  const categorias = useMemo(() => {
    const set = new Set(TUTORIAIS_CATALOG.map((t) => t.category));
    return ["todas", ...Array.from(set).sort()];
  }, []);

  const lista = useMemo(() => {
    if (categoria === "todas") return TUTORIAIS_CATALOG;
    return TUTORIAIS_CATALOG.filter((t) => t.category === categoria);
  }, [categoria]);

  const publicados = TUTORIAIS_CATALOG.filter((t) => t.videoId || t.youtubeUrl).length;

  return (
    <div className="sys-page">
      <div className="sys-hero">
        <div className="sys-hero-inner">
          <div className="of-hero-badge">
            <GraduationCap size={13} strokeWidth={2} aria-hidden />
            Central de aprendizado
          </div>
          <h1 className="sys-hero-title">Tutoriais</h1>
          <p className="sys-hero-sub">
            Aprenda a usar o Fluxiva com vídeos passo a passo. Novos conteúdos serão
            publicados aqui conforme forem gravados.
          </p>
          <p className="sys-hero-meta">Última atualização do catálogo: {syncLabel}</p>
        </div>
      </div>

      <div className="pp-summary-grid sys-summary-grid sys-summary-grid--3">
        <div className="pp-summary-card pp-summary-info sys-kpi-card">
          <div className="pp-summary-label">Tutoriais no catálogo</div>
          <div className="pp-summary-value">{TUTORIAIS_CATALOG.length}</div>
        </div>
        <div className="pp-summary-card pp-summary-in sys-kpi-card">
          <div className="pp-summary-label">Com vídeo publicado</div>
          <div className="pp-summary-value">{publicados}</div>
        </div>
        <div className="pp-summary-card pp-summary-muted sys-kpi-card">
          <div className="pp-summary-label">Em breve</div>
          <div className="pp-summary-value">{TUTORIAIS_CATALOG.length - publicados}</div>
        </div>
      </div>

      <div className="pp-toolbar">
        <span className="pp-toolbar-label">Categoria</span>
        {categorias.map((c) => (
          <button
            key={c}
            type="button"
            className={`pp-chip${categoria === c ? " is-active" : ""}`}
            onClick={() => setCategoria(c)}
          >
            {c === "todas" ? "Todas" : c}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="pp-card">
          <div className="pp-empty">
            <EmptyIcon icon={GraduationCap} />
            <div className="pp-empty-title">Nenhum tutorial nesta categoria</div>
          </div>
        </div>
      ) : (
        <div className="tut-grid">
          {lista.map((item) => (
            <TutorialCard key={item.id} item={item} onPlay={setPlayer} />
          ))}
        </div>
      )}

      {player && <PlayerModal tutorial={player} onClose={() => setPlayer(null)} />}
    </div>
  );
}

export default function TutoriaisPage({ pfMode = false } = {}) {
  const inner = <TutoriaisPageInner />;
  if (pfMode) {
    return (
      <PfPageShell pageId="tutoriais">
        {inner}
      </PfPageShell>
    );
  }
  return inner;
}
