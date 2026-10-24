export type SecurityType = "ordinary" | "etf" | "reit" | "other" | "unknown";
export const typeLabels: Record<SecurityType, string> = {
  ordinary: "普通株式",
  etf: "ETF",
  reit: "REIT",
  other: "その他",
  unknown: "未分類",
};
export interface MasterEntry {
  id: string;
  code: string;
  name: string;
  marketSegment: string;
  sector: string;
  securityType: SecurityType;
}
export interface MasterDatasetV2 {
  version: 2;
  kind: "security-master";
  source: "user-file";
  asOfDate: string;
  dateOrigin: "column" | "manual";
  fileName: string;
  sheetName: string;
  importedAt: string;
  records: MasterEntry[];
}
export type Cell = string | number | boolean | Date | null;
export interface MasterSheet {
  name: string;
  rows: Cell[][];
}
export interface ColumnMapping {
  code: number;
  name: number;
  marketSegment: number;
  sector: number;
  type?: number;
  date?: number;
}
export interface ImportIssue {
  row: number;
  message: string;
}
export interface MasterPreview {
  records: MasterEntry[];
  errors: ImportIssue[];
  errorCount: number;
  duplicates: number;
  unclassified: number;
  asOfDate: string | null;
  dateOrigin: "column" | "manual";
}
export const MAX_MASTER_ROWS = 12000;
export const MAX_MASTER_BYTES = 8 * 1024 * 1024;
