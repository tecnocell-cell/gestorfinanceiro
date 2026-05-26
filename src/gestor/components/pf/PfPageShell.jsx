import { useState, useEffect, useRef } from "react";
import { PF_PAGE_HINTS } from "../../pfHints.js";

export default function PfPageShell({ pageId, children }) {
  const hint = PF_PAGE_HINTS[pageId];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!hint) return children;

  return (
    <>
      <div ref={wrapRef} className={`pf-page-hint-wrap${open ? " is-open" : ""}`}>
        <button
          type="button"
          className={`pf-page-hint-trigger${open ? " active" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`pf-hint-${pageId}`}
          title="Como usar esta página"
        >
          <span className="pf-page-hint-trigger-icon" aria-hidden>💡</span>
          Como usar
        </button>
        {open && (
          <div id={`pf-hint-${pageId}`} className="pf-page-hint-panel" role="region" aria-label={hint.title}>
            <div className="pf-page-hint-body">
              <span className="pf-page-hint-label">{hint.title}</span>
              <p className="pf-page-hint-text">{hint.text}</p>
            </div>
          </div>
        )}
      </div>
      {children}
    </>
  );
}
