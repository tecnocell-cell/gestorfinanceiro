/**
 * Gestor Financeiro — Design system alinhado a globals.css (RuralNext / OKLCH)
 * Tokens institucionais · Inter + JetBrains Mono · sidebar forest · cards rn-*
 */
export const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ─── TOKENS (light — default) ─── */
  :root {
    --radius: 0.5rem;
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);

    --background: oklch(0.99 0.002 145);
    --foreground: oklch(0.24 0.018 160);
    --surface: oklch(0.985 0.002 145);
    --surface-2: oklch(0.972 0.003 150);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.22 0.02 160);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.22 0.02 160);

    --primary: oklch(0.34 0.07 155);
    --primary-foreground: oklch(0.985 0.003 145);
    --secondary: oklch(0.96 0.008 150);
    --secondary-foreground: oklch(0.24 0.05 155);
    --muted: oklch(0.965 0.006 150);
    --muted-foreground: oklch(0.5 0.015 155);
    --accent: oklch(0.93 0.03 150);
    --accent-foreground: oklch(0.24 0.05 155);
    --destructive: oklch(0.577 0.225 27.325);
    --destructive-foreground: oklch(0.985 0.003 145);
    --border: oklch(0.925 0.004 150);
    --input: oklch(0.91 0.005 150);
    --ring: oklch(0.42 0.08 155);

    --forest-900: oklch(0.24 0.05 155);
    --forest-800: oklch(0.29 0.05 155);
    --forest-700: oklch(0.34 0.07 155);
    --forest-600: oklch(0.42 0.08 155);
    --forest-500: oklch(0.52 0.11 150);
    --forest-100: oklch(0.94 0.04 150);
    --forest-50: oklch(0.97 0.02 150);
    --indicator: oklch(0.72 0.16 145);
    --gold: oklch(0.72 0.12 80);

    --success: oklch(0.55 0.14 150);
    --success-fg: oklch(0.32 0.10 150);
    --success-soft: oklch(0.95 0.04 150);
    --warning: oklch(0.70 0.15 75);
    --warning-fg: oklch(0.42 0.12 70);
    --warning-soft: oklch(0.96 0.05 85);
    --danger: oklch(0.58 0.22 27);
    --danger-fg: oklch(0.40 0.18 27);
    --danger-soft: oklch(0.96 0.04 22);
    --info: oklch(0.60 0.13 230);
    --info-fg: oklch(0.38 0.11 230);
    --info-soft: oklch(0.95 0.03 230);

    --chart-1: oklch(0.42 0.08 155);
    --chart-2: oklch(0.6 0.118 184.704);
    --chart-3: oklch(0.398 0.07 227.392);
    --chart-4: oklch(0.72 0.12 80);
    --chart-5: oklch(0.769 0.188 70.08);

    --shadow-card: 0 1px 2px color-mix(in oklab, var(--forest-900) 6%, transparent);
    --shadow-elevated: 0 4px 12px color-mix(in oklab, var(--forest-900) 10%, transparent),
                       0 1px 2px color-mix(in oklab, var(--forest-900) 6%, transparent);
    --shadow-pop: 0 12px 32px color-mix(in oklab, var(--forest-900) 18%, transparent),
                  0 2px 6px color-mix(in oklab, var(--forest-900) 8%, transparent);

    --sidebar: var(--forest-900);
    --sidebar-foreground: oklch(0.985 0.003 145);
    --sidebar-primary: var(--indicator);
    --sidebar-primary-foreground: var(--forest-900);
    --sidebar-accent: color-mix(in oklab, white 6%, var(--forest-900));
    --sidebar-accent-foreground: oklch(0.985 0.003 145);
    --sidebar-border: color-mix(in oklab, black 30%, transparent);
    --sidebar-ring: var(--indicator);
    --sidebar-width: 248px;

    --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    --font-display: var(--font-sans);
    --font-body: var(--font-sans);

    /* Aliases legados (componentes existentes) */
    --bg: var(--surface);
    --text: var(--foreground);
    --text2: var(--muted-foreground);
    --text3: color-mix(in oklab, var(--muted-foreground) 85%, transparent);
    --green: var(--success);
    --green-dark: var(--success-fg);
    --accent-bright: var(--indicator);
    --accent-light: var(--success-soft);
    --accent-hover: var(--forest-800);
    --accent2: var(--warning);
    --accent3: var(--info);
    --border-light: color-mix(in oklab, var(--border) 60%, transparent);
    --surface2: var(--surface-2);
    --surface3: var(--surface-2);
    --shadow: var(--shadow-card);
    --shadow-lg: var(--shadow-elevated);
    --radius-xs: var(--radius-sm);
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dark {
    --background: oklch(0.16 0.02 160);
    --foreground: oklch(0.97 0.005 150);
    --surface: oklch(0.18 0.02 160);
    --surface-2: oklch(0.21 0.02 160);
    --card: oklch(0.21 0.02 160);
    --card-foreground: oklch(0.97 0.005 150);
    --primary: oklch(0.72 0.16 145);
    --primary-foreground: oklch(0.18 0.04 155);
    --muted: oklch(0.27 0.03 155);
    --muted-foreground: oklch(0.7 0.02 155);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 14%);
    --ring: var(--indicator);
    --success-soft: oklch(0.30 0.06 150);
    --warning-soft: oklch(0.32 0.08 75);
    --danger-soft: oklch(0.32 0.10 27);
    --info-soft: oklch(0.30 0.08 230);
    --shadow-card: 0 1px 2px rgba(0,0,0,0.35);
    --shadow-elevated: 0 4px 14px rgba(0,0,0,0.45);
    --shadow-pop: 0 12px 36px rgba(0,0,0,0.55);
    --sidebar: oklch(0.14 0.02 160);
    --sidebar-accent: color-mix(in oklab, white 5%, oklch(0.14 0.02 160));
    --sidebar-border: rgba(255,255,255,0.08);
    --bg: var(--surface);
  }

  @keyframes rn-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rn-pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes rn-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  html { -webkit-text-size-adjust: 100%; }
  html, body, #root { height: 100%; overflow: hidden; }

  body {
    background-color: var(--surface);
    color: var(--foreground);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
    font-feature-settings: "cv11", "ss01";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  ::selection {
    background: color-mix(in oklab, var(--indicator) 35%, transparent);
  }

  /* ─── APP SHELL ─── */
  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
    position: relative;
    background: var(--surface);
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: color-mix(in oklab, var(--forest-900) 55%, transparent);
    backdrop-filter: blur(2px);
    z-index: 199;
    animation: rn-fade-in 0.15s ease-out;
  }

  /* ─── SIDEBAR (rn-admin-sidebar) ─── */
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    flex-shrink: 0;
    background-color: var(--sidebar);
    color: var(--sidebar-foreground);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 200;
    scrollbar-width: none;
    transition: transform 0.25s ease;
  }
  .sidebar::-webkit-scrollbar { display: none; }

  .sidebar-logo {
    flex-shrink: 0;
    padding: 1rem 0.875rem 0.75rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .brand-row { display: flex; align-items: center; gap: 10px; }

  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--sidebar-primary);
    color: var(--sidebar-primary-foreground);
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: -0.03em;
  }

  .sidebar-logo h1 {
    font-size: 13px;
    font-weight: 600;
    color: var(--sidebar-foreground);
    line-height: 1.15;
    letter-spacing: -0.01em;
  }

  .sidebar-logo p {
    font-size: 10px;
    color: color-mix(in oklab, var(--sidebar-foreground) 55%, transparent);
    margin-top: 2px;
    font-weight: 500;
  }

  .brand-tag {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--sidebar-primary);
    margin-bottom: 2px;
  }

  .admin-block { padding: 0 0.625rem 4px; }
  .admin-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold);
    padding: 8px 6px 6px;
  }

  .admin-nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
    margin-bottom: 4px;
    border: 1px solid color-mix(in oklab, var(--gold) 25%, transparent);
    background: color-mix(in oklab, var(--gold) 8%, transparent);
    color: var(--gold);
  }
  .admin-nav-btn:hover { background: color-mix(in oklab, var(--gold) 14%, transparent); }
  .admin-nav-btn.active {
    background: color-mix(in oklab, var(--sidebar-primary) 18%, transparent);
    border-color: color-mix(in oklab, var(--sidebar-primary) 40%, transparent);
    color: var(--sidebar-primary);
  }
  .admin-nav-title { font-size: 13px; font-weight: 600; line-height: 1.2; }
  .admin-nav-sub { font-size: 10px; color: color-mix(in oklab, var(--sidebar-foreground) 50%, transparent); margin-top: 2px; }
  .admin-nav-btn.active .admin-nav-sub { color: color-mix(in oklab, var(--sidebar-primary) 70%, transparent); }

  .gestor-link-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    background: var(--sidebar-accent);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-accent-foreground);
    margin-top: 6px;
    transition: background-color 0.15s;
  }
  .gestor-link-btn:hover { background: color-mix(in oklab, white 10%, var(--forest-900)); }
  .gestor-link-btn-title { font-size: 13px; font-weight: 600; }
  .gestor-link-btn-sub { font-size: 10px; color: color-mix(in oklab, var(--sidebar-foreground) 50%, transparent); margin-top: 2px; }

  .sidebar-divider {
    height: 1px;
    background: var(--sidebar-border);
    margin: 10px 0 6px;
  }

  .nav-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 6px 0 8px;
    overflow: hidden;
  }

  .nav-label {
    flex-shrink: 0;
    font-size: 10px;
    color: color-mix(in oklab, var(--sidebar-foreground) 45%, transparent);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0 1rem 8px;
  }

  .nav-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 0 0.5rem 8px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklab, var(--sidebar-foreground) 20%, transparent) transparent;
  }
  .nav-list::-webkit-scrollbar { width: 4px; }
  .nav-list::-webkit-scrollbar-thumb {
    background: color-mix(in oklab, var(--sidebar-foreground) 22%, transparent);
    border-radius: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0.5rem;
    min-height: 32px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 500;
    color: color-mix(in oklab, var(--sidebar-foreground) 75%, transparent);
    transition: background-color 0.15s, color 0.15s;
    line-height: 1.2;
    border: 1px solid transparent;
  }
  .nav-item:hover {
    background: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
  }
  .nav-item.active {
    background: color-mix(in oklab, var(--sidebar-primary) 15%, transparent);
    color: var(--sidebar-primary);
    font-weight: 600;
    border-color: color-mix(in oklab, var(--sidebar-primary) 25%, transparent);
  }

  .nav-icon {
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    background: color-mix(in oklab, white 5%, transparent);
    flex-shrink: 0;
    transition: background-color 0.15s;
  }
  .nav-item.active .nav-icon {
    background: color-mix(in oklab, var(--sidebar-primary) 20%, transparent);
    color: var(--sidebar-primary);
  }

  .nav-item span:last-child {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer {
    flex-shrink: 0;
    padding: 0.625rem 0.75rem 0.75rem;
    border-top: 1px solid var(--sidebar-border);
    background: color-mix(in oklab, black 12%, transparent);
  }

  .sidebar-user-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.625rem;
    background: var(--sidebar-accent);
    border: 1px solid var(--sidebar-border);
    border-radius: var(--radius-md);
    margin-bottom: 8px;
  }
  .sidebar-user-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--sidebar-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar-user-role {
    font-size: 10px;
    color: color-mix(in oklab, var(--sidebar-foreground) 50%, transparent);
    margin-top: 2px;
  }

  .btn-logout {
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: var(--radius-sm);
    color: color-mix(in oklab, var(--sidebar-foreground) 70%, transparent);
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    flex-shrink: 0;
    margin-left: 6px;
    transition: background-color 0.15s, color 0.15s;
  }
  .btn-logout:hover {
    background: color-mix(in oklab, var(--danger) 15%, transparent);
    color: var(--danger-soft);
    border-color: color-mix(in oklab, var(--danger) 30%, transparent);
  }

  .sidebar-footer-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--sidebar-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar-footer-cnpj {
    font-size: 9px;
    color: color-mix(in oklab, var(--sidebar-foreground) 45%, transparent);
    margin-top: 1px;
    font-family: var(--font-mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer-profile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .sidebar-footer-info { min-width: 0; flex: 1; }
  .sidebar-footer-switch {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--sidebar-border);
    background: var(--sidebar-accent);
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: color-mix(in oklab, var(--sidebar-foreground) 70%, transparent);
    transition: background-color 0.15s;
  }
  .sidebar-footer-switch:hover {
    background: color-mix(in oklab, white 10%, var(--forest-900));
    color: var(--sidebar-primary);
  }

  /* ─── MAIN ─── */
  .main {
    flex: 1;
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
  }

  .topbar {
    flex-shrink: 0;
    height: 56px;
    background: var(--card);
    border-bottom: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.25rem 0 1rem;
    gap: 12px;
    box-shadow: var(--shadow-card);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .menu-toggle {
    display: none;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    cursor: pointer;
    font-size: 18px;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background-color 0.15s;
  }
  .menu-toggle:hover { border-color: var(--forest-600); background: var(--forest-50); }

  .topbar-title {
    font-size: clamp(1.05rem, 0.95rem + 0.5vw, 1.25rem);
    font-weight: 600;
    color: var(--foreground);
    letter-spacing: -0.005em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .topbar-user {
    font-size: 12px;
    color: var(--muted-foreground);
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-super-admin {
    font-size: 9px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: var(--radius-sm);
    background: color-mix(in oklab, var(--gold) 15%, transparent);
    color: var(--gold);
    border: 1px solid color-mix(in oklab, var(--gold) 30%, transparent);
    letter-spacing: 0.06em;
  }

  .company-badge {
    font-size: 11px;
    color: var(--muted-foreground);
    font-weight: 500;
    background: var(--surface-2);
    padding: 5px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }
  .status-dot.online {
    background: var(--success);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--success) 25%, transparent);
  }
  .status-dot.offline { background: var(--muted-foreground); }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1.25rem 1.5rem 1.75rem;
    animation: rn-pop-in 0.3s ease-out;
    position: relative;
  }

  /* ─── CARDS (rn-card) ─── */
  .card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    padding: 1.125rem 1.25rem;
    box-shadow: var(--shadow-card);
    margin-bottom: 14px;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .card:hover {
    box-shadow: var(--shadow-elevated);
    border-color: color-mix(in oklab, var(--forest-600) 25%, transparent);
  }

  .card-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: color-mix(in oklab, var(--foreground) 80%, transparent);
    margin-bottom: 14px;
  }

  /* ─── KPI (rn-kpi) ─── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.875rem;
    margin-bottom: 1.25rem;
  }

  .kpi-card {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: 0.875rem 1rem;
    min-height: 118px;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.15s, transform 0.15s;
    border-left: 3px solid var(--kpi-color, var(--forest-700));
  }
  .kpi-card:hover {
    box-shadow: var(--shadow-elevated);
    transform: translateY(-1px);
  }

  .kpi-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted-foreground);
  }

  .kpi-value {
    font-family: var(--font-mono);
    font-size: 26px;
    font-weight: 600;
    margin-top: 8px;
    color: var(--kpi-color, var(--foreground));
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .kpi-sub { font-size: 11px; color: var(--muted-foreground); margin-top: 6px; }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 1.25rem;
  }
  .charts-grid.full { grid-template-columns: 1fr; }

  /* ─── TABELAS (rn-table) ─── */
  .table-wrap {
    overflow-x: auto;
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    background: var(--card);
    box-shadow: var(--shadow-card);
  }

  table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }

  thead th {
    padding: 0.625rem 1rem;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in oklab, var(--muted-foreground) 80%, transparent);
    background: transparent;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  tbody tr { transition: background-color 0.12s; }
  tbody tr:hover td {
    background: color-mix(in oklab, var(--forest-50) 50%, var(--card)) !important;
  }
  tbody tr.lanc-row td:first-child {
    box-shadow: inset 3px 0 0 transparent;
  }
  tbody tr.lanc-row-entrada td {
    background: color-mix(in oklab, var(--info) 7%, var(--card));
  }
  tbody tr.lanc-row-entrada td:first-child { box-shadow: inset 3px 0 0 var(--info); }
  tbody tr.lanc-row-pago td {
    background: color-mix(in oklab, var(--success) 7%, var(--card));
  }
  tbody tr.lanc-row-pago td:first-child { box-shadow: inset 3px 0 0 var(--success); }
  tbody tr.lanc-row-vencida td {
    background: color-mix(in oklab, var(--destructive) 8%, var(--card));
  }
  tbody tr.lanc-row-vencida td:first-child { box-shadow: inset 3px 0 0 var(--destructive); }
  tbody tr.lanc-row-proximo td {
    background: color-mix(in oklab, var(--warning) 10%, var(--card));
  }
  tbody tr.lanc-row-proximo td:first-child { box-shadow: inset 3px 0 0 var(--warning); }
  tbody td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
    color: color-mix(in oklab, var(--foreground) 90%, transparent);
    background: var(--card);
    vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }

  .td-mono { font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums; }
  .td-green { color: var(--success-fg); font-family: var(--font-mono); }
  .td-red { color: var(--danger-fg); font-family: var(--font-mono); }
  .td-blue { color: var(--info-fg); font-family: var(--font-mono); }
  .td-amber { color: var(--warning-fg); font-family: var(--font-mono); }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    font-size: 11px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
  }
  .badge-green { background: var(--success-soft); color: var(--success-fg); }
  .badge-red { background: var(--danger-soft); color: var(--danger-fg); }
  .badge-blue { background: var(--info-soft); color: var(--info-fg); }
  .badge-amber { background: var(--warning-soft); color: var(--warning-fg); }
  .badge-pf { background: var(--info-soft); color: var(--info-fg); }
  .badge-pj { background: var(--success-soft); color: var(--success-fg); }

  /* ─── FORMULÁRIOS (rn-input / rn-btn) ─── */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .form-group { display: flex; flex-direction: column; gap: 6px; }

  .form-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
    margin-bottom: 0.125rem;
  }

  .form-input, .form-select, .form-textarea {
    width: 100%;
    background: var(--surface-2);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.4375rem 0.75rem;
    font-size: 13px;
    line-height: 1.4;
    outline: none;
    font-family: var(--font-sans);
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  .form-input::placeholder, .form-textarea::placeholder { color: var(--muted-foreground); }
  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: var(--forest-600);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--forest-600) 15%, transparent);
    background: var(--card);
  }
  .form-textarea { min-height: 84px; resize: vertical; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 2.25rem;
    padding: 0 0.875rem;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: background-color 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
    user-select: none;
  }
  .btn:disabled { opacity: 0.5; pointer-events: none; }

  .btn-primary {
    background: var(--forest-700);
    color: var(--primary-foreground);
    box-shadow: var(--shadow-card);
  }
  .btn-primary:hover { background: var(--forest-800); }

  .btn-secondary {
    background: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { border-color: var(--forest-600); background: var(--forest-50); }

  .btn-danger {
    background: var(--destructive);
    color: var(--destructive-foreground);
  }
  .btn-danger:hover { filter: brightness(0.95); }

  .btn-sm { height: 1.875rem; padding: 0 0.625rem; font-size: 12px; }
  .btn-icon { width: 2.25rem; padding: 0; }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 10px;
  }
  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }

  .filter-chip {
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    cursor: pointer;
    border: 1px solid var(--border);
    color: var(--muted-foreground);
    background: var(--card);
    font-weight: 500;
    transition: all 0.15s;
  }
  .filter-chip:hover { border-color: var(--forest-600); color: var(--foreground); }
  .filter-chip.active {
    background: var(--success-soft);
    color: var(--success-fg);
    border-color: color-mix(in oklab, var(--success) 25%, transparent);
    font-weight: 600;
  }

  .search-wrap { position: relative; }
  .search-icon {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted-foreground);
    font-size: 13px;
  }
  .search-input { padding-left: 32px; width: 220px; }

  .period-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted-foreground);
  }
  .period-selector select {
    padding: 0.4375rem 0.75rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--foreground);
    font-size: 12px;
    outline: none;
    cursor: pointer;
    font-family: var(--font-sans);
  }
  .period-selector select:focus {
    border-color: var(--forest-600);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--forest-600) 15%, transparent);
  }

  /* ─── MODAL (rn-modal) ─── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: color-mix(in oklab, var(--forest-900) 55%, transparent);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: rn-fade-in 0.15s ease-out;
  }

  .modal {
    background: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 820px;
    max-height: 92vh;
    overflow-y: auto;
    box-shadow: var(--shadow-pop);
    animation: rn-pop-in 0.18s ease-out;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--card);
    z-index: 1;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .modal-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.005em;
    color: var(--foreground);
  }

  .modal-body { padding: 1.25rem; }

  .modal-section {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid var(--border-light);
  }

  .modal-section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted-foreground);
    margin-bottom: 14px;
  }

  .modal-footer {
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    background: var(--surface-2);
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
    position: sticky;
    bottom: 0;
  }

  .check-row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-top: 18px;
    padding: 14px 16px;
    background: var(--surface-2);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted-foreground);
    cursor: pointer;
    user-select: none;
  }
  .check-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--forest-700);
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--muted-foreground);
  }

  .saldo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 12px;
  }

  .saldo-card {
    background: var(--surface-2);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .saldo-card:hover {
    border-color: color-mix(in oklab, var(--forest-600) 30%, transparent);
    box-shadow: var(--shadow-card);
  }

  .saldo-tipo {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted-foreground);
  }
  .saldo-nome {
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    margin-top: 4px;
  }
  .saldo-valor {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--success-fg);
    margin-top: 6px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .dre-total td { font-weight: 600; background: var(--surface-2) !important; }

  .import-box {
    border: 2px dashed var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    text-align: center;
    background: var(--surface-2);
    transition: border-color 0.15s;
  }
  .import-box:hover { border-color: var(--forest-600); }

  .alert {
    padding: 12px 16px;
    border-radius: var(--radius-md);
    margin-bottom: 14px;
    font-size: 13px;
  }
  .alert-info { background: var(--info-soft); color: var(--info-fg); border: 1px solid color-mix(in oklab, var(--info) 25%, transparent); }
  .alert-success { background: var(--success-soft); color: var(--success-fg); border: 1px solid color-mix(in oklab, var(--success) 25%, transparent); }
  .alert-warn { background: var(--warning-soft); color: var(--warning-fg); border: 1px solid color-mix(in oklab, var(--warning) 25%, transparent); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .import-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }

  .progress-wrap {
    height: 8px;
    background: var(--muted);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 6px;
  }
  .progress-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.4s ease;
  }
  .progress-fill.green  { background: var(--success); }
  .progress-fill.amber  { background: var(--warning); }
  .progress-fill.red    { background: var(--danger); }
  .progress-fill.blue   { background: var(--info); }
  .progress-fill.purple { background: var(--chart-3); }

  .meta-card {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    padding: 18px 20px;
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s;
  }
  .meta-card:hover { box-shadow: var(--shadow-elevated); }

  .meta-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .meta-title { font-weight: 600; font-size: 14px; }
  .meta-values { font-size: 12px; color: var(--muted-foreground); margin-bottom: 6px; }
  .meta-prazo { font-size: 11px; color: var(--muted-foreground); margin-top: 6px; }

  .profile-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.15s;
    background: var(--card);
  }
  .profile-item:hover { background: var(--forest-50); }
  .profile-item.active {
    background: var(--success-soft);
    border-color: color-mix(in oklab, var(--success) 25%, transparent);
  }
  .profile-item-name { font-weight: 600; font-size: 13px; }
  .profile-item-sub { font-size: 11px; color: var(--muted-foreground); margin-top: 2px; font-family: var(--font-mono); }

  .orcamento-row {
    display: grid;
    grid-template-columns: 1fr 130px 130px 130px 90px 80px;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-light);
    font-size: 13px;
  }
  .orcamento-row:last-child { border-bottom: none; }
  .orcamento-header {
    background: var(--surface-2);
    color: var(--muted-foreground);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }
  .orcamento-input {
    width: 100%;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--foreground);
    font-size: 13px;
    text-align: right;
    font-family: var(--font-mono);
  }
  .orcamento-input:focus {
    border-color: var(--forest-600);
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--forest-600) 15%, transparent);
  }

  /* ─── LOGIN (rn-hero-forest + card) ─── */
  .login-page {
    min-height: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 24px;
    overflow: hidden;
    background: var(--surface);
    box-sizing: border-box;
  }

  /* Mesma caixa fixa para login e cadastro */
  .login-card {
    --auth-card-width: 420px;
    --auth-card-height: 620px;
    width: 100%;
    max-width: var(--auth-card-width);
    height: min(var(--auth-card-height), calc(100vh - 40px));
    max-height: calc(100vh - 40px);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-pop);
    animation: rn-pop-in 0.35s ease-out;
  }

  @media (max-height: 680px) {
    .login-card {
      height: calc(100vh - 40px);
    }
  }

  .login-header {
    flex: 0 0 auto;
    padding: 2.5rem 2rem 2rem;
    text-align: center;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    overflow: hidden;
    background: linear-gradient(135deg, var(--forest-900) 0%, var(--forest-800) 55%, var(--forest-700) 100%);
    color: var(--primary-foreground);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .login-logo {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-lg);
    margin: 0 auto 1rem;
    background: var(--sidebar-primary);
    color: var(--sidebar-primary-foreground);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .login-brand {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--sidebar-primary);
    margin-bottom: 10px;
  }

  .login-title {
    font-size: 1.375rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 6px;
    color: var(--primary-foreground);
  }

  .login-subtitle {
    font-size: 13px;
    margin: 0;
    color: color-mix(in oklab, var(--primary-foreground) 75%, transparent);
  }

  .login-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 2rem 2rem 1.5rem;
  }

  .auth-form-fill {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .auth-form-fields {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    gap: 0;
  }

  .auth-form-actions {
    flex: 0 0 auto;
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .login-body > .login-footer {
    flex: 0 0 auto;
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .register-body > .login-footer {
    padding-top: 0.375rem;
    font-size: 11px;
  }

  .login-error {
    background: var(--danger-soft);
    border: 1px solid color-mix(in oklab, var(--danger) 25%, transparent);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    color: var(--danger-fg);
    font-size: 13px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .login-submit {
    width: 100%;
    height: 2.75rem;
    border-radius: var(--radius-md);
    border: none;
    background: var(--forest-700);
    color: var(--primary-foreground);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    font-family: var(--font-sans);
    box-shadow: var(--shadow-card);
    transition: background-color 0.15s;
  }
  .login-submit:hover:not(:disabled) { background: var(--forest-800); }
  .login-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .login-link-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--primary);
    cursor: pointer;
    text-decoration: underline;
  }
  .login-link-btn:hover { color: var(--forest-800); }

  /* Cadastro: header verde menor + campos com espaçamento fixo (sem sobrepor) */
  .register-card .login-header {
    padding: 1rem 1.5rem 0.75rem;
  }
  .register-card .login-brand {
    margin-bottom: 4px;
    font-size: 9px;
  }
  .register-card .login-logo {
    width: 40px;
    height: 40px;
    font-size: 15px;
    margin-bottom: 0.375rem;
  }
  .register-card .login-title {
    font-size: 1.125rem;
    margin-bottom: 2px;
  }
  .register-card .login-subtitle {
    font-size: 12px;
    line-height: 1.3;
  }

  .register-body {
    padding: 0.75rem 1.5rem 1rem;
  }

  .register-steps {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    gap: 8px;
    margin: 0 0 0.5rem;
  }

  .register-panel {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .register-form-fill {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .register-form-fields {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 10px;
  }

  .register-form-fields > .form-label {
    margin: 0;
    flex: 0 0 auto;
  }

  .register-form-fields > .register-canal-mini,
  .register-form-fields .register-alert {
    flex: 0 0 auto;
    margin: 0;
  }

  .register-form-fields .form-group {
    flex: 0 0 auto;
    margin: 0;
    gap: 4px;
  }

  .register-form-fields .register-type-row,
  .register-form-fields .register-canal-pick {
    flex: 0 0 auto;
    margin: 0;
  }

  .register-form-fields .register-senha-row {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 0;
  }

  .register-form-fields .register-senha-row .form-group {
    margin: 0;
  }

  .register-form-actions {
    flex: 0 0 auto;
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .register-form-actions .login-error {
    margin-bottom: 10px;
  }

  .register-form-actions .register-nav-row {
    margin-top: 0;
  }
  .register-step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: color-mix(in oklab, var(--primary-foreground) 35%, transparent);
    transition: transform 0.2s, background 0.2s;
  }
  .register-step-dot.active {
    background: var(--sidebar-primary);
    transform: scale(1.25);
  }
  .register-step-dot.done {
    background: color-mix(in oklab, var(--sidebar-primary) 70%, transparent);
  }

  .register-type-row,
  .register-canal-pick {
    display: flex;
    gap: 10px;
  }
  .register-type-row .profile-item,
  .register-canal-pick .profile-item {
    flex: 1;
    margin-bottom: 0;
    justify-content: center;
    gap: 4px;
    padding: 0.4375rem 0.5rem;
    font-size: 12px;
  }
  .register-canal-pick .profile-item:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .register-type-icon { font-size: 15px; line-height: 1; }

  .register-senha-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .register-canal-mini {
    font-size: 12px;
    line-height: 1.4;
    color: var(--muted-foreground);
    margin: 0;
    flex: 0 0 auto;
    align-self: center;
  }
  .register-canal-mini strong { color: var(--foreground); font-weight: 600; }

  .register-nav-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .register-btn-back {
    flex: 0 0 auto;
    min-width: 4.5rem;
    height: 2.75rem;
    padding: 0 0.75rem;
    font-size: 14px;
  }
  .register-nav-row .login-submit { flex: 1; }

  .register-alert {
    margin-bottom: 8px;
    padding: 8px 10px;
    font-size: 12px;
  }
  .register-dev-code { font-family: var(--font-mono); }

  .register-actions-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
  }
  .register-btn-secondary {
    height: 2rem;
    padding: 0 0.75rem;
    font-size: 12px;
  }

  .register-code-input {
    font-size: 18px;
    letter-spacing: 0.28em;
    text-align: center;
    font-family: var(--font-mono);
  }

  .view-only-banner {
    flex-shrink: 0;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    color: var(--warning-fg);
    background: var(--warning-soft);
    border-bottom: 1px solid color-mix(in oklab, var(--warning) 35%, transparent);
  }

  .badge-view-only {
    background: color-mix(in oklab, var(--warning) 20%, transparent);
    color: var(--warning-fg);
    border: 1px solid color-mix(in oklab, var(--warning) 40%, transparent);
  }

  .content-view-only .btn-primary,
  .content-view-only .btn-secondary:not(.btn-sm),
  .content-view-only button[class*="btn"] {
    pointer-events: none;
    opacity: 0.45;
  }
  .content-view-only input,
  .content-view-only select,
  .content-view-only textarea {
    pointer-events: none;
    opacity: 0.85;
  }
  .content-view-only .nav-item,
  .content-view-only .filter-chip {
    pointer-events: auto;
    opacity: 1;
  }

  .login-footer {
    text-align: center;
    font-size: 12px;
    color: var(--muted-foreground);
    margin-top: 0;
    line-height: 1.6;
  }

  /* ─── LOADING ─── */
  .loading-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    background: var(--surface);
  }

  .loading-logo {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-lg);
    background: var(--forest-700);
    color: var(--primary-foreground);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    box-shadow: var(--shadow-elevated);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--forest-700);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text { color: var(--muted-foreground); font-size: 14px; }

  /* ─── ADMIN ─── */
  .admin-page { animation: rn-pop-in 0.3s ease-out; }

  .super-admin-card {
    background: color-mix(in oklab, var(--gold) 8%, var(--card));
    border: 1px solid color-mix(in oklab, var(--gold) 25%, transparent);
    border-radius: var(--radius-lg);
    padding: 1.125rem 1.25rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    box-shadow: var(--shadow-card);
  }

  .super-admin-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, var(--gold), color-mix(in oklab, var(--gold) 80%, var(--forest-700)));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }

  .super-admin-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--success-fg);
    background: var(--success-soft);
    border: 1px solid color-mix(in oklab, var(--success) 25%, transparent);
    border-radius: var(--radius-sm);
    padding: 8px 14px;
    white-space: nowrap;
  }

  .admin-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.875rem;
    margin-bottom: 1.75rem;
  }

  .admin-kpi {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    padding: 1.125rem 1.25rem;
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s, transform 0.15s;
    border-top: 2px solid var(--admin-kpi-color, var(--forest-700));
  }
  .admin-kpi:hover {
    box-shadow: var(--shadow-elevated);
    transform: translateY(-1px);
  }

  .admin-table-wrap {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }

  .modal-header-forest {
    background: linear-gradient(135deg, var(--forest-900) 0%, var(--forest-800) 55%, var(--forest-700) 100%);
    border-bottom: 1px solid var(--sidebar-border);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .admin-kpi-value {
    font-family: var(--font-mono);
    font-size: 28px;
    font-weight: 600;
    color: var(--foreground);
    margin-top: 6px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .admin-kpi-label {
    font-size: 12px;
    color: var(--muted-foreground);
    margin-top: 4px;
  }

  .admin-section-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
    letter-spacing: -0.005em;
  }

  .admin-tenant-table table { font-size: 12px; }
  .admin-tenant-table thead th { padding: 0.5rem 0.625rem; font-size: 10px; }
  .admin-tenant-table tbody td {
    padding: 0.4375rem 0.625rem;
    white-space: nowrap;
    vertical-align: middle;
  }
  .admin-tenant-table .td-ellipsis {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .admin-tenant-table .td-compact { font-size: 11px; }

  .tenant-name-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 160px;
  }
  .tenant-name-cell .td-ellipsis { max-width: 120px; }

  .tenant-enter-btn {
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in oklab, var(--forest-600) 35%, transparent);
    background: var(--forest-50);
    color: var(--forest-700);
    cursor: pointer;
    flex-shrink: 0;
    font-size: 13px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .tenant-enter-btn:hover:not(:disabled) {
    background: var(--success-soft);
    border-color: color-mix(in oklab, var(--success) 35%, transparent);
  }
  .tenant-enter-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .admin-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  .btn-xs {
    height: 1.625rem;
    min-width: 1.625rem;
    padding: 0 0.375rem;
    font-size: 12px;
  }

  .chart-tooltip {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    font-family: var(--font-mono);
    font-size: 12px;
    box-shadow: var(--shadow-pop);
  }
  .chart-tooltip-label { color: var(--muted-foreground); margin-bottom: 8px; font-weight: 600; }
  .chart-tooltip-row { margin-bottom: 3px; font-variant-numeric: tabular-nums; }

  /* ─── SCROLLBAR ─── */
  .content::-webkit-scrollbar,
  .modal::-webkit-scrollbar { width: 10px; height: 10px; }
  .content::-webkit-scrollbar-thumb,
  .modal::-webkit-scrollbar-thumb {
    background: color-mix(in oklab, var(--foreground) 18%, transparent);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  .content::-webkit-scrollbar-thumb:hover,
  .modal::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklab, var(--foreground) 30%, transparent);
    background-clip: content-box;
  }

  /* ─── PF — dicas e alertas de vencimento ─── */
  .pf-page-hint-wrap {
    position: relative;
    float: right;
    clear: both;
    margin: 0 0 12px 12px;
    z-index: 5;
  }

  .pf-page-hint-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--primary-foreground);
    background: linear-gradient(
      135deg,
      color-mix(in oklab, var(--accent) 92%, var(--primary)),
      color-mix(in oklab, var(--primary) 88%, var(--accent))
    );
    border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--primary));
    border-radius: 999px;
    box-shadow: 0 2px 8px color-mix(in oklab, var(--primary) 25%, transparent);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
  }
  .pf-page-hint-trigger-icon {
    font-size: 14px;
    line-height: 1;
  }
  .pf-page-hint-trigger:hover {
    filter: brightness(1.06);
    box-shadow: 0 3px 12px color-mix(in oklab, var(--primary) 32%, transparent);
  }
  .pf-page-hint-trigger.active {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 28%, transparent);
  }

  .pf-page-hint-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: min(340px, calc(100vw - 48px));
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--foreground);
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--accent) 35%, var(--border));
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px color-mix(in oklab, var(--foreground) 12%, transparent);
    animation: rn-pop-in 0.2s ease-out;
  }

  .pf-page-hint-body { min-width: 0; }
  .pf-page-hint-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 6px;
  }
  .pf-page-hint-text {
    margin: 0;
    color: var(--muted-foreground);
  }

  /* legado — manter se algo ainda referenciar */
  .pf-page-hint-mini {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    float: right;
    clear: both;
    margin: 0 0 10px 12px;
    padding: 5px 11px;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted-foreground);
    background: color-mix(in oklab, var(--muted) 55%, transparent);
    border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
    border-radius: 999px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
    z-index: 2;
  }
  .pf-page-hint-mini:hover {
    color: var(--foreground);
    background: color-mix(in oklab, var(--accent) 12%, var(--muted));
    border-color: color-mix(in oklab, var(--accent) 35%, var(--border));
  }

  .pf-page-hint {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted-foreground);
    background: color-mix(in oklab, var(--accent) 6%, var(--card));
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--border));
    border-radius: var(--radius-md);
    animation: rn-pop-in 0.2s ease-out;
  }
  .pf-page-hint-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  .pf-page-hint-link {
    padding: 0;
    border: none;
    background: none;
    font-size: 11px;
    font-weight: 500;
    color: var(--accent);
    cursor: pointer;
    white-space: nowrap;
  }
  .pf-page-hint-link:hover { text-decoration: underline; }
  .pf-page-hint-link-muted { color: var(--muted-foreground); }

  .pf-due-backdrop { z-index: 1200; }
  .pf-due-modal .modal-title { margin: 0; }
  .pf-due-group { margin-bottom: 12px; }
  .pf-due-group:last-child { margin-bottom: 0; }
  .pf-due-group-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    margin-bottom: 6px;
  }
  .pf-due-group-label.pf-due-late { color: var(--destructive); }
  .pf-due-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 6px;
    background: var(--muted);
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  }
  .pf-due-item-late {
    background: color-mix(in oklab, var(--destructive) 8%, var(--muted));
    border-color: color-mix(in oklab, var(--destructive) 25%, var(--border));
  }
  .pf-due-item-title { font-size: 13px; font-weight: 500; color: var(--foreground); }
  .pf-due-item-sub { font-size: 11px; color: var(--muted-foreground); margin-top: 2px; }
  .pf-due-item-valor {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
  }

  /* ─── RESPONSIVO ─── */
  @media (max-width: 900px) {
    .charts-grid { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .content { padding: 1rem; }
  }

  @media (max-width: 768px) {
    .menu-toggle { display: flex; }

    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      transform: translateX(-100%);
      box-shadow: var(--shadow-pop);
    }
    .sidebar.open { transform: translateX(0); }
    .sidebar-overlay.visible { display: block; }

    .kpi-grid { grid-template-columns: 1fr; }
    .admin-kpi-grid { grid-template-columns: 1fr 1fr; }
    .topbar { padding: 0 0.875rem; }
    .topbar-user { display: none; }
    .company-badge { display: none; }
    .search-input { width: 100%; min-width: 0; }
    .orcamento-row { grid-template-columns: 1fr; gap: 6px; }
    .login-body { padding: 1.5rem; }
    .login-header { padding: 2rem 1.5rem 1.5rem; }

    .modal-backdrop { align-items: flex-end; padding: 0; }
    .modal {
      max-height: 92vh;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      animation: rn-slide-up 0.22s ease-out;
    }
  }

  @media (max-width: 480px) {
    .admin-kpi-grid { grid-template-columns: 1fr; }
    .super-admin-card { flex-direction: column; align-items: flex-start; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }

  /* ─── Recorrências ────────────────────────────────────────────────────────── */

  /* Badge de periodicidade */
  .badge-period {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 99px;
    background: oklch(0.94 0.01 230);
    color: oklch(0.38 0.07 230);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .badge-pausada {
    background: oklch(0.95 0.025 75);
    color: oklch(0.50 0.09 75);
  }
  .badge-encerrada {
    background: oklch(0.93 0.005 0);
    color: oklch(0.55 0.01 0);
  }

  /* Alert de recorrências no dashboard */
  .recorrencia-alert {
    background: oklch(0.995 0.008 145);
    border: 1px solid oklch(0.88 0.04 145);
    border-left: 4px solid var(--primary);
    border-radius: var(--radius-lg);
    padding: 14px 18px;
    margin-bottom: 18px;
  }
  .recorrencia-alert-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .recorrencia-alert-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .recorrencia-alert-count {
    background: var(--primary);
    color: var(--primary-foreground);
    border-radius: 99px;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    min-width: 20px;
    text-align: center;
  }
  .recorrencia-alert-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .recorrencia-alert-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    background: var(--background);
    border: 1px solid var(--border);
  }
  .recorrencia-alert-item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .recorrencia-alert-desc {
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recorrencia-alert-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .recorrencia-alert-valor {
    font-weight: 600;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
  }
  .recorrencia-alert-date {
    font-size: 11px;
    color: var(--muted-foreground);
    font-family: 'JetBrains Mono', monospace;
  }
  .recorrencia-alert-link {
    font-size: 12px;
    color: var(--primary);
    font-weight: 600;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .recorrencia-alert-link:hover { opacity: 0.7; }

  /* Linha de recorrência atrasada */
  .recorrencia-alert-item.atrasada {
    border-color: oklch(0.85 0.06 25);
    background: oklch(0.99 0.01 25);
  }
  .recorrencia-alert-item.atrasada .recorrencia-alert-date {
    color: oklch(0.55 0.18 25);
    font-weight: 600;
  }

  /* Tabela de recorrências */
  .recorrencias-table th,
  .recorrencias-table td { vertical-align: middle; }
  .recorrencias-proxima-ok   { color: var(--foreground); }
  .recorrencias-proxima-soon { color: oklch(0.55 0.15 75); font-weight: 600; }
  .recorrencias-proxima-late { color: oklch(0.55 0.18 25); font-weight: 700; }

  /* Modal de recorrência — sem estilos extras (reusa .modal existente) */
  .rec-tipo-row {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }
  .rec-tipo-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 8px;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--background);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted-foreground);
  }
  .rec-tipo-btn:hover { border-color: var(--primary); }
  .rec-tipo-btn.receita.active {
    border-color: var(--accent);
    background: oklch(0.97 0.015 145);
    color: var(--accent);
  }
  .rec-tipo-btn.despesa.active {
    border-color: var(--danger);
    background: oklch(0.97 0.015 25);
    color: oklch(0.55 0.18 25);
  }
`;
