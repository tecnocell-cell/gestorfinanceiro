/**
 * Exportação PDF — Etapa 7.0 / 7.1 (jspdf + jspdf-autotable)
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "Fluxiva";
const BRAND_COLOR = [6, 59, 34];

function fmtDate(d = new Date()) {
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function addPageFooter(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${BRAND} — documento gerado pelo gestor financeiro`,
      14,
      h - 8
    );
    doc.text(`Página ${i} de ${total}`, w - 14, h - 8, { align: "right" });
  }
}

function drawHeader(doc, { title, subtitle, periodo, usuario, empresa, filtros }) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_COLOR);
  doc.text(BRAND, 14, 14);
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 22);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let y = 28;
  if (empresa) {
    doc.text(`Empresa: ${empresa}`, 14, y);
    y += 4;
  }
  if (subtitle) {
    doc.text(subtitle, 14, y);
    y += 4;
  }
  if (periodo) {
    doc.text(`Período: ${periodo}`, 14, y);
    y += 4;
  }
  if (filtros) {
    doc.text(`Filtros: ${filtros}`, 14, y);
    y += 4;
  }
  doc.text(`Gerado em: ${fmtDate()}`, 14, y);
  y += 4;
  if (usuario) {
    doc.text(`Usuário: ${usuario}`, 14, y);
    y += 4;
  }
  return y + 4;
}

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   periodo?: string,
 *   filtros?: string,
 *   usuario?: string,
 *   empresa?: string,
 *   columns: { header: string, dataKey: string }[],
 *   rows: object[],
 *   totals?: { label: string, value: string }[],
 *   filename: string,
 *   orientation?: 'portrait' | 'landscape',
 * }} opts
 */
export function exportReportPdf(opts) {
  const {
    title,
    subtitle = "",
    periodo = "",
    filtros = "",
    usuario = "",
    empresa = "",
    columns,
    rows,
    totals = [],
    filename,
    orientation = "landscape",
  } = opts;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const startY = drawHeader(doc, { title, subtitle, periodo, usuario, empresa, filtros });

  const head = [columns.map((c) => c.header)];
  const body = rows.map((row) => columns.map((c) => String(row[c.dataKey] ?? "")));

  autoTable(doc, {
    startY: startY + 2,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
    margin: { left: 14, right: 14 },
    tableWidth: pageW - 28,
  });

  let endY = doc.lastAutoTable?.finalY ?? startY + 20;
  if (totals.length) {
    endY += 6;
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    totals.forEach((t) => {
      if (endY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        endY = 20;
      }
      doc.text(`${t.label}: ${t.value}`, 14, endY);
      endY += 5;
    });
  }

  addPageFooter(doc);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function exportResumoAnualPdf({ ano, usuario, empresa, kpis, sections, filename }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let startY = drawHeader(doc, {
    title: `Resumo Anual ${ano}`,
    usuario,
    empresa,
  });

  if (kpis?.length) {
    autoTable(doc, {
      startY,
      head: [["Indicador", "Valor"]],
      body: kpis.map((k) => [k.label, k.value]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: BRAND_COLOR },
    });
    startY = doc.lastAutoTable.finalY + 10;
  }

  for (const sec of sections || []) {
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(sec.title, 14, startY);
    startY += 6;

    autoTable(doc, {
      startY,
      head: [sec.headers],
      body: sec.rows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: BRAND_COLOR },
      margin: { left: 10, right: 10 },
    });
    startY = doc.lastAutoTable.finalY + 12;
  }

  addPageFooter(doc);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** PDF comercial — faturas, pagamentos e uso (Portal do Cliente, Etapa 7.6). */
export function exportPortalComercialPdf({
  empresa,
  usuario,
  assinatura,
  faturas = [],
  pagamentos = [],
  usageRows = [],
  filename = "fluxiva-portal-comercial.pdf",
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let startY = drawHeader(doc, {
    title: "Portal do Cliente — resumo comercial",
    subtitle: assinatura?.plano?.nome || "Assinatura",
    empresa,
    usuario,
  });

  const statusLabel = {
    trial: "Período de teste",
    ativa: "Ativa",
    atrasada: "Em atraso",
    cancelada: "Cancelada",
    vencida: "Vencida",
  };

  autoTable(doc, {
    startY,
    head: [["Campo", "Valor"]],
    body: [
      ["Plano", assinatura?.plano?.nome || "—"],
      ["Status", statusLabel[assinatura?.status] || assinatura?.status || "—"],
      [
        "Valor mensal",
        assinatura?.plano?.preco_centavos != null
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              assinatura.plano.preco_centavos / 100
            )
          : "—",
      ],
      ["Trial até", assinatura?.trial_ate ? fmtDate(new Date(assinatura.trial_ate)) : "—"],
      [
        "Próxima cobrança",
        assinatura?.proxima_cobranca ? fmtDate(new Date(assinatura.proxima_cobranca)) : "—",
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND_COLOR },
  });
  startY = doc.lastAutoTable.finalY + 10;

  if (usageRows.length) {
    doc.setFontSize(11);
    doc.text("Uso do plano", 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["Recurso", "Em uso", "Limite"]],
      body: usageRows.map((r) => [r.label, String(r.usado), r.limite == null ? "Ilimitado" : String(r.limite)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: BRAND_COLOR },
    });
    startY = doc.lastAutoTable.finalY + 10;
  }

  if (faturas.length) {
    doc.setFontSize(11);
    doc.text("Faturas", 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["Vencimento", "Valor", "Status", "Pago em"]],
      body: faturas.map((f) => [
        f.vencimento || "—",
        f.valor_centavos != null
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              f.valor_centavos / 100
            )
          : "—",
        f.display_status || f.status || "—",
        f.pago_em ? fmtDate(new Date(f.pago_em)) : "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: BRAND_COLOR },
    });
    startY = doc.lastAutoTable.finalY + 10;
  }

  if (pagamentos.length) {
    if (startY > 240) {
      doc.addPage();
      startY = 20;
    }
    doc.setFontSize(11);
    doc.text("Pagamentos", 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["Data", "Valor", "Status"]],
      body: pagamentos.map((p) => [
        p.created_at ? fmtDate(new Date(p.created_at)) : "—",
        p.valor_centavos != null
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              p.valor_centavos / 100
            )
          : "—",
        p.status || "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: BRAND_COLOR },
    });
  }

  addPageFooter(doc);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** Metadados para testes (sem gravar arquivo). */
export function buildPdfMeta(opts) {
  return {
    brand: BRAND,
    title: opts.title,
    periodo: opts.periodo || "",
    rowCount: opts.rows?.length || 0,
    columnCount: opts.columns?.length || 0,
    hasTotals: Boolean(opts.totals?.length),
  };
}
