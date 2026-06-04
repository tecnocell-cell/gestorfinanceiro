import { useState } from "react";
import { exportReportPdf } from "../export/pdfExport.js";

/**
 * @param {{
 *   label?: string,
 *   className?: string,
 *   getExportData: () => {
 *     title: string,
 *     subtitle?: string,
 *     periodo?: string,
 *     usuario?: string,
 *     columns: { header: string, dataKey: string }[],
 *     rows: object[],
 *     totals?: { label: string, value: string }[],
 *     filename: string,
 *   },
 * }} props
 */
export default function ExportPdfButton({ label = "Exportar PDF", className = "btn btn-secondary", getExportData }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const data = getExportData();
      if (!data?.rows?.length) {
        alert("Não há dados para exportar com os filtros atuais.");
        return;
      }
      exportReportPdf(data);
    } catch (e) {
      alert(e?.message || "Erro ao gerar PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={handleClick} disabled={busy}>
      {busy ? "Gerando PDF…" : label}
    </button>
  );
}
