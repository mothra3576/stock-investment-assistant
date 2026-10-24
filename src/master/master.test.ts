import { describe, it, expect } from "vitest";
import writeXlsxFile from "write-excel-file/universal";
import { zipSync, strToU8 } from "fflate";
import { parseMasterWorkbook } from "./files";
import {
  isoDate,
  normalizeCode,
  previewMaster,
  makeDataset,
  validateV2,
} from "./validation";
import { joinMaster } from "./join";
import { calculateMetrics } from "../stocks/metrics";
import { filterStocks, defaultConditions } from "../stocks/screen";
import { sampleStockProvider } from "../stocks/provider";
import {
  MAX_MASTER_ROWS,
  MAX_MASTER_BYTES,
  type ColumnMapping,
  type MasterSheet,
} from "./types";
// Artificial cells only. These are not JPX files or a claim about JPX headers.
const header = ["identifier", "label", "segment", "industry", "kind", "asof"];
const cells = [
  header,
  ["130A", "架空検証A", "市場甲", "業種甲", "一般", "20260930"],
  ["0130", "架空検証B", "市場乙", "業種乙", "投信", "20260930"],
];
const mapping: ColumnMapping = {
  code: 0,
  name: 1,
  marketSegment: 2,
  sector: 3,
  type: 4,
  date: 5,
};
const sheet = (): MasterSheet => ({
  name: "検証用",
  rows: structuredClone(cells),
});
const preview = () =>
  previewMaster(sheet(), 0, mapping, { 一般: "ordinary", 投信: "etf" }, "");
