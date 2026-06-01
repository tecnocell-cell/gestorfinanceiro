import { useState } from "react";
import {
  BANCOS_CONTA,
  BANCOS_CONTA_DESTAQUE,
  CONTA_PRESETS,
  getInstituicaoBySlug,
} from "../bancosBrasil.js";

function InstituicaoCard({ item, active, onSelect }) {
  return (
    <button
      type="button"
      className={`conta-banco-card${active ? " is-active" : ""}`}
      onClick={() => onSelect(item)}
      title={item.nome}
    >
      <span className="conta-banco-sigla" style={{ background: item.cor }}>
        {item.sigla}
      </span>
      <span className="conta-banco-nome">{item.nome}</span>
    </button>
  );
}

/**
 * Seletor visual de banco / carteira para a modal de conta.
 * onSelect: ({ slug, nome, apelido, tipo, icone, cor })
 */
export default function ContaInstituicaoPicker({ value, onSelect }) {
  const [showMore, setShowMore] = useState(false);

  const destaque = BANCOS_CONTA.filter((b) => BANCOS_CONTA_DESTAQUE.includes(b.slug));
  const restantes = BANCOS_CONTA.filter((b) => !BANCOS_CONTA_DESTAQUE.includes(b.slug));

  const apply = (item) => {
    onSelect({
      instituicao: item.slug,
      nome: item.nome,
      apelido: item.nome.split(" ")[0],
      tipo: item.tipoSugerido || "Banco",
      icone: item.icone,
      cor: item.cor,
    });
  };

  const activeSlug = value || "";

  return (
    <div className="conta-banco-picker">
      <div className="conta-banco-grid conta-banco-grid--destaque">
        {destaque.map((b) => (
          <InstituicaoCard
            key={b.slug}
            item={b}
            active={activeSlug === b.slug}
            onSelect={apply}
          />
        ))}
      </div>

      <div className="conta-banco-grid conta-banco-grid--presets">
        {CONTA_PRESETS.map((b) => (
          <InstituicaoCard
            key={b.slug}
            item={b}
            active={activeSlug === b.slug}
            onSelect={apply}
          />
        ))}
      </div>

      <button
        type="button"
        className="conta-banco-more-toggle"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
      >
        <span>{showMore ? "Menos bancos" : "Mais bancos"}</span>
        <span aria-hidden className={showMore ? "conta-banco-chevron is-flip" : "conta-banco-chevron"}>▾</span>
      </button>

      {showMore && (
        <div className="conta-banco-grid conta-banco-grid--more">
          {restantes.map((b) => (
            <InstituicaoCard
              key={b.slug}
              item={b}
              active={activeSlug === b.slug}
              onSelect={apply}
            />
          ))}
        </div>
      )}

      {activeSlug && (
        <p className="modal-field-hint">
          Selecionado: <strong>{getInstituicaoBySlug(activeSlug)?.nome || activeSlug}</strong>
        </p>
      )}
    </div>
  );
}
