/**
 * Exportação PDF — Etapa 7.0 (jspdf + jspdf-autotable)
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "Fluxiva";

function fmtDate(d = new Date()) {
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   periodo?: string,
 *   usuario?: string,
 *   columns: { header: string, dataKey: string }[],
 *   rows: object[],
 *   totals?: { label: string, value: string }[],
 *   filename: string,
 * }} opts
 */
export function exportReportPdf(opts) {
  const {
    title,
    subtitle = "",
    periodo = "",
    usuario = "",
    columns,
    rows,
    totals = [],
    filename,
  } = opts;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setTextColor(6, 59, 34);
  doc.text(BRAND, 14, 16);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 26);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  let y = 32;
  if (subtitle) {
    doc.text(subtitle, 14, y);
    y += 5;
  }
  if (periodo) {
    doc.text(`Período: ${periodo}`, 14, y);
    y += 5;
  }
  doc.text(`Gerado em: ${fmtDate()}`, 14, y);
  y += 5;
  if (usuario) {
    doc.text(`Usuário: ${usuario}`, 14, y);
    y += 5;
  }

  const head = [columns.map((c) => c.header)];
  const body = rows.map((row) => columns.map((c) => String(row[c.dataKey] ?? "")));

  autoTable(doc, {
    startY: y + 4,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [6, 59, 34], textColor: 255 },
    margin: { left: 14, right: 14 },
    tableWidth: pageW - 28,
  });

  let endY = doc.lastAutoTable?.finalY ?? y + 20;
  if (totals.length) {
    endY += 8;
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    totals.forEach((t) => {
      doc.text(`${t.label}: ${t.value}`, 14, endY);
      endY += 6;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`${BRAND} — relatório gerado pelo gestor financeiro`, 14, doc.internal.pageSize.getHeight() - 8);

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Resumo anual — tabelas e KPIs em texto (sem gráfico rasterizado).
 */
export function exportResumoAnualPdf({ ano, usuario, kpis, sections, filename }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(18);
  doc.setTextColor(6, 59, 34);
  doc.text(BRAND, 14, 16);
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(`Resumo Anual ${ano}`, 14, 26);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em: ${fmtDate()}`, 14, 32);
  if (usuario) doc.text(`Usuário: ${usuario}`, 14, 38);

  let startY = 46;
  if (kpis?.length) {
    autoTable(doc, {
      startY,
      head: [["Indicador", "Valor"]],
      body: kpis.map((k) => [k.label, k.value]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [6, 59, 34] },
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
      headStyles: { fillColor: [6, 59, 34] },
      margin: { left: 10, right: 10 },
    });
    startY = doc.lastAutoTable.finalY + 12;
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