const buffer = (text: string) => new TextEncoder().encode(text).buffer;
describe("手動マスター取り込み", () => {
  it("CSV・先頭ゼロ・英数字・分類・基準日を保持", async () => {
    const [csv] = await parseMasterWorkbook(
      buffer("\uFEFF" + cells.map((r) => r.join(",")).join("\r\n")),
      "fixture.csv",
    );
    const result = previewMaster(
      csv,
      0,
      mapping,
      { 一般: "ordinary", 投信: "etf" },
      "",
    );
    expect(result.errorCount).toBe(0);
    expect(result.asOfDate).toBe("2026-09-30");
    expect(result.records.map((r) => r.code)).toEqual(["0130", "130A"]);
    expect(result.records.find((r) => r.code === "0130")?.securityType).toBe(
      "etf",
    );
  });
  it("実際のxlsxバイナリ・複数シート・日付セル・任意位置のヘッダーを読込", async () => {
    const blob = await writeXlsxFile([
      { sheet: "説明", data: [["架空のテスト用メモ"]] },
      {
        sheet: "検証一覧",
        data: [
          ["注記"],
          header,
          [
            1301,
            "架空検証C",
            "市場甲",
            "業種甲",
            "株式",
            {
              value: new Date("2026-09-30T00:00:00Z"),
              type: Date,
              format: "yyyy-mm-dd",
            },
          ],
        ],
      },
    ]).toBlob();
    const sheets = await parseMasterWorkbook(
      await blob.arrayBuffer(),
      "artificial.xlsx",
    );
    expect(sheets.map((s) => s.name)).toEqual(["説明", "検証一覧"]);
    const result = previewMaster(
      sheets[1],
      1,
      mapping,
      { 株式: "ordinary" },
      "",
    );
    expect(result.errorCount).toBe(0);
    expect(result.asOfDate).toBe("2026-09-30");
    expect(result.records[0].code).toBe("1301");
  });
  it("固定ヘッダーを仮定せず、列位置の入替・手動基準日に対応", () => {
    const s: MasterSheet = {
      name: "任意",
      rows: [
        ["名前", "識別子", "分類", "区分"],
        ["架空検証", "130A", "業種甲", "市場甲"],
      ],
    };
    const p = previewMaster(
      s,
      0,
      { code: 1, name: 0, marketSegment: 3, sector: 2 },
      {},
      "2026-09-30",
    );
    expect(p.errorCount).toBe(0);
    expect(p.unclassified).toBe(1);
    expect(p.dateOrigin).toBe("manual");
    expect(p.records[0].securityType).toBe("unknown");
  });
  it("同一内容重複は統合、同じコードの不一致はエラー", () => {
    const s = sheet();
    s.rows.push([...s.rows[1]]);
    let p = previewMaster(s, 0, mapping, {}, "");
    expect(p.duplicates).toBe(1);
    expect(p.errorCount).toBe(0);
    s.rows.push(["130A", "別の名前", "市場甲", "業種甲", "一般", "20260930"]);
    p = previewMaster(s, 0, mapping, {}, "");
    expect(p.errorCount).toBe(1);
    expect(() => makeDataset(p, "x.csv", "s")).toThrow();
  });
  it.each([
    [null, 1],
    ["", 2],
    [true, 0],
    [1301.5, 0],
    [123, 0],
    [0, 0],
    [42, 3],
  ])("必須セルの欠損・型・不正コードを拒否 %s %s", (value, column) => {
    const s = sheet();
    s.rows[1][column] = value as never;
    expect(previewMaster(s, 0, mapping, {}, "").errorCount).toBeGreaterThan(0);
  });
  it("列の重複・未指定、無効日付・日付不一致・空一覧を拒否", () => {
    expect(
      previewMaster(sheet(), 0, { ...mapping, name: 0 }, {}, "").errorCount,
    ).toBeGreaterThan(0);
    expect(
      previewMaster(sheet(), 0, { ...mapping, code: -1 }, {}, "").errorCount,
    ).toBeGreaterThan(0);
    expect(
      previewMaster(sheet(), 0, mapping, {}, "2026-02-30").errorCount,
    ).toBeGreaterThan(0);
    const s = sheet();
    s.rows[2][5] = "20261031";
    expect(previewMaster(s, 0, mapping, {}, "").errorCount).toBeGreaterThan(0);
    expect(
      previewMaster({ name: "empty", rows: [header] }, 0, mapping, {}, "")
        .errorCount,
    ).toBeGreaterThan(0);
    expect(
      previewMaster(sheet(), 0, { ...mapping, date: undefined }, {}, "")
        .errorCount,
    ).toBeGreaterThan(0);
  });
  it("数千件・上限・エラー表示上限", () => {
    const s: MasterSheet = {
      name: "large",
      rows: [
        header,
        ...Array.from({ length: 6000 }, (_, i) => [
          String(1000 + i),
          `架空検証${i}`,
          "市場甲",
          "業種甲",
          "一般",
          "20260930",
        ]),
      ],
    };
    expect(previewMaster(s, 0, mapping, {}, "").records).toHaveLength(6000);
    expect(
      previewMaster(
        { ...s, rows: [header, ...Array(MAX_MASTER_ROWS + 1).fill(s.rows[1])] },
        0,
        mapping,
        {},
        "",
      ).errorCount,
    ).toBeGreaterThan(0);
    const bad = previewMaster(
      {
        ...s,
        rows: [header, ...Array(500).fill([null, "invalid", null, null])],
      },
      0,
      mapping,
      {},
      "",
    );
    expect(bad.errors).toHaveLength(100);
    expect(bad.errorCount).toBeGreaterThan(100);
  });
  it("不正・旧xls・UTF8不正・大容量・ZIP展開超過を拒否", async () => {
    await expect(
      parseMasterWorkbook(buffer("bad"), "x.xlsx"),
    ).rejects.toThrow();
    await expect(parseMasterWorkbook(buffer("bad"), "x.xls")).rejects.toThrow();
    await expect(
      parseMasterWorkbook(new Uint8Array([255, 254]).buffer, "x.csv"),
    ).rejects.toThrow(/UTF-8/);
    await expect(
      parseMasterWorkbook(new ArrayBuffer(MAX_MASTER_BYTES + 1), "x.csv"),
    ).rejects.toThrow();
    const zip = zipSync({ "oversize.bin": new Uint8Array(33 * 1024 * 1024) });
    await expect(
      parseMasterWorkbook(zip.buffer as ArrayBuffer, "x.xlsx"),
    ).rejects.toThrow(/展開容量/);
    const extreme = zipSync({
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="99999999"><c r="A99999999"/></row></sheetData></worksheet>',
      ),
    });
    await expect(
      parseMasterWorkbook(extreme.buffer as ArrayBuffer, "x.xlsx"),
    ).rejects.toThrow(/上限/);
  });
  it("v2の復元を検証し、不正・重複は拒否", () => {
    const data = makeDataset(preview(), "artificial.csv", "検証用");
    expect(validateV2(JSON.parse(JSON.stringify(data)))).toEqual(data);
    for (const patch of [
      { version: 1 },
      { asOfDate: "bad" },
      { records: [...data.records, data.records[0]] },
      { records: [{ ...data.records[0], id: "wrong" }] },
      { records: [{ ...data.records[0], securityType: "stock" }] },
    ])
      expect(() => validateV2({ ...data, ...patch })).toThrow();
  });
  it("日付とコードを過剰補正しない", () => {
    expect(normalizeCode("１３０ａ")).toBe("130A");
    expect(normalizeCode("0130")).toBe("0130");
    expect(normalizeCode("13010")).toBe("13010");
    expect(isoDate(20260930)).toBe("2026-09-30");
    expect(isoDate("2026-02-30")).toBeNull();
    expect(isoDate(0)).toBeNull();
  });
  it("財務なしを架空値で埋めず、本人の財務だけを結合し0とnullを保持", async () => {
    const data = makeDataset(preview(), "x.csv", "s"),
      joined = joinMaster(data, []);
    for (const s of joined) {
      expect(s.periods).toEqual([]);
      expect(s.priceDate).toBeNull();
      expect(
        Object.values(calculateMetrics(s, "actual")).every((v) => v === null),
      ).toBe(true);
    }
    expect(
      filterStocks(joined, {
        ...defaultConditions,
        ranges: { per: { min: 0 } },
      }),
    ).toHaveLength(0);
    const stock = (await sampleStockProvider.load())[0];
    stock.id = "JP:130A";
    stock.code = "130A";
    const values = joinMaster(data, [stock]);
    expect(values.find((v) => v.id === stock.id)?.name).toBe("架空検証A");
    expect(
      calculateMetrics(
        values.find((v) => v.id === stock.id)!,
        "actual",
      ).dividendYield,
    ).toBe(0);
  });
});
