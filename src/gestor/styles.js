/**
 * CenterFlow — Design system RuralNext atualizado (Planilha/styles)
 * admin-redesign · ruralnext-theme · buttons · form-filters · auth
 */
export const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ─── TOKENS (RuralNext atualizado — admin-redesign + ruralnext-theme) ─── */
  :root {
    --radius: 0.5rem;
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 10px;
    --radius-xl: calc(var(--radius) + 4px);

    --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

    /* Marca institucional */
    --rn-primary: #013e1f;
    --rn-primary-hover: #036b36;
    --rn-primary-active: #012e17;
    --rn-success: #1e8e3e;
    --rn-success-hover: #166d2e;
    --rn-danger: #dc2626;
    --rn-danger-hover: #b91c1c;
    --rn-info: #2563eb;
    --rn-info-hover: #1d4ed8;
    --rn-white: #ffffff;
    --rn-neutral: #f5f5f5;
    --rn-neutral-hover: #e7e7e7;
    --rn-neutral-border: #d1d1d1;
    --rn-neutral-text: #1a1a1a;
    --rn-cancel: #6b6b6b;
    --rn-cancel-hover: #4b4b4b;

    /* Links legados base-layout */
    --rn-green: #2e7d32;
    --rn-green-dark: #1b5e20;
    --rn-green-hover: #e6f4ea;
    --rn-gray-bg: #f5f6f7;
    --rn-gray-border: #dcdcdc;

    /* Superfícies OKLCH (admin-redesign) */
    --rn-forest-900: oklch(0.24 0.05 155);
    --rn-forest-800: oklch(0.29 0.05 155);
    --rn-forest-700: oklch(0.34 0.07 155);
    --rn-forest-600: oklch(0.42 0.08 155);
    --rn-forest-500: oklch(0.52 0.11 150);
    --rn-forest-100: oklch(0.94 0.04 150);
    --rn-forest-50: oklch(0.97 0.02 150);
    --rn-indicator: oklch(0.72 0.16 145);
    --rn-page-canvas: oklch(0.97 0.008 150);
    --rn-surface: oklch(0.982 0.005 150);
    --rn-surface-2: oklch(0.968 0.006 150);
    --rn-card: oklch(1 0 0);
    --rn-border: oklch(0.9 0.012 150);
    --rn-text: oklch(0.22 0.02 160);
    --rn-text-soft: oklch(0.48 0.018 155);
    --rn-label: var(--rn-text-soft);

    /* Status (rn-lovable-tokens) */
    --rn-success-bg: #ecfdf3;
    --rn-success-fg: #067647;
    --rn-warning-bg: #fff8eb;
    --rn-warning-fg: #b54708;
    --rn-danger-bg: #fef3f2;
    --rn-danger-fg: #b42318;
    --rn-info-bg: #eff8ff;
    --rn-info-fg: #175cd3;

    --forest-900: var(--rn-forest-900);
    --forest-800: var(--rn-forest-800);
    --forest-700: var(--rn-forest-700);
    --forest-600: var(--rn-forest-600);
    --forest-500: var(--rn-forest-500);
    --forest-100: var(--rn-forest-100);
    --forest-50: var(--rn-forest-50);
    --indicator: var(--rn-indicator);
    --gold: oklch(0.72 0.12 80);

    --background: var(--rn-page-canvas);
    --foreground: var(--rn-text);
    --surface: var(--rn-surface);
    --surface-2: var(--rn-surface-2);
    --card: var(--rn-card);
    --card-foreground: var(--rn-text);
    --popover: var(--rn-card);
    --popover-foreground: var(--rn-text);

    --primary: var(--rn-success);
    --primary-foreground: var(--rn-white);
    --secondary: var(--rn-surface-2);
    --secondary-foreground: var(--rn-text);
    --muted: var(--rn-surface-2);
    --muted-foreground: var(--rn-text-soft);
    --accent: var(--rn-forest-50);
    --accent-foreground: var(--rn-forest-800);
    --destructive: var(--rn-danger);
    --destructive-foreground: var(--rn-white);
    --border: var(--rn-border);
    --input: var(--rn-card);
    --ring: var(--rn-forest-600);

    --success: var(--rn-success);
    --success-fg: var(--rn-success-fg);
    --success-soft: var(--rn-success-bg);
    --warning: #f59e0b;
    --warning-fg: var(--rn-warning-fg);
    --warning-soft: var(--rn-warning-bg);
    --danger: var(--rn-danger);
    --danger-fg: var(--rn-danger-fg);
    --danger-soft: var(--rn-danger-bg);
    --info: var(--rn-info);
    --info-fg: var(--rn-info-fg);
    --info-soft: var(--rn-info-bg);

    --chart-1: var(--rn-forest-700);
    --chart-2: oklch(0.6 0.118 184.704);
    --chart-3: oklch(0.398 0.07 227.392);
    --chart-4: oklch(0.72 0.12 80);
    --chart-5: oklch(0.769 0.188 70.08);

    --rn-shadow-card: 0 1px 2px rgba(15, 40, 24, 0.04);
    --rn-shadow-pop: 0 8px 24px rgba(15, 40, 24, 0.08);
    --shadow-card: var(--rn-shadow-card);
    --shadow-elevated: 0 4px 12px rgba(15, 40, 24, 0.08), 0 1px 2px rgba(15, 40, 24, 0.04);
    --shadow-pop: var(--rn-shadow-pop);
    --shadow-float: var(--rn-shadow-pop);

    /* Botões (buttons.css) */
    --btn-fg: var(--rn-neutral-text);
    --btn-bg: var(--rn-card);
    --btn-bd: var(--rn-neutral-border);
    --btn-primary-bg: var(--rn-success);
    --btn-primary-bd: var(--rn-success-hover);
    --btn-focus: 0 0 0 3px color-mix(in oklab, var(--rn-forest-600) 35%, transparent);
    --btn-h: 34px;
    --btn-px: 12px;
    --btn-font: 13px;
    --btn-fw: 600;
    --btn-radius: var(--radius-md);

    /* Sidebar institucional */
    --sidebar: var(--rn-primary);
    --sidebar-foreground: var(--rn-white);
    --sidebar-muted: color-mix(in oklab, var(--rn-card) 64%, transparent);
    --sidebar-primary: var(--rn-indicator);
    --sidebar-primary-foreground: var(--rn-white);
    --sidebar-accent: color-mix(in oklab, var(--rn-card) 6%, transparent);
    --sidebar-accent-foreground: var(--rn-white);
    --sidebar-hover: color-mix(in oklab, var(--rn-card) 6%, transparent);
    --sidebar-active-bg: color-mix(in oklab, var(--rn-card) 10%, transparent);
    --sidebar-active-accent: var(--rn-white);
    --sidebar-border: color-mix(in oklab, var(--rn-card) 14%, transparent);
    --sidebar-border-subtle: rgba(255, 255, 255, 0.1);
    --sidebar-ring: var(--rn-indicator);
    --sidebar-width: 240px;
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
    --sidebar-foreground: oklch(0.97 0.005 150);
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
    background-color: var(--rn-surface);
    color: var(--rn-text);
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
    background: var(--rn-page-canvas);
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: color-mix(in oklab, var(--forest-900) 55%, transparent);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 199;
    animation: rn-fade-in 0.15s ease-out;
  }

  /* ─── SIDEBAR — RuralNext atualizado (rn-primary institucional) ─── */
  .sidebar {
    position: relative;
    width: var(--sidebar-width);
    height: 100vh;
    flex-shrink: 0;
    background: var(--rn-primary);
    color: var(--sidebar-foreground);
    border-right: 1px solid rgba(0, 0, 0, 0.22);
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
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.875rem 0.95rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .sidebar-brand-logo {
    display: block;
    width: min(100%, 200px);
    height: auto;
    max-height: 52px;
    object-fit: contain;
    object-position: center;
    user-select: none;
    -webkit-user-drag: none;
  }

  .brand-logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
  }

  .brand-mark-circle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  }

  .brand-logo-title {
    font-family: var(--font-sans);
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    white-space: nowrap;
  }

  .brand-logo-title--dark { color: #ffffff; }
  .brand-logo-title--light { color: var(--foreground, #111827); }

  .brand-logo-accent { color: var(--rn-primary, #128547); }
  .brand-logo-title--dark .brand-logo-accent { color: rgba(255, 255, 255, 0.92); }

  .login-brand-logo-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .sidebar-brand-logo-wrap {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .brand-row { display: flex; align-items: center; gap: 10px; }

  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: -0.03em;
    box-shadow: var(--shadow-card);
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
    color: var(--sidebar-muted);
    margin-top: 2px;
    font-weight: 500;
  }

  .brand-tag {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.72);
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
    border-color: color-mix(in oklab, var(--sidebar-primary) 35%, transparent);
    color: var(--sidebar-primary);
    box-shadow: none;
  }
  .admin-nav-title { font-size: 13px; font-weight: 600; line-height: 1.2; }
  .admin-nav-sub { font-size: 10px; color: var(--sidebar-muted); margin-top: 2px; }
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
  .gestor-link-btn-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
  .gestor-link-btn-sub { font-size: 10px; color: var(--sidebar-muted); margin-top: 2px; font-weight: 500; }

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
    color: rgba(255, 255, 255, 0.58);
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
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0.45rem 0.75rem;
    min-height: 36px;
    flex-shrink: 0;
    border-radius: 0.4rem;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.92);
    line-height: 1.3;
    border: 1px solid transparent;
    transition: background-color 0.2s, color 0.2s;
  }
  .nav-item:hover {
    background: var(--sidebar-hover);
    color: #ffffff;
  }
  .nav-item.active {
    background: var(--sidebar-active-bg);
    color: #ffffff;
    font-weight: 600;
    border-color: transparent;
    box-shadow: none;
  }
  .nav-item.active::before {
    content: "";
    display: block;
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    border-radius: 0 4px 4px 0;
    background: var(--rn-indicator);
  }

  .nav-icon {
    width: 20px;
    height: 20px;
    border-radius: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.88);
    transition: color 0.2s;
  }
  .nav-item:hover .nav-icon {
    color: #ffffff;
  }
  .nav-item.active .nav-icon {
    background: transparent;
    color: #ffffff;
  }
  .admin-nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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
    background: color-mix(in oklab, black 10%, transparent);
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
    color: var(--sidebar-muted);
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
    border: 1px solid var(--sidebar-border-subtle);
    background: var(--sidebar-accent);
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-muted);
    transition: background-color 0.18s var(--ease-out), color 0.18s var(--ease-out);
  }
  .sidebar-footer-switch:hover {
    background: color-mix(in oklab, white 10%, var(--forest-900));
    color: var(--sidebar-primary);
  }

  /* ─── MAIN (canvas RuralNext — base-layout) ─── */
  .main {
    flex: 1;
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--rn-page-canvas);
    border-left: 0;
    border-radius: 0;
  }

  .topbar {
    flex-shrink: 0;
    min-height: 48px;
    height: auto;
    background: var(--rn-card);
    border-bottom: 1px solid var(--rn-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.25rem 0 1rem;
    gap: 12px;
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
  .menu-toggle:hover { border-color: var(--rn-forest-600); background: var(--rn-forest-50); }

  .topbar-title {
    font-size: clamp(1rem, 0.92rem + 0.4vw, 1.125rem);
    font-weight: 600;
    color: var(--rn-text);
    letter-spacing: -0.01em;
    line-height: 1.2;
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
    background: var(--rn-page-canvas);
    color: var(--rn-text);
  }

  /* ─── CARDS (rn-card) ─── */
  .card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
    border-radius: var(--radius-lg);
    padding: 1.25rem 1.375rem;
    box-shadow: var(--shadow-card);
    margin-bottom: 14px;
    transition: box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
  }
  .card:hover {
    box-shadow: var(--shadow-elevated);
    border-color: color-mix(in oklab, var(--border) 100%, var(--forest-600) 6%);
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
    background: linear-gradient(145deg, color-mix(in oklab, var(--forest-50) 50%, var(--card)) 0%, var(--card) 55%);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: 1rem 1.125rem;
    min-height: 110px;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
    border-left: 3px solid var(--kpi-color, var(--forest-700));
  }
  .kpi-card:hover {
    box-shadow: var(--shadow-elevated);
    border-color: color-mix(in oklab, var(--border) 100%, var(--forest-600) 8%);
  }

  .kpi-label {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: color-mix(in oklab, var(--muted-foreground) 92%, transparent);
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
    border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
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

  tbody tr:nth-child(even) td {
    background: color-mix(in oklab, var(--muted) 40%, var(--card));
  }
  tbody tr:hover td {
    background: var(--rn-green-hover) !important;
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
    padding: 1rem 1.125rem;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    color: color-mix(in oklab, var(--foreground) 92%, transparent);
    background: var(--card);
    vertical-align: middle;
    line-height: 1.45;
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
    gap: 0.35rem;
    padding: 0.2rem 0.625rem;
    font-size: 11px;
    font-weight: 600;
    border-radius: 999px;
    font-family: var(--font-sans);
    letter-spacing: 0.01em;
    box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 12%, transparent);
  }
  .badge-green { background: var(--success-soft); color: var(--success-fg); }
  .badge-red { background: var(--danger-soft); color: var(--danger-fg); }
  .badge-blue { background: var(--info-soft); color: var(--info-fg); }
  .badge-amber { background: var(--warning-soft); color: var(--warning-fg); }
  .badge-pf,
  .badge-pj {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 18%, transparent);
  }
  .badge-pf { background: var(--info-soft); color: var(--info-fg); }
  .badge-pj { background: var(--success-soft); color: var(--success-fg); }
  .badge-pf::before,
  .badge-pj::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 3px color-mix(in oklab, currentColor 18%, transparent);
    flex-shrink: 0;
  }

  /* ─── SyncPill (auto-refresh indicator) ─── */
  .sync-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 11px 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    line-height: 1;
    transition: background 0.18s var(--ease-out), border-color 0.18s var(--ease-out), color 0.18s var(--ease-out);
    font-family: var(--font-sans);
  }
  .sync-pill:hover:not(:disabled) {
    background: color-mix(in oklab, var(--success-soft) 60%, var(--card));
    border-color: color-mix(in oklab, var(--success) 28%, var(--border));
    color: var(--success-fg);
  }
  .sync-pill:disabled { cursor: default; opacity: 0.75; }
  .sync-pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--success) 18%, transparent);
    flex-shrink: 0;
  }
  .sync-pill--busy .sync-pill-dot {
    background: var(--warning);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--warning) 22%, transparent);
    animation: syncPulse 1s ease-in-out infinite;
  }
  @keyframes syncPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.35); opacity: 0.55; }
  }
  @media (max-width: 540px) {
    .sync-pill-text { display: none; }
    .sync-pill { padding: 6px; }
  }

  /* ─── FORMULÁRIOS (rn-input / rn-btn) ─── */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .form-group { display: flex; flex-direction: column; gap: 6px; }

  .form-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--rn-text-soft);
    margin-bottom: 4px;
    line-height: 1.25;
  }

  .form-input, .form-select, .form-textarea {
    width: 100%;
    min-height: 34px;
    background: var(--rn-card);
    color: var(--rn-text);
    border: 1px solid var(--rn-border);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    font-size: 13px;
    line-height: 1.3;
    outline: none;
    font-family: var(--font-sans);
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  .form-select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    padding-right: 28px;
  }
  .form-input::placeholder, .form-textarea::placeholder { color: var(--rn-text-soft); }
  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: var(--rn-forest-600);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--rn-forest-600) 20%, transparent);
    background: var(--rn-card);
  }
  .form-textarea { min-height: 72px; resize: vertical; padding-top: 8px; }

  /* Botões — RuralNext atualizado (buttons.css + ruralnext-theme) */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: var(--btn-h);
    min-height: var(--btn-h);
    padding: 0 var(--btn-px);
    font-size: var(--btn-font);
    font-weight: var(--btn-fw);
    line-height: 1;
    white-space: nowrap;
    border-radius: var(--btn-radius);
    border: 1px solid var(--btn-bd);
    background: var(--btn-bg);
    color: var(--btn-fg);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: background-color 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.05s;
    user-select: none;
    box-sizing: border-box;
  }
  .btn:hover { background: var(--rn-neutral-hover); }
  .btn:active { transform: translateY(1px); }
  .btn:focus-visible {
    outline: none;
    box-shadow: var(--btn-focus);
  }
  .btn:disabled { opacity: 0.56; pointer-events: none; transform: none; }

  .btn-primary {
    background: var(--btn-primary-bg);
    color: var(--rn-white);
    border-color: var(--btn-primary-bd);
    box-shadow: none;
  }
  .btn-primary:hover { background: var(--rn-success-hover); border-color: var(--rn-success-hover); }

  .btn-secondary {
    background: var(--rn-card);
    color: var(--rn-text);
    border: 1px solid var(--rn-border);
  }
  .btn-secondary:hover {
    border-color: var(--rn-forest-600);
    background: var(--rn-card);
    color: var(--rn-text);
  }

  .btn-danger {
    background: var(--rn-danger);
    color: var(--rn-white);
    border-color: var(--rn-danger-hover);
  }
  .btn-danger:hover { background: var(--rn-danger-hover); border-color: var(--rn-danger-hover); }

  .btn-sm {
    height: 32px;
    min-height: 32px;
    padding: 0 10px;
    font-size: 12px;
    border-radius: var(--radius-md);
  }
  .btn-icon {
    width: 1.75rem;
    min-width: 1.75rem;
    height: 1.75rem;
    min-height: 1.75rem;
    padding: 0;
    font-size: 12px;
  }
  .btn-icon svg {
    display: block;
    flex-shrink: 0;
  }

  .table-actions-cell {
    width: 1%;
    white-space: nowrap;
    text-align: right;
    padding-right: 8px !important;
  }
  .table-actions-inline {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }

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
  .filter-chip:hover { border-color: var(--rn-forest-600); color: var(--rn-forest-800); background: var(--rn-forest-50); }
  .filter-chip.active {
    background: var(--rn-success);
    color: var(--rn-white);
    border-color: var(--rn-success-hover);
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
    min-height: 34px;
    padding: 6px 28px 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--rn-border);
    background: var(--rn-card);
    color: var(--rn-text);
    font-size: 13px;
    outline: none;
    cursor: pointer;
    font-family: var(--font-sans);
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .period-selector select:focus {
    border-color: var(--rn-forest-600);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--rn-forest-600) 20%, transparent);
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

  /* ─── LOGIN (RuralNext auth.css) ─── */
  .login-page {
    min-height: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 24px;
    overflow: hidden;
    background: linear-gradient(135deg, #f9fafb 0%, #e8f4ed 100%);
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
    background: linear-gradient(135deg, var(--rn-primary) 0%, var(--rn-primary-hover) 100%);
    color: #ffffff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }

  .login-brand-logo {
    display: block;
    width: min(280px, 92%);
    height: auto;
    max-height: 56px;
    margin: 0 auto 1rem;
    object-fit: contain;
    object-position: center;
    user-select: none;
    -webkit-user-drag: none;
  }

  .login-logo {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-lg);
    margin: 0 auto 1rem;
    background: rgba(255, 255, 255, 0.16);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.22);
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
    color: rgba(255, 255, 255, 0.78);
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
    align-items: flex-start;
    gap: 8px;
    line-height: 1.45;
  }
  .login-error svg { flex-shrink: 0; margin-top: 1px; }

  .login-submit {
    width: 100%;
    height: var(--btn-h);
    min-height: var(--btn-h);
    border-radius: var(--btn-radius);
    border: 1px solid var(--rn-success-hover);
    background: var(--rn-success);
    color: var(--rn-white);
    font-weight: var(--btn-fw);
    font-size: var(--btn-font);
    cursor: pointer;
    font-family: var(--font-sans);
    box-shadow: none;
    transition: background-color 0.15s, border-color 0.15s, transform 0.05s;
  }
  .login-submit:hover:not(:disabled) { background: var(--rn-success-hover); border-color: var(--rn-success-hover); }
  .login-submit:active:not(:disabled) { transform: translateY(1px); }
  .login-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .login-link-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--rn-success);
    cursor: pointer;
    text-decoration: underline;
  }
  .login-link-btn:hover { color: var(--rn-success-hover); }

  /* Cadastro: header verde menor + campos com espaçamento fixo (sem sobrepor) */
  .register-card .login-header {
    padding: 1rem 1.5rem 0.75rem;
  }
  .register-card .login-brand-logo {
    max-width: 180px;
    margin-bottom: 0.625rem;
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
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 0.5rem 0.625rem;
    font-size: 12px;
  }
  .register-canal-pick .profile-item:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .register-type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }

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
    transition: box-shadow 0.15s, border-color 0.15s;
    border-left: 3px solid var(--admin-kpi-color, var(--forest-700));
  }
  .admin-kpi:hover {
    box-shadow: var(--shadow-elevated);
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
    background: color-mix(in oklab, var(--card) 98%, transparent);
    border: 1px solid color-mix(in oklab, var(--border) 90%, transparent);
    border-radius: var(--radius-lg);
    padding: 10px 12px;
    min-width: 148px;
    box-shadow: var(--shadow-pop);
    backdrop-filter: blur(10px) saturate(1.15);
    -webkit-backdrop-filter: blur(10px) saturate(1.15);
  }
  .chart-tooltip-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  }
  .chart-tooltip-rows { display: flex; flex-direction: column; gap: 6px; }
  .chart-tooltip-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 1.35;
  }
  .chart-tooltip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 1px color-mix(in oklab, currentColor 20%, transparent);
  }
  .chart-tooltip-name {
    flex: 1;
    font-family: var(--font-sans);
    font-weight: 500;
    color: color-mix(in oklab, var(--foreground) 75%, transparent);
    font-size: 11px;
  }
  .chart-tooltip-value {
    font-family: var(--font-mono);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
    font-size: 12px;
  }

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
    min-height: 32px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--rn-text);
    background: var(--rn-card);
    border: 1px solid var(--rn-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.15s, border-color 0.15s, background-color 0.15s;
  }
  .pf-page-hint-trigger-icon {
    font-size: 12px;
    line-height: 1;
    opacity: 0.82;
  }
  .pf-page-hint-trigger:hover {
    background: var(--rn-surface-2);
    border-color: var(--rn-forest-600);
    box-shadow: var(--shadow-elevated);
  }
  .pf-page-hint-trigger.active {
    border-color: var(--rn-forest-600);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--rn-forest-600) 18%, transparent);
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

  /* ─── Dashboard V2 — layout claro (CenterOS / rn-kpi) ───────────────────── */

  .content:has(.dash-v2-root) {
    animation: none;
  }

  .dash-v2-root {
    margin: -1.25rem -1.5rem;
    min-height: 100%;
    background: var(--rn-page-canvas);
  }

  /* Topo: toolbar + KPIs no fundo claro (sem faixa verde escura) */
  .dash-hero {
    padding: 1.5rem 1.625rem 0.375rem;
    background: var(--rn-page-canvas);
    position: relative;
  }

  .dash-hero-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 1rem;
  }
  .dash-hero-heading {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .dash-hero-heading-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--rn-green-hover);
    color: var(--rn-green-dark);
    border: 1px solid color-mix(in oklab, var(--rn-green) 20%, var(--border));
    box-shadow: var(--shadow-card);
    flex-shrink: 0;
  }
  .dash-hero-label {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--foreground);
    text-transform: none;
    line-height: 1.25;
  }
  .dash-hero-sub {
    font-size: 12px;
    color: color-mix(in oklab, var(--muted-foreground) 95%, transparent);
    margin-top: 3px;
    font-weight: 500;
    line-height: 1.45;
  }

  .dash-insight {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px 16px;
    margin-bottom: 1.125rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: var(--card);
    box-shadow: var(--shadow-card);
    transition: border-color 0.2s var(--ease-out);
  }
  .dash-insight--success {
    border-color: color-mix(in oklab, var(--success) 26%, var(--border));
    background: linear-gradient(135deg, color-mix(in oklab, var(--success-soft) 70%, var(--card)) 0%, var(--card) 65%);
  }
  .dash-insight--warn {
    border-color: color-mix(in oklab, var(--warning) 30%, var(--border));
    background: linear-gradient(135deg, color-mix(in oklab, var(--warning-soft) 75%, var(--card)) 0%, var(--card) 65%);
  }
  .dash-insight--info {
    border-color: color-mix(in oklab, var(--info, var(--forest-600)) 26%, var(--border));
    background: linear-gradient(135deg, color-mix(in oklab, var(--info-soft, var(--forest-50)) 80%, var(--card)) 0%, var(--card) 65%);
  }
  .dash-insight-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--muted);
    color: var(--muted-foreground);
  }
  .dash-insight--success .dash-insight-icon {
    background: var(--success-soft);
    color: var(--success-fg);
  }
  .dash-insight--warn .dash-insight-icon {
    background: var(--warning-soft);
    color: var(--warning-fg);
  }
  .dash-insight--info .dash-insight-icon {
    background: var(--info-soft);
    color: var(--info-fg);
  }
  .dash-insight-text {
    font-size: 13px;
    line-height: 1.55;
    color: color-mix(in oklab, var(--foreground) 86%, transparent);
    margin: 0;
    font-weight: 500;
  }

  .kpi-v2-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }

  .dash-v2-root .kpi-v2 {
    background: linear-gradient(145deg, color-mix(in oklab, var(--forest-50) 55%, var(--card)) 0%, var(--card) 52%);
    border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
    border-left: 3px solid var(--forest-600);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-float);
    padding: 1.3125rem 1.375rem;
    min-height: 132px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    overflow: hidden;
    isolation: isolate;
    transition: box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
  }
  .dash-v2-root .kpi-v2::after {
    content: '';
    position: absolute;
    top: -35%;
    right: -12%;
    width: 130px;
    height: 130px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in oklab, var(--forest-500) 16%, transparent) 0%, transparent 68%);
    pointer-events: none;
    z-index: 0;
  }
  .dash-v2-root .kpi-v2 > * { position: relative; z-index: 1; }
  .dash-v2-root .kpi-v2:hover {
    border-color: color-mix(in oklab, var(--forest-600) 28%, var(--border));
    box-shadow: var(--shadow-elevated);
  }
  .dash-v2-root .kpi-v2::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 1px 0 color-mix(in oklab, #fff 88%, transparent);
    z-index: 0;
  }
  .dash-v2-root .kpi-v2--success {
    background: linear-gradient(145deg, color-mix(in oklab, var(--success-soft) 88%, var(--card)) 0%, var(--card) 50%);
    border-left-color: var(--success);
    border-color: color-mix(in oklab, var(--success) 22%, var(--border));
  }
  .dash-v2-root .kpi-v2--success::after {
    background: radial-gradient(circle, color-mix(in oklab, var(--success) 24%, transparent) 0%, transparent 68%);
  }
  .dash-v2-root .kpi-v2--danger {
    background: linear-gradient(145deg, color-mix(in oklab, var(--danger-soft) 90%, var(--card)) 0%, var(--card) 50%);
    border-left-color: var(--danger);
    border-color: color-mix(in oklab, var(--danger) 20%, var(--border));
  }
  .dash-v2-root .kpi-v2--danger::after {
    background: radial-gradient(circle, color-mix(in oklab, var(--danger) 20%, transparent) 0%, transparent 68%);
  }
  .dash-v2-root .kpi-v2--warning {
    background: linear-gradient(145deg, color-mix(in oklab, var(--warning-soft) 90%, var(--card)) 0%, var(--card) 50%);
    border-left-color: var(--warning);
    border-color: color-mix(in oklab, var(--warning) 22%, var(--border));
  }
  .dash-v2-root .kpi-v2--warning::after {
    background: radial-gradient(circle, color-mix(in oklab, var(--warning) 22%, transparent) 0%, transparent 68%);
  }

  .kpi-v2-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
  }
  .kpi-v2-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in oklab, var(--forest-100) 70%, var(--card));
    color: var(--forest-700);
    border: 1px solid color-mix(in oklab, var(--forest-600) 12%, transparent);
    flex-shrink: 0;
    box-shadow: var(--shadow-card);
  }
  .kpi-v2--success .kpi-v2-icon-wrap {
    background: color-mix(in oklab, var(--success) 18%, var(--card));
    color: var(--success-fg);
    border-color: color-mix(in oklab, var(--success) 30%, transparent);
  }
  .kpi-v2--danger .kpi-v2-icon-wrap {
    background: color-mix(in oklab, var(--danger) 14%, var(--card));
    color: var(--danger-fg);
    border-color: color-mix(in oklab, var(--danger) 28%, transparent);
  }
  .kpi-v2--warning .kpi-v2-icon-wrap {
    background: color-mix(in oklab, var(--warning) 16%, var(--card));
    color: var(--warning-fg);
    border-color: color-mix(in oklab, var(--warning) 30%, transparent);
  }

  .sparkline { display: block; opacity: 0.88; }
  .sparkline--success { color: var(--success); }
  .sparkline--danger { color: var(--danger); }
  .sparkline--neutral { color: var(--forest-600); }
  .sparkline polyline {
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .kpi-v2-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: color-mix(in oklab, var(--muted-foreground) 94%, transparent);
    line-height: 1.3;
  }
  .kpi-v2-value {
    font-size: 30px;
    font-weight: 600;
    color: var(--foreground);
    font-family: var(--font-mono);
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  .kpi-v2-value.success { color: var(--success-fg); }
  .kpi-v2-value.danger  { color: var(--danger-fg); }
  .kpi-v2-value.warning { color: var(--warning-fg); }

  .kpi-v2-sub {
    font-size: 11px;
    color: color-mix(in oklab, var(--muted-foreground) 92%, transparent);
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi-v2-trend {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    margin-top: 4px;
    width: fit-content;
    letter-spacing: 0.03em;
    box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 10%, transparent);
  }
  .kpi-v2-trend.up      { background: var(--success-soft); color: var(--success-fg); }
  .kpi-v2-trend.down    { background: var(--danger-soft); color: var(--danger-fg); }
  .kpi-v2-trend.neutral { background: var(--muted); color: var(--muted-foreground); }

  .dash-charts-grid--featured {
    grid-template-columns: 1fr 1fr;
  }
  .dash-chart-featured {
    grid-column: 1 / -1;
    min-height: 320px;
  }

  /* ── Seção clara (charts) ─────────────────────────────────────────────────── */

  .dash-section {
    padding: 0.875rem 1.625rem 1.875rem;
  }
  .dash-section-title {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.11em;
    color: color-mix(in oklab, var(--muted-foreground) 90%, transparent);
    margin-bottom: 14px;
    margin-top: 6px;
    line-height: 1.3;
  }

  /* ── Chart Cards ─────────────────────────────────────────────────────────── */

  .dash-charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .dash-v2-root .chart-card-v2 {
    background: linear-gradient(160deg, color-mix(in oklab, var(--forest-50) 45%, var(--card)) 0%, var(--card) 42%);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-top: 2px solid color-mix(in oklab, var(--forest-600) 35%, transparent);
    border-radius: var(--radius-xl);
    padding: 1.25rem 1.375rem 1.125rem;
    box-shadow: var(--shadow-float);
    position: relative;
    isolation: isolate;
    transition: box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
  }
  .dash-v2-root .chart-card-v2:hover {
    border-color: color-mix(in oklab, var(--forest-600) 22%, var(--border));
    box-shadow: var(--shadow-elevated);
  }
  .dash-v2-root .chart-card-v2::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 1px 0 color-mix(in oklab, #fff 85%, transparent);
    z-index: 0;
  }
  .dash-v2-root .chart-card-v2 > * {
    position: relative;
    z-index: 1;
  }
  .chart-card-v2-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;
    gap: 8px;
  }
  .chart-card-v2-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--foreground);
    line-height: 1.35;
    letter-spacing: -0.02em;
  }
  .chart-card-v2-sub {
    font-size: 11px;
    color: color-mix(in oklab, var(--muted-foreground) 92%, transparent);
    margin-top: 3px;
    font-weight: 500;
    line-height: 1.4;
  }
  .chart-card-v2-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 99px;
    background: var(--forest-50);
    color: var(--forest-700);
    border: 1px solid color-mix(in oklab, var(--forest-600) 14%, transparent);
    letter-spacing: 0.02em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .chart-card-v2-empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--muted-foreground);
    font-size: 12px;
  }

  /* ── Contas Widget ───────────────────────────────────────────────────────── */

  .dash-v2-root .dash-accounts-card {
    background: var(--card);
    border: 1px solid color-mix(in oklab, #fff 55%, var(--border));
    border-radius: var(--radius-xl);
    padding: 1.125rem 1.25rem;
    box-shadow: var(--shadow-float);
    position: relative;
    isolation: isolate;
  }
  .dash-v2-root .dash-accounts-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 1px 0 color-mix(in oklab, #fff 85%, transparent);
  }
  .dash-accounts-list { margin-top: 12px; }
  .dash-accounts-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 22px 12px;
    color: var(--muted-foreground);
    font-size: 12.5px;
    text-align: center;
  }
  .dash-account-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 8px;
    margin: 0 -8px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
    border-radius: var(--radius-md);
    transition: background 0.18s var(--ease-out);
  }
  .dash-account-item:hover {
    background: color-mix(in oklab, var(--forest-50) 55%, transparent);
  }
  .dash-account-item:last-child { border-bottom: none; }
  .dash-account-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }
  .dash-account-icon { font-size: 20px; flex-shrink: 0; }
  .dash-account-meta { min-width: 0; }
  .dash-account-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dash-account-type {
    font-size: 11px;
    color: var(--muted-foreground);
    margin-top: 1px;
  }
  .dash-account-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    flex-shrink: 0;
    min-width: 110px;
  }
  .dash-account-balance {
    font-size: 14px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }
  .dash-account-balance.positive { color: var(--success-fg); }
  .dash-account-balance.negative { color: oklch(0.55 0.18 25); }
  .dash-account-bar {
    width: 100%;
    height: 4px;
    background: color-mix(in oklab, var(--muted) 70%, transparent);
    border-radius: 999px;
    overflow: hidden;
  }
  .dash-account-bar-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    transition: width 0.4s var(--ease-out);
  }
  .dash-account-bar-fill.positive {
    background: linear-gradient(90deg, color-mix(in oklab, var(--success) 65%, transparent), var(--success));
  }
  .dash-account-bar-fill.negative {
    background: linear-gradient(90deg, color-mix(in oklab, var(--danger) 55%, transparent), var(--danger));
  }

  /* Pie center label (donut total) */
  .pie-center-label {
    fill: var(--muted-foreground);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .pie-center-value {
    fill: var(--foreground);
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: -0.02em;
  }

  /* ── Skeleton loading ────────────────────────────────────────────────────── */

  .skeleton-pulse {
    background: linear-gradient(90deg,
      var(--muted) 25%,
      var(--surface-2) 50%,
      var(--muted) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-wave 1.5s ease-in-out infinite;
  }
  @keyframes skeleton-wave {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Animação de entrada ─────────────────────────────────────────────────── */

  .dash-v2-fade-in {
    animation: dashFadeIn 0.45s ease-out both;
  }
  @keyframes dashFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Responsividade ──────────────────────────────────────────────────────── */

  @media (max-width: 1180px) {
    .kpi-v2-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
  }
  @media (max-width: 960px) {
    .kpi-v2-grid      { grid-template-columns: repeat(2, 1fr); }
    .dash-charts-grid,
    .dash-charts-grid--featured { grid-template-columns: 1fr; }
    .dash-chart-featured { grid-column: auto; min-height: 260px; }
    .dash-hero-toolbar { flex-direction: column; align-items: stretch; }
    .period-selector--dash { justify-content: flex-start; flex-wrap: wrap; }
  }
  @media (max-width: 768px) {
    .dash-v2-root .kpi-v2 { padding: 1rem 1.05rem; min-height: 118px; }
    .kpi-v2-value { font-size: 24px; }
    .dash-v2-root .chart-card-v2 { padding: 1rem 1.05rem 0.875rem; }
    .chart-card-v2-title { font-size: 13px; }
    .dash-account-right { min-width: 96px; }
  }
  @media (max-width: 540px) {
    .kpi-v2-grid   { grid-template-columns: 1fr; }
    .dash-v2-root  { margin: -1rem; }
    .dash-hero     { padding: 1rem 1rem 0.5rem; }
    .dash-section  { padding: 0.75rem 1rem 1.25rem; }
    .kpi-v2-value  { font-size: 26px; }
    .table-wrap { border-radius: var(--radius-lg); }
    thead th, tbody td { padding-left: 0.75rem; padding-right: 0.75rem; }
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
    background: oklch(0.988 0.010 240);
    border: 1px solid oklch(0.88 0.04 240);
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

  .recorrencias-table .table-actions-cell {
    width: 1%;
    padding-right: 10px !important;
  }

  .rec-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    flex-wrap: nowrap;
  }

  .rec-actions .rec-btn-gerar {
    height: 28px;
    min-height: 28px;
    padding: 0 10px;
    font-size: 12px;
    gap: 5px;
  }

  .rec-actions .btn-icon {
    width: 28px;
    min-width: 28px;
    height: 28px;
    min-height: 28px;
    padding: 0;
  }

  .rec-actions .btn-icon svg {
    display: block;
  }
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

  /* ─── Contas a Pagar / Receber ────────────────────────────────────────────── */

  /* KPI grid: 4 cards em linha */
  .cp-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 14px;
  }
  .cp-kpi {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    padding: 14px 16px 12px;
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .cp-kpi:hover {
    box-shadow: var(--shadow-elevated);
  }
  .cp-kpi-icon {
    font-size: 16px;
    margin-bottom: 6px;
    opacity: 0.75;
  }
  .cp-kpi-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    margin-bottom: 4px;
  }
  .cp-kpi-value {
    font-size: 20px;
    font-weight: 800;
    font-family: var(--font-mono);
    color: var(--foreground);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  .cp-kpi-sub {
    font-size: 10px;
    color: var(--muted-foreground);
    margin-top: 3px;
  }

  /* Filter bar */
  .cp-filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 12px;
    padding: 10px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .cp-filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
  }
  .cp-filter-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  /* Status badges */
  .badge-cp-pago {
    background: oklch(0.95 0.025 150);
    color: oklch(0.36 0.10 150);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 99px;
    display: inline-block;
  }
  .badge-cp-pendente {
    background: oklch(0.95 0.025 230);
    color: oklch(0.36 0.09 230);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 99px;
    display: inline-block;
  }
  .badge-cp-atrasado {
    background: oklch(0.96 0.04 22);
    color: oklch(0.42 0.18 27);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 99px;
    display: inline-block;
  }

  /* Tipo badges */
  .badge-success {
    background: var(--success-soft);
    color: var(--success-fg);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 99px;
    display: inline-block;
    white-space: nowrap;
  }
  .badge-danger {
    background: var(--danger-soft);
    color: var(--danger-fg);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 99px;
    display: inline-block;
    white-space: nowrap;
  }

  /* Table helpers */
  .cp-td-ellipsis {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Inline vencimento edit cell */
  .cp-venc-cell {
    font-family: var(--font-mono);
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .cp-venc-edit-icon {
    opacity: 0.3;
    font-size: 10px;
    transition: opacity 0.15s;
  }
  .cp-venc-cell:hover .cp-venc-edit-icon { opacity: 0.75; }

  /* Alert widget no dashboard */
  .contas-alert {
    background: oklch(0.995 0.008 75);
    border: 1px solid oklch(0.90 0.05 75);
    border-left: 4px solid oklch(0.65 0.14 75);
    border-radius: var(--radius-lg);
    padding: 14px 18px;
    margin-bottom: 18px;
  }
  .contas-alert .recorrencia-alert-title { color: oklch(0.45 0.12 70); }
  .contas-alert .recorrencia-alert-link  { color: oklch(0.45 0.12 70); }

  .danger-count {
    background: var(--danger) !important;
    color: white !important;
  }
  .contas-alert-badge-late {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 700;
    background: var(--danger-soft);
    color: var(--danger-fg);
    margin-left: 4px;
  }

  /* Responsividade */
  @media (max-width: 900px) {
    .cp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .cp-filters  { gap: 8px; }
  }
  @media (max-width: 540px) {
    .cp-kpi-grid  { grid-template-columns: 1fr 1fr; }
    .cp-kpi-value { font-size: 16px; }
  }

  /* ─── Fase 5 — Categorias com ícone e cor ────────────────────────────────── */

  /* Chip de ícone da categoria — badge colorido com emoji */
  .cat-icone {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    line-height: 1;
    font-size: 14px;
    /* cor vem via style inline */
  }
  .cat-icone-empty {
    background: var(--muted) !important;
    color: var(--muted-foreground);
    font-size: 10px;
    opacity: 0.45;
  }

  /* Seletor de ícone (emoji picker) */
  .icone-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    max-height: 140px;
    overflow-y: auto;
  }
  .icone-btn {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, transform 0.1s;
    padding: 0;
  }
  .icone-btn:hover {
    background: var(--accent);
    transform: scale(1.15);
  }
  .icone-btn.active {
    border-color: var(--primary);
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    transform: scale(1.1);
  }

  /* Seletor de cor (swatches) */
  .cor-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 0;
  }
  .cor-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
    outline: none;
    padding: 0;
    /* background vem via style inline */
  }
  .cor-btn:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 8px color-mix(in oklab, currentColor 30%, transparent);
  }
  .cor-btn.active {
    border-color: var(--foreground);
    transform: scale(1.15);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--foreground) 20%, transparent);
  }

  /* ─── Fase 5b — Conexões Bancárias / Open Finance ────────────────────────── */

  .of-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Hero */
  .of-hero {
    background:
      radial-gradient(ellipse at 70% 0%, color-mix(in oklab, var(--indicator) 20%, transparent) 0%, transparent 60%),
      radial-gradient(ellipse at 10% 100%, color-mix(in oklab, var(--forest-600) 12%, transparent) 0%, transparent 50%),
      linear-gradient(155deg, var(--forest-900) 0%, var(--forest-800) 60%, var(--forest-700) 100%);
    padding: 2rem 2rem 2.5rem;
    border-radius: var(--radius-xl);
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  .of-hero::before {
    content: '';
    position: absolute;
    top: -60px; right: -40px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in oklab, var(--indicator) 14%, transparent) 0%, transparent 70%);
    pointer-events: none;
  }
  .of-hero-inner { position: relative; z-index: 1; max-width: 680px; }

  .of-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in oklab, var(--indicator) 85%, var(--primary-foreground));
    background: oklch(1 0 0 / 0.08);
    border: 1px solid oklch(1 0 0 / 0.14);
    padding: 4px 12px;
    border-radius: 99px;
    margin-bottom: 14px;
  }
  .of-hero-title {
    font-size: 26px;
    font-weight: 800;
    color: var(--primary-foreground);
    letter-spacing: -0.02em;
    margin: 0 0 10px;
    line-height: 1.2;
  }
  .of-hero-sub {
    font-size: 14px;
    color: color-mix(in oklab, var(--primary-foreground) 72%, transparent);
    line-height: 1.6;
    margin: 0 0 18px;
    max-width: 560px;
  }
  .of-hero-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .of-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: oklch(0.85 0.03 200);
    background: oklch(1 0 0 / 0.08);
    border: 1px solid oklch(1 0 0 / 0.12);
    padding: 4px 10px;
    border-radius: 99px;
  }

  /* Seções */
  .of-section {
    margin-bottom: 28px;
  }
  .of-section-alt {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 20px 22px;
  }
  .of-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 12px;
  }
  .of-section-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--foreground);
    margin-bottom: 4px;
    letter-spacing: -0.005em;
  }
  .of-section-sub {
    font-size: 12px;
    color: var(--muted-foreground);
    line-height: 1.5;
  }
  .of-interesse-count {
    display: inline-flex;
    align-items: center;
    margin-left: 10px;
    font-size: 11px;
    font-weight: 700;
    color: var(--success-fg);
    background: var(--success-soft);
    padding: 1px 8px;
    border-radius: 99px;
  }

  /* Grid de bancos */
  .of-bancos-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  /* Card de banco */
  .of-banco-card {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .of-banco-card:hover {
    box-shadow: var(--shadow-elevated);
  }
  .of-banco-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .of-banco-sigla {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }
  .of-badge-breve {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: oklch(0.50 0.09 75);
    background: oklch(0.96 0.05 85);
    border: 1px solid oklch(0.88 0.08 80);
    padding: 2px 7px;
    border-radius: 99px;
  }
  .of-banco-nome {
    font-size: 13px;
    font-weight: 700;
    color: var(--foreground);
  }
  .of-banco-desc {
    font-size: 11px;
    color: var(--muted-foreground);
    line-height: 1.4;
    flex: 1;
  }

  /* Botão Avise-me */
  .of-aviso-btn {
    width: 100%;
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--foreground);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    font-family: var(--font-sans);
    font-weight: 600;
  }
  .of-aviso-btn:hover:not(:disabled) {
    background: var(--accent);
    border-color: color-mix(in oklab, var(--primary) 25%, transparent);
  }
  .of-aviso-btn-done {
    background: var(--success-soft) !important;
    border-color: color-mix(in oklab, var(--success) 30%, transparent) !important;
    color: var(--success-fg) !important;
    cursor: default !important;
  }

  /* Roadmap */
  .of-roadmap {
    display: flex;
    gap: 0;
  }
  .of-roadmap-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    text-align: center;
    position: relative;
  }
  .of-roadmap-dot-wrap {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 12px;
  }
  .of-roadmap-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--border);
    border: 2px solid var(--muted-foreground);
    flex-shrink: 0;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  .of-roadmap-dot.done {
    background: var(--success);
    border-color: var(--success-fg);
  }
  .of-roadmap-line {
    position: absolute;
    top: 7px;
    left: 50%;
    right: -50%;
    height: 2px;
    background: var(--border);
    z-index: 0;
  }
  .of-roadmap-content { padding: 0 8px; }
  .of-roadmap-fase {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .of-roadmap-data { font-size: 10px; color: var(--muted-foreground); }
  .of-roadmap-titulo {
    font-size: 12px;
    font-weight: 700;
    color: var(--foreground);
    margin-bottom: 4px;
  }
  .of-roadmap-desc {
    font-size: 11px;
    color: var(--muted-foreground);
    line-height: 1.4;
  }

  /* Grid de importação manual */
  .of-import-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 14px;
  }
  .of-import-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow-card);
    min-height: 160px;
  }
  .of-import-icon { font-size: 26px; }
  .of-import-titulo {
    font-size: 14px;
    font-weight: 700;
    color: var(--foreground);
  }
  .of-import-desc {
    font-size: 12px;
    color: var(--muted-foreground);
    line-height: 1.5;
    flex: 1;
  }
  .of-import-dica {
    font-size: 11px;
    color: var(--muted-foreground);
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    font-family: var(--font-mono);
  }
  .of-import-hint {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: var(--muted-foreground);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    line-height: 1.5;
  }

  /* Rodapé de segurança */
  .of-footer-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 12px;
    color: var(--muted-foreground);
    background: color-mix(in oklab, var(--info-soft) 60%, var(--surface-2));
    border: 1px solid color-mix(in oklab, var(--info) 18%, var(--border));
    border-radius: var(--radius-lg);
    padding: 14px 18px;
    line-height: 1.55;
    margin-top: 4px;
  }

  /* Responsividade */
  @media (max-width: 900px) {
    .of-bancos-grid { grid-template-columns: repeat(2, 1fr); }
    .of-import-grid { grid-template-columns: 1fr 1fr; }
    .of-roadmap     { flex-direction: column; gap: 16px; }
    .of-roadmap-dot-wrap { width: auto; justify-content: flex-start; gap: 12px; }
    .of-roadmap-line { display: none; }
    .of-roadmap-item { flex-direction: row; text-align: left; align-items: flex-start; gap: 0; }
    .of-roadmap-content { text-align: left; }
  }
  @media (max-width: 540px) {
    .of-bancos-grid { grid-template-columns: 1fr 1fr; }
    .of-import-grid { grid-template-columns: 1fr; }
    .of-hero        { padding: 1.25rem 1.25rem 1.75rem; border-radius: var(--radius-lg); }
    .of-hero-title  { font-size: 20px; }
  }

  /* ─── Etapa 4 + 4.1 — Dashboard Premium ──────────────────────────────────── */

  /* KPIs compactos refinados (Etapa 4.1) */
  .kpi-v2-grid--compact {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact {
    position: relative;
    min-height: 108px;
    padding: 0.95rem 1rem 0.85rem 1.05rem;
    gap: 6px;
    border-radius: var(--radius-lg);
    border-color: color-mix(in oklab, var(--border) 55%, transparent);
    overflow: hidden;
    background:
      linear-gradient(180deg,
        color-mix(in oklab, var(--card) 100%, transparent),
        color-mix(in oklab, var(--card) 96%, transparent));
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact::before {
    /* esmaece a borda dupla padrão do kpi-v2 base */
    display: none;
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact .kpi-v2-accent {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 3px;
    background: color-mix(in oklab, var(--muted-foreground) 35%, transparent);
    border-radius: 3px 0 0 3px;
    transition: background 0.18s var(--ease-out, ease-out);
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact.kpi-v2--success .kpi-v2-accent { background: var(--success); }
  .dash-v2-root .kpi-v2.kpi-v2--compact.kpi-v2--danger  .kpi-v2-accent { background: var(--danger); }
  .dash-v2-root .kpi-v2.kpi-v2--compact.kpi-v2--warning .kpi-v2-accent { background: var(--warning); }

  .dash-v2-root .kpi-v2--compact .kpi-v2-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }
  .dash-v2-root .kpi-v2--compact .kpi-v2-icon-wrap {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in oklab, var(--muted) 80%, transparent);
    color: var(--muted-foreground);
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact.kpi-v2--success .kpi-v2-icon-wrap {
    background: color-mix(in oklab, var(--success) 16%, transparent);
    color: var(--success-fg);
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact.kpi-v2--danger .kpi-v2-icon-wrap {
    background: color-mix(in oklab, var(--danger) 16%, transparent);
    color: var(--danger-fg);
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact.kpi-v2--warning .kpi-v2-icon-wrap {
    background: color-mix(in oklab, var(--warning) 18%, transparent);
    color: var(--warning-fg);
  }
  .dash-v2-root .kpi-v2--compact .kpi-v2-label-wrap {
    flex: 1;
    min-width: 0;
  }
  .dash-v2-root .kpi-v2--compact .kpi-v2-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dash-v2-root .kpi-v2--compact .kpi-v2-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }
  .dash-v2-root .kpi-v2--compact .kpi-v2-sub {
    font-size: 11px;
    color: var(--muted-foreground);
    font-weight: 500;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dash-v2-root .kpi-v2--compact::after { display: none; }

  /* Linha de alerts compactos */
  .dash-alerts-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
  .dash-alerts-row > * {
    margin: 0 !important;
    width: 100%;
    min-width: 0;
  }
  .dash-alerts-row:empty { display: none; }

  /* Grid principal: hero chart + side widget */
  .dash-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  .dash-main-grid-hero { min-width: 0; }
  .dash-main-grid-side { min-width: 0; }

  /* Hero chart card */
  .dash-hero-chart {
    position: relative;
    background:
      radial-gradient(120% 80% at 0% 0%,
        color-mix(in oklab, var(--success) 7%, transparent) 0%,
        transparent 55%),
      linear-gradient(180deg,
        color-mix(in oklab, var(--card) 100%, transparent),
        color-mix(in oklab, var(--card) 96%, transparent));
    border: 1px solid color-mix(in oklab, var(--border) 55%, transparent);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-float);
    padding: 1.1rem 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 400px;
  }
  .dash-hero-chart-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    padding-bottom: 10px;
  }
  .dash-hero-chart-headline { min-width: 0; }
  .dash-hero-chart-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--foreground);
    letter-spacing: -0.015em;
  }
  .dash-hero-chart-sub {
    font-size: 11px;
    color: var(--muted-foreground);
    font-weight: 500;
    margin-top: 2px;
  }
  .dash-hero-chart-totals {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .dash-hero-chart-total {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .dash-hero-chart-total .lbl {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .dash-hero-chart-total .dot {
    width: 8px; height: 8px; border-radius: 2px; display: inline-block;
  }
  .dash-hero-chart-total .val {
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }
  .dash-hero-chart-total .val.success { color: var(--success-fg); }
  .dash-hero-chart-total .val.danger  { color: var(--danger-fg); }
  .dash-hero-chart-body {
    flex: 1;
    min-height: 320px;
  }

  /* Tooltip do hero chart */
  .dash-hero-tooltip {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-md);
    box-shadow: 0 12px 32px -8px rgba(0,0,0,0.22);
    padding: 10px 12px;
    min-width: 200px;
    font-size: 11px;
    backdrop-filter: blur(8px);
  }
  .dash-hero-tooltip-title {
    font-weight: 700;
    color: var(--foreground);
    margin-bottom: 7px;
    font-size: 12px;
    letter-spacing: -0.01em;
  }
  .dash-hero-tooltip-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .dash-hero-tooltip-row .dot {
    width: 8px; height: 8px; border-radius: 50%;
    flex-shrink: 0;
  }
  .dash-hero-tooltip-row .lbl {
    flex: 1;
    color: var(--muted-foreground);
    font-weight: 500;
  }
  .dash-hero-tooltip-row .val {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
    font-weight: 600;
  }
  .dash-hero-tooltip-row .val.success { color: var(--success-fg); }
  .dash-hero-tooltip-row .val.danger  { color: var(--danger-fg); }
  .dash-hero-tooltip-divider {
    height: 1px;
    background: color-mix(in oklab, var(--border) 65%, transparent);
    margin: 6px 0;
  }

  /* Grid de widgets secundários */
  .dash-widgets-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  /* List widget genérico */
  .dash-list-widget {
    background: var(--card);
    border: 1px solid color-mix(in oklab, var(--border) 55%, transparent);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-float);
    padding: 1rem 1.1rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 320px;
  }
  .dash-list-widget-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
    padding-bottom: 8px;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
  }
  .dash-list-widget-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }
  .dash-list-widget-sub {
    font-size: 11px;
    color: var(--muted-foreground);
    font-weight: 500;
    margin-top: 2px;
  }
  .dash-list-widget-link {
    background: transparent;
    border: none;
    color: var(--primary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: background 0.15s var(--ease-out, ease-out);
  }
  .dash-list-widget-link:hover {
    background: color-mix(in oklab, var(--primary) 12%, transparent);
  }
  .dash-list-widget-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .dash-list-widget-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 4px;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 35%, transparent);
    transition: background 0.12s ease-out;
  }
  .dash-list-widget-list--cozy .dash-list-widget-row { padding: 10px 4px; }
  .dash-list-widget-row:hover {
    background: color-mix(in oklab, var(--muted) 35%, transparent);
    border-radius: 8px;
  }
  .dash-list-widget-row:last-child { border-bottom: none; }
  .dash-list-widget-main {
    flex: 1;
    min-width: 0;
  }
  .dash-list-widget-hist {
    font-size: 12.5px;
    color: var(--foreground);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
  }
  .dash-list-widget-meta {
    font-size: 10.5px;
    color: var(--muted-foreground);
    font-weight: 500;
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dash-list-widget-meta-sep { opacity: 0.45; }
  .dash-list-widget-side {
    text-align: right;
    flex-shrink: 0;
  }
  .dash-list-widget-val {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .dash-list-widget-val--in  { color: var(--success-fg); }
  .dash-list-widget-val--out { color: var(--danger-fg); }
  .dash-list-widget-val--tr  { color: var(--info-fg); }
  .dash-list-widget-date {
    font-size: 10px;
    color: var(--muted-foreground);
    margin-top: 2px;
  }

  /* Pill de tipo */
  .dash-tipo-pill {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 18%, transparent);
  }
  .dash-tipo-pill--in  { background: color-mix(in oklab, var(--success) 14%, transparent); color: var(--success-fg); }
  .dash-tipo-pill--out { background: color-mix(in oklab, var(--danger) 14%, transparent);  color: var(--danger-fg); }
  .dash-tipo-pill--tr  { background: color-mix(in oklab, var(--info) 16%, transparent);    color: var(--info-fg); }

  /* Badges genéricas */
  .dash-badge {
    display: inline-flex;
    align-items: center;
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .dash-badge--xs {
    font-size: 9px;
    padding: 1px 6px;
    letter-spacing: 0.03em;
  }
  .dash-badge--danger  { background: color-mix(in oklab, var(--danger) 16%, transparent);  color: var(--danger-fg); }
  .dash-badge--warning { background: color-mix(in oklab, var(--warning) 18%, transparent); color: var(--warning-fg); }
  .dash-badge--info    { background: color-mix(in oklab, var(--info) 16%, transparent);    color: var(--info-fg); }
  .dash-badge--success { background: color-mix(in oklab, var(--success) 16%, transparent); color: var(--success-fg); }

  /* Empty state */
  .dash-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1.75rem 1.25rem;
    gap: 6px;
    min-height: 180px;
    color: var(--muted-foreground);
  }
  .dash-empty-state-bubble {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 30% 25%,
        color-mix(in oklab, var(--muted) 80%, transparent),
        color-mix(in oklab, var(--muted) 40%, transparent));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--border) 50%, transparent);
  }
  .dash-empty-state-icon {
    font-size: 28px;
    line-height: 1;
  }
  .dash-empty-state-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--foreground);
  }
  .dash-empty-state-desc {
    font-size: 11.5px;
    color: var(--muted-foreground);
    max-width: 300px;
    line-height: 1.5;
  }
  .dash-empty-state-hint {
    font-size: 10.5px;
    color: var(--muted-foreground);
    opacity: 0.85;
    margin-top: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--muted) 50%, transparent);
  }
  .dash-empty-state-action { margin-top: 10px; }
  .dash-empty-state--success .dash-empty-state-bubble {
    background:
      radial-gradient(circle at 30% 25%,
        color-mix(in oklab, var(--success) 25%, transparent),
        color-mix(in oklab, var(--success) 8%, transparent));
  }
  .dash-empty-state--success .dash-empty-state-icon { color: var(--success-fg); }

  /* ── Responsividade Etapa 4.1 ─────────────────────────────────────────── */
  @media (max-width: 1400px) {
    .kpi-v2-grid--compact { gap: 10px; }
    .dash-main-grid { gap: 12px; }
    .dash-hero-chart { padding: 1rem 1.05rem 0.9rem; min-height: 380px; }
    .dash-hero-chart-totals { gap: 14px; }
  }
  @media (max-width: 1180px) {
    .kpi-v2-grid--compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .dash-main-grid { grid-template-columns: 1fr; }
    .dash-alerts-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 820px) {
    .dash-widgets-grid { grid-template-columns: 1fr; }
    .dash-hero-chart-header { gap: 10px; }
    .dash-hero-chart-totals { gap: 12px; width: 100%; }
  }
  @media (max-width: 540px) {
    .kpi-v2-grid--compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dash-v2-root .kpi-v2.kpi-v2--compact { min-height: 96px; padding: 0.8rem 0.85rem; }
    .dash-v2-root .kpi-v2.kpi-v2--compact .kpi-v2-value { font-size: 18px; }
    .dash-hero-chart { min-height: 300px; padding: 0.9rem; }
    .dash-hero-chart-body { min-height: 240px; }
    .dash-list-widget { min-height: 240px; padding: 0.85rem 0.9rem; }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * ETAPA 4.2 — Premium UX/UI polish
   *  - Delta badges nos KPIs (Stripe/Linear-like)
   *  - ResumoInteligente widget
   *  - Hero chart: chips de mês atual / melhor mês, tooltip premium
   *  - Sidebar mais compacta (Linear/Vercel)
   *  - ContasWidget com participação %
   * ═════════════════════════════════════════════════════════════════════════ */

  /* ── KPI delta badge ─────────────────────────────────────────────────── */
  .dash-v2-root .kpi-v2 .kpi-v2-delta {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10.5px; font-weight: 700;
    line-height: 1.3;
    background: color-mix(in oklab, var(--muted-foreground) 10%, transparent);
    color: var(--muted-foreground);
    width: fit-content;
    letter-spacing: 0.01em;
    transition: background .15s ease, color .15s ease;
  }
  .dash-v2-root .kpi-v2 .kpi-v2-delta-arrow { font-size: 11px; line-height: 1; }
  .dash-v2-root .kpi-v2 .kpi-v2-delta-pct   { font-variant-numeric: tabular-nums; }
  .dash-v2-root .kpi-v2 .kpi-v2-delta-lbl {
    color: color-mix(in oklab, currentColor 70%, transparent);
    font-weight: 500;
    margin-left: 2px;
  }
  .dash-v2-root .kpi-v2 .kpi-v2-delta--up {
    background: color-mix(in oklab, var(--success) 18%, transparent);
    color: var(--success-fg);
  }
  .dash-v2-root .kpi-v2 .kpi-v2-delta--down {
    background: color-mix(in oklab, var(--danger) 18%, transparent);
    color: var(--danger);
  }
  .dash-v2-root .kpi-v2 .kpi-v2-delta--flat {
    background: color-mix(in oklab, var(--muted-foreground) 12%, transparent);
    color: var(--muted-foreground);
  }
  .dash-v2-root .kpi-v2.kpi-v2--compact .kpi-v2-delta {
    margin-top: 3px; padding: 1px 6px; font-size: 10px;
  }

  /* ── Hero chart: chips e tooltip premium ────────────────────────────── */
  .dash-hero-chart-meta {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-top: 6px;
  }
  .dash-hero-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10.5px; font-weight: 700;
    letter-spacing: 0.01em;
    border: 1px solid transparent;
  }
  .dash-hero-chip--best {
    background: color-mix(in oklab, var(--success) 14%, transparent);
    color: var(--success-fg);
    border-color: color-mix(in oklab, var(--success) 30%, transparent);
  }
  .dash-hero-chip--current {
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    color: var(--primary);
    border-color: color-mix(in oklab, var(--primary) 28%, transparent);
  }
  .dash-hero-tooltip-chip {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 9.5px; font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    vertical-align: middle;
  }
  .dash-hero-tooltip-chip--current {
    background: color-mix(in oklab, var(--primary) 18%, transparent);
    color: var(--primary);
  }
  .dash-hero-tooltip-chip--best {
    background: color-mix(in oklab, var(--success) 18%, transparent);
    color: var(--success-fg);
  }

  /* ── ResumoInteligente widget ────────────────────────────────────────── */
  .dash-resumo-card {
    position: relative;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.95rem 1.05rem 0.9rem;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 4px 14px -8px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .dash-resumo-card::before {
    content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
    background: linear-gradient(90deg,
      var(--primary) 0%,
      color-mix(in oklab, var(--success) 80%, transparent) 50%,
      color-mix(in oklab, var(--warning, #f59e0b) 80%, transparent) 100%);
    opacity: 0.85;
  }
  .dash-resumo-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 10px;
  }
  .dash-resumo-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    border-radius: 8px;
    background: color-mix(in oklab, var(--primary) 14%, transparent);
    color: var(--primary);
    flex-shrink: 0;
  }
  .dash-resumo-title {
    font-size: 12.5px; font-weight: 700; color: var(--foreground);
    letter-spacing: -0.005em;
  }
  .dash-resumo-sub {
    font-size: 10.5px; color: var(--muted-foreground);
    margin-top: 1px;
  }
  .dash-resumo-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 6px;
  }
  .dash-resumo-item {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 7px 9px;
    border-radius: 9px;
    background: color-mix(in oklab, var(--muted-foreground) 5%, transparent);
    font-size: 12px; line-height: 1.4; color: var(--foreground);
    transition: background .15s ease, transform .15s ease;
  }
  .dash-resumo-item:hover { background: color-mix(in oklab, var(--muted-foreground) 9%, transparent); }
  .dash-resumo-bullet {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .dash-resumo-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
  }
  .dash-resumo-item--success .dash-resumo-bullet {
    background: color-mix(in oklab, var(--success) 22%, transparent); color: var(--success-fg);
  }
  .dash-resumo-item--danger .dash-resumo-bullet {
    background: color-mix(in oklab, var(--danger) 22%, transparent); color: var(--danger);
  }
  .dash-resumo-item--warning .dash-resumo-bullet {
    background: color-mix(in oklab, var(--warning, #f59e0b) 22%, transparent); color: var(--warning, #b45309);
  }
  .dash-resumo-item--info .dash-resumo-bullet {
    background: color-mix(in oklab, var(--primary) 22%, transparent); color: var(--primary);
  }
  .dash-resumo-item--neutral .dash-resumo-bullet {
    background: color-mix(in oklab, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground);
  }
  .dash-resumo-text { flex: 1; min-width: 0; }

  /* ── ContasWidget — chip de principal & melhor leitura ──────────────── */
  .dash-account-item--principal {
    background: color-mix(in oklab, var(--primary) 6%, transparent);
    border-radius: 10px;
    padding: 6px 8px;
    margin: 0 -8px;
  }
  .dash-account-name-row {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .dash-account-chip {
    display: inline-flex; align-items: center;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 9.5px; font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    background: color-mix(in oklab, var(--primary) 16%, transparent);
    color: var(--primary);
  }

  /* ── Sidebar Etapa 4.2: mais compacta, Linear/Vercel feel ───────────── */
  .sidebar .nav-section { padding: 6px 10px 10px; }
  .sidebar .nav-section .nav-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: color-mix(in oklab, currentColor 50%, transparent);
    padding: 8px 10px 6px;
  }
  .sidebar .nav-list { gap: 1px; display: flex; flex-direction: column; }
  .sidebar .nav-item {
    height: auto;
    min-height: 30px;
    padding: 6px 10px;
    gap: 9px;
    border-radius: 7px;
    font-size: 13px;
    transition: background .12s ease, color .12s ease, transform .12s ease;
  }
  .sidebar .nav-item:hover {
    background: color-mix(in oklab, currentColor 8%, transparent);
  }
  .sidebar .nav-item.active {
    background: color-mix(in oklab, var(--primary) 14%, transparent);
    color: var(--primary-foreground, #fff);
    font-weight: 600;
  }
  .sidebar .nav-item.active::before {
    content: ""; position: absolute;
    left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 16px;
    border-radius: 0 3px 3px 0;
    background: var(--primary);
  }
  .sidebar .nav-item .nav-icon {
    width: 18px; height: 18px;
    display: inline-flex; align-items: center; justify-content: center;
    opacity: 0.85;
    flex-shrink: 0;
  }
  .sidebar .nav-item.active .nav-icon { opacity: 1; }
  .sidebar .nav-item span:last-child { font-size: 13px; font-weight: 500; }
  .sidebar .nav-item.active span:last-child { font-weight: 600; }

  /* ── Layout: side column do main-grid agora empilha resumo + lançamentos ─ */
  .dash-main-grid-side {
    display: flex; flex-direction: column; gap: 12px;
  }

  /* ── Responsividade 4.2 ────────────────────────────────────────────── */
  @media (max-width: 1180px) {
    .dash-main-grid-side { flex-direction: column; }
  }
  @media (max-width: 540px) {
    .dash-resumo-card { padding: 0.8rem 0.85rem; }
    .dash-resumo-item { font-size: 11.5px; padding: 6px 8px; }
  }

`;

