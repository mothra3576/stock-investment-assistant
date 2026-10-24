import readXlsxFile from "read-excel-file/universal";
import { unzipSync } from "fflate";
import { csvRows } from "../stocks/import";
import { MAX_MASTER_BYTES, MAX_MASTER_ROWS, type MasterSheet } from "./types";
// Inspect sizes before decompression. No formulas/macros/links are evaluated.
function checkWorkbook(buffer: ArrayBuffer) {
  let count = 0,
    total = 0;
  const sheets = unzipSync(new Uint8Array(buffer), {
    filter: (file) => {
      count++;
      total += file.originalSize;
      if (count > 300 || total > 32 * 1024 * 1024)
        throw new Error("Excelの展開容量・ファイル数が上限を超えています。");
      return /^xl\/worksheets\/[^/]+\.xml$/.test(file.name);
    },
  });
  for (const bytes of Object.values(sheets)) {
    const xml = new TextDecoder()
      .decode(bytes)
      .replace(
        /&#(?:x([\da-f]+)|(\d+));/gi,
        (_, hex: string | undefined, decimal: string | undefined) =>
          String.fromCodePoint(parseInt(hex ?? decimal!, hex ? 16 : 10)),
      );
    for (const row of xml.matchAll(/\br\s*=\s*["'](\d+)["']/g))
      if (Number(row[1]) > MAX_MASTER_ROWS + 50)
        throw new Error("Excelの行位置が上限を超えています。");
    for (const match of xml.matchAll(/\br\s*=\s*["']([A-Za-z]+)(\d+)["']/g)) {
      const col = [...match[1].toUpperCase()].reduce(
        (n, c) => n * 26 + c.charCodeAt(0) - 64,
        0,
      );
      if (col > 64 || Number(match[2]) > MAX_MASTER_ROWS + 50)
        throw new Error("Excelの行・列位置が上限を超えています（最大64列）。");
    }
  }
}
export async function parseMasterWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<MasterSheet[]> {
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_MASTER_BYTES)
    throw new Error("ファイルは空でない8MB以下にしてください。");
  const ext = fileName.toLowerCase().split(".").pop();
  let sheets: MasterSheet[];
  if (ext === "csv") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("CSVはUTF-8で保存してください。");
    }
    sheets = [{ name: "CSV", rows: csvRows(text.replace(/^\uFEFF/, "")) }];
  } else if (ext === "xlsx") {
    try {
      checkWorkbook(buffer);
      sheets = (await readXlsxFile(buffer)).map((s) => ({
        name: s.sheet,
        rows: s.data as unknown as MasterSheet["rows"],
      }));
    } catch (e) {
      throw new Error(
        `Excelを読み込めません。暗号化・旧.xls形式は未対応です。${e instanceof Error ? e.message : ""}`,
      );
    }
  } else
    throw new Error(
      "対応形式は.xlsxまたはUTF-8 CSVです。旧.xlsは表計算アプリで変換してください。",
    );
  if (
    !sheets.length ||
    sheets.length > 8 ||
    sheets.some(
      (s) =>
        s.rows.length > MAX_MASTER_ROWS + 50 ||
        s.rows.some((r) => r.length > 64),
    )
  )
    throw new Error("シート数（最大8）・行数・列数が上限を超えています。");
  return sheets;
}
