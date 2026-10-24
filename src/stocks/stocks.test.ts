import { describe, it, expect } from "vitest";
import sample from "./sample.json";
import { parseStockFile, columns, MAX_FILE_BYTES } from "./import";
import { calculateMetrics, selectedPeriod } from "./metrics";
import {
  defaultConditions,
  filterStocks,
  toggleComparison,
  type ScreenConditions,
} from "./screen";
import { sampleStockProvider, FileStockDataProvider } from "./provider";
const json = () => structuredClone(sample);
const stocks = () => parseStockFile(JSON.stringify(json()), "json");
const conditions = (
  patch: Partial<ScreenConditions> = {},
): ScreenConditions => ({ ...defaultConditions, ...patch });
function csv(rows: Record<string, unknown>[]): string {
  return (
    columns.join(",") +
    "\r\n" +
    rows
      .map((row) =>
        columns
          .map((c) => {
            const s = row[c] === null ? "" : String(row[c]);
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
describe("データ取込", () => {
  it("JSON・BOM付きCSV・プロバイダの結果が一致し、0とnullを保持", async () => {
    const values = stocks();
    expect(values).toHaveLength(8);
    expect(parseStockFile("\uFEFF" + csv(json()), "csv")).toEqual(values);
    expect(await sampleStockProvider.load()).toEqual(values);
    expect(
      await new FileStockDataProvider(JSON.stringify(json()), "json").load(),
    ).toEqual(values);
    expect(values[0].periods[0].dividendPerShare).toBe(0);
    expect(values[6].periods[0].eps).toBeNull();
  });
  it("CSVのカンマ・引用符・改行入り文字列を保持", () => {
    const rows = json().slice(0, 1);
    rows[0].financialSource = '資料,"通期"\nメモ';
    expect(parseStockFile(csv(rows), "csv")[0].periods[0].source).toBe(
      rows[0].financialSource,
    );
  });
  it.each(["{", "null", "{}", "[]", "[null]", "[1]"])(
    "不正JSONを拒否: %s",
    (text) => expect(() => parseStockFile(text, "json")).toThrow(),
  );
  it.each([
    ["currency", "USD"],
    ["amountUnit", "million"],
    ["periodEnd", "2026-02-30"],
    ["priceDate", "2027-01-01"],
    ["basis", "estimated"],
    ["scope", "all"],
    ["price", 0],
    ["revenue", -1],
    ["eps", "50"],
    ["totalAssets", 1e17],
    ["name", ""],
    ["periodStart", "2026-01-01"],
  ])("項目異常を拒否: %s", (key, value) => {
    const row = { ...json()[0], [key]: value };
    expect(() => parseStockFile(JSON.stringify([row]), "json")).toThrow();
  });
  it("未知の列・不足列・重複期・期間重複・同一銘柄の不一致を拒否", () => {
    const row = json()[0];
    expect(() =>
      parseStockFile(JSON.stringify([{ ...row, other: 0 }]), "json"),
    ).toThrow();
    const missing: Record<string, unknown> = { ...row };
    delete missing.eps;
    expect(() => parseStockFile(JSON.stringify([missing]), "json")).toThrow();
    expect(() => parseStockFile(JSON.stringify([row, row]), "json")).toThrow(
      /重複/,
    );
    expect(() =>
      parseStockFile(
        JSON.stringify([
          row,
          { ...row, periodStart: "2023-05-01", periodEnd: "2024-04-30" },
        ]),
        "json",
      ),
    ).toThrow(/重複/);
    expect(() =>
      parseStockFile(
        JSON.stringify([row, { ...json()[1], name: "別の社名" }]),
        "json",
      ),
    ).toThrow(/一致/);
  });
  it("不正CSV・数値・列数・文字数・容量・件数を拒否", () => {
    expect(() => parseStockFile("bad\n1", "csv")).toThrow();
    expect(() =>
      parseStockFile(csv(json().slice(0, 1)).slice(0, -1), "csv"),
    ).toThrow(/引用符/);
    expect(() =>
      parseStockFile(csv([{ ...json()[0], eps: "NaN" }]), "csv"),
    ).toThrow();
    expect(() => parseStockFile(columns.join(",") + "\n1,2", "csv")).toThrow(
      /列数/,
    );
    expect(() =>
      parseStockFile(
        JSON.stringify([{ ...json()[0], name: "a".repeat(161) }]),
        "json",
      ),
    ).toThrow();
    expect(() => parseStockFile(" ".repeat(MAX_FILE_BYTES + 1), "csv")).toThrow(
      /2MB/,
    );
    expect(() =>
      parseStockFile(JSON.stringify(Array(2001).fill(json()[0])), "json"),
    ).toThrow(/2,000/);
  });
  it("米国株の通貨・コードを保持し、異なる通貨の検索は混ぜない", () => {
    const values = parseStockFile(
      JSON.stringify([
        { ...json()[0], market: "US", currency: "USD", code: "DEMO-A" },
      ]),
      "json",
    );
    expect(filterStocks(values, conditions())).toHaveLength(0);
    expect(filterStocks(values, conditions({ market: "US" }))).toHaveLength(1);
  });
});
describe("財務計算とスクリーニング", () => {
  it("同一期間の指標を計算し、予想と実績を区別", () => {
    const s = stocks()[0],
      p = selectedPeriod(s, "actual")!;
    const m = calculateMetrics(s, "actual");
    expect(p.end).toBe("2026-03-31");
    expect(m.per).toBe(20);
    expect(m.pbr).toBe(2);
    expect(m.dividendYield).toBe(0);
    expect(m.marketCap).toBe(100);
    expect(m.operatingMargin).toBeCloseTo(3);
    expect(m.roe).toBeCloseTo((p.netIncome! / p.averageEquity!) * 100);
    expect(calculateMetrics(s, "forecast").revenueGrowth).toBeNull();
    expect(selectedPeriod(s, "forecast")?.end).toBe("2027-03-31");
    expect(m.revenueGrowth).toBeCloseTo((1.16 / 1.08 - 1) * 100);
  });
  it("会計基準・連結・期間・実績予想が異なる前期を混ぜない", () => {
    for (const patch of [
      { standard: "IFRS" },
      { scope: "standalone" as const },
      { basis: "forecast" as const },
      { end: "2025-03-30" },
    ]) {
      const s = stocks()[0];
      Object.assign(
        s.periods.find((p) => p.end === "2025-03-31")!,
        patch,
      );
      expect(calculateMetrics(s, "actual").revenueGrowth).toBeNull();
    }
  });
  it("赤字EPS・ゼロ分母・欠損・無配を区別", () => {
    expect(calculateMetrics(stocks()[7], "actual").per).toBeNull();
    const s = stocks()[0],
      p = selectedPeriod(s, "actual")!;
    p.eps = 0;
    p.bps = -1;
    p.revenue = 0;
    p.totalAssets = 0;
    p.averageEquity = 0;
    const m = calculateMetrics(s, "actual");
    for (const key of [
      "per",
      "pbr",
      "operatingMargin",
      "equityRatio",
      "roe",
    ] as const)
      expect(m[key]).toBeNull();
    expect(m.dividendYield).toBe(0);
    expect(calculateMetrics(stocks()[6], "actual").dividendYield).toBeNull();
  });
  it("AND、上下限の境界、検索、業種、0件、欠損除外を処理", () => {
    const all = stocks();
    expect(
      filterStocks(
        all,
        conditions({
          query: "Ｓ００１",
          sector: "機械",
          ranges: {
            per: { min: 20, max: 20 },
            pbr: { min: 2, max: 2 },
            dividendYield: { min: 0, max: 0 },
            marketCap: { min: 100, max: 100 },
          },
        }),
      ).map((s) => s.code),
    ).toEqual(["S001"]);
    expect(filterStocks(all, conditions({ query: "あおば" }))).toHaveLength(1);
    expect(
      filterStocks(all, conditions({ ranges: { per: { min: 21, max: 20 } } })),
    ).toHaveLength(0);
    expect(filterStocks(all, conditions({ query: "存在しない" }))).toHaveLength(
      0,
    );
    expect(
      filterStocks(all, conditions({ ranges: { per: { min: 0 } } })).some(
        (s) => s.code === "S007",
      ),
    ).toBe(false);
    expect(filterStocks(all, conditions())).toHaveLength(8);
  });
  it("すべての数値条件を評価し、ソートの欠損は昇降順とも末尾", () => {
    const all = stocks();
    for (const key of [
      "per",
      "pbr",
      "roe",
      "dividendYield",
      "marketCap",
      "revenueGrowth",
      "operatingMargin",
      "equityRatio",
    ] as const) {
      expect(
        filterStocks(all, conditions({ ranges: { [key]: { min: 1e12 } } })),
      ).toHaveLength(0);
    }
    for (const direction of ["asc", "desc"] as const) {
      const sorted = filterStocks(all, conditions({ sort: "per", direction }));
      expect(calculateMetrics(sorted.at(-1)!, "actual").per).toBeNull();
      const nums = sorted
        .map((s) => calculateMetrics(s, "actual").per)
        .filter((n): n is number => n !== null);
      expect(nums).toEqual(
        [...nums].sort((a, b) => (direction === "asc" ? a - b : b - a)),
      );
    }
  });
  it("比較は最大5件、解除後は追加でき重複しない", () => {
    let ids: string[] = [];
    for (let i = 0; i < 5; i++) ids = toggleComparison(ids, String(i));
    expect(() => toggleComparison(ids, "6")).toThrow(/最大5/);
    ids = toggleComparison(ids, "0");
    expect(toggleComparison(ids, "6")).toHaveLength(5);
  });
});
