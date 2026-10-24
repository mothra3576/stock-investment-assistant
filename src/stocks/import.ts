import type { FinancialPeriod, Stock } from "./types";
export const columns = [
  "market",
  "code",
  "name",
  "sector",
  "currency",
  "amountUnit",
  "price",
  "priceDate",
  "marketCap",
  "quoteSource",
  "updatedAt",
  "periodStart",
  "periodEnd",
  "basis",
  "standard",
  "scope",
  "financialSource",
  "revenue",
  "operatingProfit",
  "netIncome",
  "averageEquity",
  "equity",
  "totalAssets",
  "eps",
  "bps",
  "dividendPerShare",
] as const;
const numeric = [
  "price",
  "marketCap",
  "revenue",
  "operatingProfit",
  "netIncome",
  "averageEquity",
  "equity",
  "totalAssets",
  "eps",
  "bps",
  "dividendPerShare",
] as const;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    ended = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          ended = true;
        }
      } else cell += char;
      continue;
    }
    if (char === '"') {
      if (cell || ended) throw new Error("CSVの引用符が不正です。");
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      ended = false;
      if (char !== ",") {
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (ended) throw new Error("CSVの閉じ引用符の後に文字があります。");
      cell += char;
    }
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
function date(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${label}: YYYY-MM-DDの実在する日付が必要です。`);
  return value;
}
export function parseStockFile(text: string, format: "json" | "csv"): Stock[] {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("ファイルは2MB以下にしてください。");
  text = text.replace(/^\uFEFF/, "");
  let raw: unknown;
  if (format === "json") {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("JSONの構文が不正です。");
    }
  } else {
    const rows = csvRows(text);
    const header = rows.shift();
    if (
      !header ||
      header.length !== columns.length ||
      new Set(header).size !== columns.length ||
      columns.some((k) => !header.includes(k))
    )
      throw new Error(
        "CSVのヘッダーは見本の全列を過不足なく指定してください。",
      );
    raw = rows.map((r, index) => {
      if (r.length !== header.length)
        throw new Error(`CSV ${index + 2}行目: 列数が不正です。`);
      return Object.fromEntries(header.map((h, i) => [h, r[i]]));
    });
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 2000)
    throw new Error("データは1〜2,000行の配列にしてください。");
  const stocks = new Map<string, Stock>();
  raw.forEach((value, index) => {
    const label = `${index + 1}件目`;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`${label}: 行はオブジェクトにしてください。`);
    const row = value as Record<string, unknown>;
    if (
      columns.some((k) => !(k in row)) ||
      Object.keys(row).some(
        (k) => !columns.includes(k as (typeof columns)[number]),
      )
    )
      throw new Error(`${label}: 見本の全項目を過不足なく指定してください。`);
    const str = (key: string, max = 160): string => {
      const v = row[key];
      if (
        typeof v !== "string" ||
        !v.trim() ||
        v.length > max ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
      )
        throw new Error(`${label} ${key}: 1〜${max}文字の文字列が必要です。`);
      return v.trim();
    };
    const market = str("market"),
      currency = str("currency"),
      code = str("code", 12).toUpperCase();
    if (
      !["JP", "US"].includes(market) ||
      currency !== (market === "JP" ? "JPY" : "USD")
    )
      throw new Error(`${label}: JP/JPYまたはUS/USDを指定してください。`);
    if (!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(code))
      throw new Error(`${label}: codeが不正です。`);
    if (str("amountUnit") !== "unit")
      throw new Error(
        `${label}: amountUnitはunit（円／USDの実額）にしてください。`,
      );
    const numbers = {} as Record<(typeof numeric)[number], number | null>;
    for (const key of numeric) {
      let n = row[key];
      if (format === "csv") {
        const s = String(n).trim();
        if (s === "") n = null;
        else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))
          n = Number(s);
        else throw new Error(`${label} ${key}: 数値または空欄が必要です。`);
      }
      if (
        n !== null &&
        (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e16)
      )
        throw new Error(
          `${label} ${key}: 有限数値（絶対値1e16以下）またはnullが必要です。`,
        );
      numbers[key] = n as number | null;
    }
    if (numbers.price !== null && numbers.price <= 0)
      throw new Error(`${label}: priceは正数または欠損にしてください。`);
    for (const key of [
      "marketCap",
      "revenue",
      "averageEquity",
      "totalAssets",
      "dividendPerShare",
    ] as const)
      if (numbers[key] !== null && numbers[key]! < 0)
        throw new Error(`${label}: ${key}は非負数または欠損にしてください。`);
    const start = date(row.periodStart, `${label} periodStart`),
      end = date(row.periodEnd, `${label} periodEnd`);
    const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
    if (days < 365 || days > 366)
      throw new Error(
        `${label}: 初期版は365〜366日の通期データのみ対応します。`,
      );
    const basis = str("basis"),
      scope = str("scope");
    if (
      !["actual", "forecast"].includes(basis) ||
      !["consolidated", "standalone"].includes(scope)
    )
      throw new Error(`${label}: basisまたはscopeが不正です。`);
    const updatedAt = date(row.updatedAt, `${label} updatedAt`),
      priceDate = date(row.priceDate, `${label} priceDate`);
    if (priceDate > updatedAt || (basis === "actual" && end > updatedAt))
      throw new Error(
        `${label}: 基準日・実績の期末日は更新日以前にしてください。`,
      );
    const id = `${market}:${code}`;
    const identity = {
      id,
      market: market as Stock["market"],
      code,
      name: str("name"),
      sector: str("sector", 80),
      currency: currency as Stock["currency"],
      price: numbers.price,
      priceDate,
      marketCap: numbers.marketCap,
      quoteSource: str("quoteSource", 500),
      updatedAt,
    };
    const financial: FinancialPeriod = {
      start,
      end,
      basis: basis as FinancialPeriod["basis"],
      scope: scope as FinancialPeriod["scope"],
      standard: str("standard", 80),
      source: str("financialSource", 500),
      revenue: numbers.revenue,
      operatingProfit: numbers.operatingProfit,
      netIncome: numbers.netIncome,
      averageEquity: numbers.averageEquity,
      equity: numbers.equity,
      totalAssets: numbers.totalAssets,
      eps: numbers.eps,
      bps: numbers.bps,
      dividendPerShare: numbers.dividendPerShare,
    };
    const existing = stocks.get(id);
    if (existing) {
      const { periods, ...same } = existing;
      if (JSON.stringify(same) !== JSON.stringify(identity))
        throw new Error(
          `${label}: 同一銘柄の企業・株価情報を全行で一致させてください。`,
        );
      if (
        periods.some(
          (p) => p.basis === basis && p.start <= end && start <= p.end,
        )
      )
        throw new Error(
          `${label}: 同一銘柄・実績／予想区分の会計期間が重複しています。`,
        );
      existing.periods.push(financial);
    } else stocks.set(id, { ...identity, periods: [financial] });
  });
  return [...stocks.values()];
}
