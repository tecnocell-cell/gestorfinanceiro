import { useAuth } from "../AuthContext.jsx";
import { Shield } from "../components/icons.jsx";

function SuperAdminCard({ user }) {
  return (
    <div className="super-admin-card">
      <div className="super-admin-card-main">
        <div className="super-admin-icon" aria-hidden>
          <Shield size={22} strokeWidth={1.75} />
        </div>
        <div className="super-admin-card-text">
          <div className="super-admin-card-label">Super administrador</div>
          <div className="super-admin-card-name">{user?.nome || "Administrador"}</div>
          <div className="super-admin-card-email">{user?.email}</div>
        </div>
      </div>
      <div className="super-admin-badge">Conta protegida do sistema</div>
    </div>
  );
}

export default function AdminLayout({ title, subtitle, children }) {
  const { user } = useAuth();
  return (
    <div className="admin-page">
      <SuperAdminCard user={user} />
      {title && (
        <header className="admin-page-header">
          <h1 className="admin-page-title">{title}</h1>
          {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
        </header>
      )}
      <div className="admin-page-content">{children}</div>
    </div>
  );
}
