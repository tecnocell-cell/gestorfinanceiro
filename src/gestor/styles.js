export const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green: #10b981;
    --green-dark: #059669;
    --sidebar-bg: #ffffff;
    --sidebar-bg-hover: #f0fdf4;
    --sidebar-border: #d1fae5;
    --sidebar-accent: #0d9488;
    --sidebar-accent-dim: rgba(13, 148, 136, 0.12);

    --bg: #f4f7fb;
    --surface: #ffffff;
    --surface2: #f8fafc;
    --surface3: #f1f5f9;
    --border: #e2e8f0;
    --border-light: #eef2f6;
    --accent: #0d9488;
    --accent-hover: #0f766e;
    --accent-light: rgba(13, 148, 136, 0.1);
    --accent-bright: #10b981;
    --accent2: #ea580c;
    --accent3: #2563eb;
    --danger: #e11d48;
    --text: #0f172a;
    --text2: #475569;
    --text3: #94a3b8;
    --font-display: 'Plus Jakarta Sans', sans-serif;
    --font-body: 'Plus Jakarta Sans', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --radius: 14px;
    --radius-sm: 10px;
    --shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 20px rgba(15, 23, 42, 0.05);
    --shadow-lg: 0 12px 40px rgba(15, 23, 42, 0.1);
    --sidebar-width: 228px;
  }

  html, body, #root { height: 100%; overflow: hidden; }

  body {
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.06), transparent),
      radial-gradient(ellipse 60% 40% at 100% 0%, rgba(13, 148, 136, 0.05), transparent);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* ─── SIDEBAR CLARA (fixa, sem scroll) ─── */
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    flex-shrink: 0;
    background: linear-gradient(180deg, #f0fdf4 0%, var(--sidebar-bg) 28%, #ffffff 100%);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 100;
    box-shadow: 2px 0 20px rgba(16, 185, 129, 0.06);
  }

  .sidebar-logo {
    flex-shrink: 0;
    padding: 12px 14px 8px;
    border-bottom: 1px solid var(--border-light);
  }

  .brand-row { display: flex; align-items: center; gap: 8px; }

  .brand-mark {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: linear-gradient(135deg, var(--green) 0%, var(--accent) 100%);
    color: white;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.28);
    flex-shrink: 0;
  }

  .sidebar-logo h1 {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .sidebar-logo p {
    font-size: 10px;
    color: var(--text3);
    margin-top: 1px;
    font-weight: 500;
  }

  .nav-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 4px 0 6px;
    overflow: hidden;
  }

  .nav-label {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text3);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0 14px 6px;
  }

  /* 12 linhas iguais: usa o espaço livre sem estourar a sidebar */
  .nav-list {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: repeat(14, minmax(0, 1fr));
    gap: 3px;
    padding: 0 8px 4px;
    overflow: hidden;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 11px;
    min-height: 0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text2);
    transition: background 0.15s, color 0.15s;
    line-height: 1.25;
    border-left: 2px solid transparent;
  }

  .nav-item:hover {
    background: var(--sidebar-bg-hover);
    color: var(--text);
  }

  .nav-item.active {
    background: var(--sidebar-accent-dim);
    color: var(--sidebar-accent);
    font-weight: 600;
    border-left-color: var(--green);
    box-shadow: inset 0 0 0 1px rgba(13, 148, 136, 0.12);
  }

  .nav-icon {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    background: var(--surface3);
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .nav-item.active .nav-icon {
    background: rgba(16, 185, 129, 0.14);
  }

  .nav-item span:last-child {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer {
    flex-shrink: 0;
    padding: 7px 14px 8px;
    border-top: 1px solid var(--border-light);
    background: var(--surface2);
  }

  .sidebar-footer-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer-cnpj {
    font-size: 9px;
    color: var(--text3);
    margin-top: 1px;
    font-family: var(--font-mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── ÁREA PRINCIPAL (só o conteúdo rola) ─── */
  .main {
    flex: 1;
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .topbar {
    flex-shrink: 0;
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border-light);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
  }

  .topbar-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.03em;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .company-badge {
    font-size: 11px;
    color: var(--text2);
    font-weight: 500;
    background: var(--surface2);
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 4px;
  }

  .status-dot.online { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
  .status-dot.offline { background: #94a3b8; }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px 24px 28px;
  }

  /* ─── CARDS & KPIs ─── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: 18px 20px;
    box-shadow: var(--shadow);
    margin-bottom: 14px;
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin-bottom: 14px;
    letter-spacing: -0.01em;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: 16px 18px;
    position: relative;
    box-shadow: var(--shadow);
  }

  .kpi-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--kpi-color, var(--accent));
    border-radius: var(--radius) var(--radius) 0 0;
    opacity: 0.9;
  }

  .kpi-label {
    font-size: 10px;
    color: var(--text3);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .kpi-value {
    font-family: var(--font-mono);
    font-size: 19px;
    font-weight: 500;
    margin-top: 6px;
    color: var(--kpi-color, var(--text));
    letter-spacing: -0.02em;
  }

  .kpi-sub { font-size: 11px; color: var(--text3); margin-top: 4px; }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 18px;
  }

  .charts-grid.full { grid-template-columns: 1fr; }

  @media (max-width: 900px) {
    .charts-grid { grid-template-columns: 1fr; }
  }

  /* ─── TABELAS ─── */
  .table-wrap { overflow-x: auto; border-radius: var(--radius-sm); }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }

  thead th {
    background: var(--surface2);
    color: var(--text3);
    font-weight: 600;
    padding: 10px 12px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  tbody tr { border-bottom: 1px solid var(--border-light); }
  tbody tr:hover { background: var(--surface2); }
  tbody td { padding: 9px 12px; vertical-align: middle; }

  .td-mono { font-family: var(--font-mono); font-size: 12px; }
  .td-green { color: var(--green-dark); font-family: var(--font-mono); }
  .td-red { color: var(--danger); font-family: var(--font-mono); }
  .td-amber { color: var(--accent2); font-family: var(--font-mono); }

  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .badge-green { background: rgba(16, 185, 129, 0.12); color: var(--green-dark); }
  .badge-red { background: rgba(190, 18, 60, 0.1); color: var(--danger); }
  .badge-blue { background: rgba(29, 78, 216, 0.1); color: var(--accent3); }
  .badge-amber { background: rgba(194, 65, 12, 0.1); color: var(--accent2); }

  /* ─── FORMULÁRIOS & BOTÕES ─── */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .form-group { display: flex; flex-direction: column; gap: 4px; }

  .form-label {
    font-size: 10px;
    color: var(--text2);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .form-input, .form-select, .form-textarea {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 11px;
    font-size: 13px;
    outline: none;
    width: 100%;
    font-family: var(--font-body);
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
  }

  .form-textarea { min-height: 72px; resize: vertical; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    transition: all 0.15s;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--green), var(--accent));
    color: white;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, var(--accent), var(--accent-hover));
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--surface);
    color: var(--text2);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover { background: var(--surface2); color: var(--text); }

  .btn-danger {
    background: rgba(190, 18, 60, 0.06);
    color: var(--danger);
    border: 1px solid rgba(190, 18, 60, 0.2);
  }

  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn-icon { padding: 6px; }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }

  .filter-chip {
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid var(--border);
    color: var(--text2);
    background: var(--surface);
    font-weight: 500;
  }

  .filter-chip.active {
    background: var(--accent-light);
    color: var(--accent);
    border-color: rgba(13, 148, 136, 0.3);
    font-weight: 600;
  }

  .search-wrap { position: relative; }

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text3);
    font-size: 13px;
  }

  .search-input { padding-left: 30px; width: 200px; }

  .period-selector { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text2); }

  .period-selector select {
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 12px;
  }

  /* ─── MODAL ─── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    backdrop-filter: blur(6px);
  }

  .modal {
    background: var(--surface);
    border-radius: 14px;
    width: 100%;
    max-width: 620px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-light);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-light);
    background: var(--surface2);
    border-radius: 14px 14px 0 0;
  }

  .modal-title { font-size: 17px; font-weight: 700; color: var(--text); }

  .modal-body { padding: 18px 20px; }

  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-light);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    background: var(--surface2);
    border-radius: 0 0 14px 14px;
  }

  .empty-state { text-align: center; padding: 36px; color: var(--text3); }

  .saldo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
  }

  .saldo-card {
    background: var(--surface2);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
  }

  .saldo-valor {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--accent);
    margin-top: 4px;
    font-weight: 500;
  }

  .dre-total td { font-weight: 600; background: var(--surface3) !important; }

  .import-box {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 20px;
    text-align: center;
    background: var(--surface2);
  }

  .alert {
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    margin-bottom: 12px;
    font-size: 13px;
  }

  .alert-info { background: rgba(29, 78, 216, 0.06); color: var(--accent3); border: 1px solid rgba(29, 78, 216, 0.15); }
  .alert-success { background: rgba(16, 185, 129, 0.08); color: var(--green-dark); border: 1px solid rgba(16, 185, 129, 0.2); }
  .alert-warn { background: rgba(194, 65, 12, 0.08); color: var(--accent2); border: 1px solid rgba(194, 65, 12, 0.15); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }

  .import-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }

  .content::-webkit-scrollbar { width: 8px; }
  .content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .content::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  @media (max-width: 900px) {
    .sidebar { width: 64px; }
    .sidebar-logo h1, .sidebar-logo p, .nav-label, .nav-item span:last-child, .sidebar-footer { display: none; }
    .brand-row { justify-content: center; }
    .nav-item { justify-content: center; padding: 8px; }
    .main { margin-left: 0; }
  }
`;
