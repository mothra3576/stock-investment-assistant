import {
  MAX_MASTER_ROWS,
  typeLabels,
  type Cell,
  type ColumnMapping,
  type MasterDatasetV2,
  type MasterEntry,
  type MasterPreview,
  type MasterSheet,
  type SecurityType,
} from "./types";
export function isoDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    value = value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isInteger(value))
    value = String(value);
  if (typeof value !== "string") return null;
  const s = value.trim();
  const normalized = /^\d{8}$/.test(s)
    ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`
    : s;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    !Number.isFinite(Date.parse(normalized))
  )
    return null;
  return new Date(normalized).toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}
function text(value: Cell | undefined, max: number): string | null {
  return typeof value === "string" &&
    value.trim() &&
    value.trim().length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value.trim()
    : null;
}
export function normalizeCode(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value))
    value = String(value);
  if (typeof value !== "string") return null;
  const code = value.trim().normalize("NFKC").toUpperCase();
  return /^[A-Z0-9]{4,5}$/.test(code) ? code : null;
}
export function previewMaster(
  sheet: MasterSheet,
  headerRow: number,
  mapping: ColumnMapping,
  classification: Record<string, SecurityType>,
  manualDate: string,
): MasterPreview {
  const out: MasterPreview = {
    records: [],
    errors: [],
    errorCount: 0,
    duplicates: 0,
    unclassified: 0,
    asOfDate: null,
    dateOrigin: mapping.date === undefined ? "manual" : "column",
  };
  const issue = (row: number, message: string) => {
    out.errorCount++;
    if (out.errors.length < 100) out.errors.push({ row, message });
  };
  if (
    !Number.isInteger(headerRow) ||
    headerRow < 0 ||
    headerRow >= sheet.rows.length
  ) {
    issue(0, "ヘッダー行を選択してください。");
    return out;
  }
  const width = sheet.rows[headerRow].length;
  const core = [
    mapping.code,
    mapping.name,
    mapping.marketSegment,
    mapping.sector,
  ];
  if (
    core.some((i) => !Number.isInteger(i) || i < 0 || i >= width) ||
    new Set(core).size !== 4 ||
    [mapping.type, mapping.date].some(
      (i) => i !== undefined && (!Number.isInteger(i) || i < 0 || i >= width),
    )
  ) {
    issue(
      0,
      "コード・企業名・市場区分・業種には異なる有効な列を指定してください。",
    );
    return out;
  }
  const dated = isoDate(manualDate);
  if (mapping.date === undefined && !dated) {
    issue(0, "ファイルや掲載ページで確認した基準日を入力してください。");
    return out;
  }
  if (manualDate && !dated) {
    issue(0, "手動基準日が不正です。");
    return out;
  }
  if (sheet.rows.length - headerRow - 1 > MAX_MASTER_ROWS) {
    issue(
      0,
      `データは${MAX_MASTER_ROWS.toLocaleString()}行以下にしてください。`,
    );
    return out;
  }
  const entries = new Map<string, MasterEntry>();
  let asOf = dated;
  sheet.rows.slice(headerRow + 1).forEach((row, index) => {
    if (row.every((v) => v === null || v === "")) return;
    const line = headerRow + index + 2;
    const code = normalizeCode(row[mapping.code]),
      name = text(row[mapping.name], 160),
      marketSegment = text(row[mapping.marketSegment], 100),
      sector = text(row[mapping.sector], 100);
    if (!code || !name || !marketSegment || !sector) {
      issue(
        line,
        "コード（英数字4〜5文字）・企業名・市場区分・業種に欠損または不正な型があります。「-」など元ファイルの業種区分は文字列として保持します。",
      );
      return;
    }
    if (mapping.date !== undefined) {
      const date = isoDate(row[mapping.date]);
      if (!date) {
        issue(
          line,
          "基準日列の日付を解釈できません。YYYY-MM-DD・YYYYMMDD・Excel日付セルに対応します。",
        );
        return;
      }
      if (asOf && date !== asOf) {
        issue(line, "基準日が行間または手動指定と一致しません。");
        return;
      }
      asOf = date;
    }
    const rawType =
      mapping.type === undefined ? "" : String(row[mapping.type] ?? "").trim();
    const securityType = Object.hasOwn(classification, rawType)
      ? classification[rawType]
      : "unknown";
    if (!Object.hasOwn(typeLabels, securityType)) {
      issue(line, "商品区分の対応が不正です。");
      return;
    }
    const entry: MasterEntry = {
      id: `JP:${code}`,
      code,
      name,
      marketSegment,
      sector,
      securityType,
    };
    const previous = entries.get(entry.id);
    if (previous) {
      if (JSON.stringify(previous) === JSON.stringify(entry)) out.duplicates++;
      else issue(line, `証券コード ${code} の内容が重複行と一致しません。`);
      return;
    }
    entries.set(entry.id, entry);
  });
  out.records = [...entries.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  out.asOfDate = asOf;
  out.unclassified = out.records.filter(
    (r) => r.securityType === "unknown",
  ).length;
  if (!out.records.length) issue(0, "有効な銘柄がありません。");
  if (!out.asOfDate) issue(0, "基準日を確認できません。");
  return out;
}
export function makeDataset(
  preview: MasterPreview,
  fileName: string,
  sheetName: string,
): MasterDatasetV2 {
  if (preview.errorCount || !preview.records.length || !preview.asOfDate)
    throw new Error("プレビューのエラーを修正してください。");
  return {
    version: 2,
    kind: "security-master",
    source: "user-file",
    asOfDate: preview.asOfDate,
    dateOrigin: preview.dateOrigin,
    fileName,
    sheetName,
    importedAt: new Date().toISOString(),
    records: preview.records,
  };
}
export function validateV2(value: unknown): MasterDatasetV2 {
  if (!value || typeof value !== "object")
    throw new Error("v2データが不正です。");
  const v = value as MasterDatasetV2;
  if (
    v.version !== 2 ||
    v.kind !== "security-master" ||
    v.source !== "user-file" ||
    !Array.isArray(v.records) ||
    v.records.length === 0 ||
    v.records.length > MAX_MASTER_ROWS ||
    !isoDate(v.asOfDate) ||
    !["column", "manual"].includes(v.dateOrigin) ||
    !text(v.fileName, 200) ||
    !text(v.sheetName, 160) ||
    typeof v.importedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(v.importedAt) ||
    v.importedAt.length > 40 ||
    !isoDate(v.importedAt.slice(0, 10)) ||
    !Number.isFinite(Date.parse(v.importedAt))
  )
    throw new Error("v2のメタデータ・件数が不正です。");
  const seen = new Set<string>();
  const records = v.records.map((r) => {
    if (
      !r ||
      typeof r !== "object" ||
      typeof r.code !== "string" ||
      normalizeCode(r.code) !== r.code ||
      r.id !== `JP:${r.code}` ||
      !text(r.name, 160) ||
      !text(r.marketSegment, 100) ||
      !text(r.sector, 100) ||
      !Object.hasOwn(typeLabels, r.securityType) ||
      seen.has(r.id)
    )
      throw new Error("v2の銘柄に欠損・重複・不正値があります。");
    seen.add(r.id);
    return {
      id: r.id,
      code: r.code,
      name: text(r.name, 160)!,
      marketSegment: text(r.marketSegment, 100)!,
      sector: text(r.sector, 100)!,
      securityType: r.securityType,
    };
  });
  return {
    version: 2,
    kind: "security-master",
    source: "user-file",
    asOfDate: v.asOfDate,
    dateOrigin: v.dateOrigin,
    fileName: v.fileName,
    sheetName: v.sheetName,
    importedAt: v.importedAt,
    records: records.sort((a, b) => a.code.localeCompare(b.code)),
  };
}
