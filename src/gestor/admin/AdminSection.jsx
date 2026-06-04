/**
 * Bloco de seção padronizado nas páginas Super Admin.
 */
export default function AdminSection({ title, description, children, className = "" }) {
  return (
    <section className={`admin-section ${className}`.trim()}>
      {(title || description) && (
        <header className="admin-section-head">
          {title && <h3 className="admin-section-heading">{title}</h3>}
          {description && <p className="admin-section-desc">{description}</p>}
        </header>
      )}
      <div className="admin-section-body">{children}</div>
    </section>
  );
}
