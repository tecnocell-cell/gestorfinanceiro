import * as XLSX from "xlsx";
import { generateId, nextLote } from "./finance.js";

export const downloadText = (filename, content, mime = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportJSON = (empresa, company) => {
  downloadText(
    `gestor_${company.nomeFantasia.replace(/\s/g, "_")}_${Date.now()}.json`,
    JSON.stringify(empresa, null, 2),
    "application/json;charset=utf-8"
  );
};

export const importJSONFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

/** Parse OFX 1.x / 2.x simplified */
export const parseOFX = (text) => {
  const txs = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const amt = parseFloat(get("TRNAMT").replace(",", "."));
    const dateRaw = get("DTPOSTED").slice(0, 8);
    const memo = get("MEMO") || get("NAME") || "Importação OFX";
    if (!dateRaw || Number.isNaN(amt)) continue;
    const data = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
    txs.push({
      id: generateId(),
      data,
      valor: Math.abs(amt),
      tipo: amt >= 0 ? "Entrada" : "Saida",
      historico: memo,
      consiliado: false,
      exportado: false,
      origemImport: "OFX",
    });
  }
  return txs;
};

export const parseMercadoPagoCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const idxData = headers.findIndex((h) => h.includes("date") || h.includes("data"));
  const idxValor = headers.findIndex((h) => h.includes("amount") || h.includes("valor") || h.includes("value"));
  const idxDesc = headers.findIndex((h) => h.includes("description") || h.includes("descri") || h.includes("title"));

  return lines.slice(1).map((line) => {
    const cols = line.split(sep);
    const rawVal = parseFloat(String(cols[idxValor] || "0").replace(/[^\d,.-]/g, "").replace(",", "."));
    let data = cols[idxData]?.trim().slice(0, 10) || new Date().toISOString().slice(0, 10);
    if (data.includes("/")) {
      const [d, m, y] = data.split("/");
      data = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return {
      id: generateId(),
      data,
      valor: Math.abs(rawVal),
      tipo: rawVal >= 0 ? "Entrada" : "Saida",
      historico: cols[idxDesc]?.trim() || "Mercado Pago",
      consiliado: false,
      exportado: false,
      origemImport: "MercadoPago",
    };
  }).filter((t) => t.valor > 0);
};

export const parseXlsxFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

export const rowsToLancamentos = (rows, lote, contaId, planoId) =>
  rows.map((row) => {
    const keys = Object.keys(row);
    const find = (...names) => {
      const k = keys.find((key) => names.some((n) => key.toLowerCase().includes(n)));
      return k ? row[k] : "";
    };
    let data = String(find("data", "date")).slice(0, 10);
    if (data.includes("/")) {
      const [d, m, y] = data.split("/");
      data = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const val = parseFloat(String(find("valor", "amount", "value")).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    return {
      id: generateId(),
      lote,
      data: data || new Date().toISOString().slice(0, 10),
      tipo: val >= 0 ? "Entrada" : "Saida",
      contaEntradaId: val >= 0 ? contaId : null,
      contaSaidaId: val < 0 ? contaId : null,
      planoId,
      valor: Math.abs(val),
      historico: String(find("histor", "desc", "memo", "title") || "Importação planilha"),
      exportado: false,
      consiliado: false,
      origemImport: "XLSX",
      clienteId: null,
      fornecedorId: null,
    };
  }).filter((l) => l.valor > 0);

export const mergeOFXToLancamentos = (ofxTxs, lancamentos, contaId, planoId, lote) =>
  ofxTxs.map((t) => ({
    ...t,
    lote,
    contaEntradaId: t.tipo === "Entrada" ? contaId : null,
    contaSaidaId: t.tipo === "Saida" ? contaId : null,
    planoId,
  }));

/** Exportação simplificada formato Domínio (texto delimitado) */
export const exportDominio = (lancamentos, contas, planoContas, company) => {
  const pendentes = lancamentos.filter((l) => !l.exportado);
  const lines = [
    `# EXPORTACAO DOMINIO - ${company.nomeFantasia}`,
    `# CNPJ: ${company.cnpj}`,
    `# Codigo Empresa: ${company.codigoDominio}`,
    `# Gerado: ${new Date().toISOString()}`,
    "DATA|LOTE|TIPO|CONTA|PLANO|VALOR|HISTORICO|EXPORTADO",
  ];

  for (const l of pendentes) {
    const conta = contas.find((c) => c.id === (l.contaEntradaId || l.contaSaidaId));
    const plano = planoContas.find((p) => p.id === l.planoId);
    const planoCodigo = plano?.codigo || l.planoCodigo || "";
    lines.push(
      [
        l.data,
        l.lote,
        l.tipo,
        conta?.contaContabil || conta?.codigo || "",
        planoCodigo,
        l.valor.toFixed(2),
        (l.historico || "").replace(/\|/g, "/"),
        "N",
      ].join("|")
    );
  }

  downloadText(
    `dominio_${company.nomeFantasia}_${Date.now()}.txt`,
    lines.join("\n")
  );
  return pendentes.length;
};

export const exportRelatorioCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? "").replace(/;/g, ",")).join(";")),
  ].join("\n");
  downloadText(filename, "\uFEFF" + csv, "text/csv;charset=utf-8");
};

export const marcarExportadosDominio = (lancamentos, ids) =>
  lancamentos.map((l) => (ids.includes(l.id) ? { ...l, exportado: true } : l));

export const apiBase = () => import.meta.env.VITE_API_URL ?? "/api";
