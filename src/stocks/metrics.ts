import type {
  Basis,
  FinancialPeriod,
  MetricKey,
  Metrics,
  Stock,
} from "./types";
export const metricDefinitions: Record<
  MetricKey,
  { label: string; unit: string; formula: string; help: string }
> = {
  per: {
    label: "PER",
    unit: "倍",
    formula: "基準日の株価 ÷ 対象期EPS（EPS > 0）",
    help: "利益に対する株価の倍率。赤字・利益ゼロでは算出しません。業種や成長性でも変わります。",
  },
  pbr: {
    label: "PBR",
    unit: "倍",
    formula: "基準日の株価 ÷ 対象期BPS（BPS > 0）",
    help: "1株あたり純資産に対する倍率。低いだけでは割安と判断できません。",
  },
  roe: {
    label: "ROE",
    unit: "%",
    formula: "対象期の純利益 ÷ 対象期の平均自己資本 × 100（平均自己資本 > 0）",
    help: "自己資本で利益を生む度合い。借入の増加でも高くなることがあり、財務構造と合わせて読みます。",
  },
  dividendYield: {
    label: "配当利回り",
    unit: "%",
    formula: "対象期の年間1株配当 ÷ 基準日の株価 × 100",
    help: "株価に対する年間配当の割合。無配の0%とデータ欠損は別です。減配の可能性もあります。",
  },
  marketCap: {
    label: "時価総額",
    unit: "億",
    formula: "株価基準日の入力値（通常は株価 × 発行済株式数）",
    help: "企業の市場での規模。入力元の自己株式などの定義を確認してください。",
  },
  revenueGrowth: {
    label: "売上高成長率",
    unit: "%",
    formula:
      "(対象期売上高 ÷ 比較可能な前期売上高 − 1) × 100（前期売上高 > 0）",
    help: "実績／予想・会計基準・連結区分が同じ連続した通期だけを比較します。短期の増減だけで判断しません。",
  },
  operatingMargin: {
    label: "営業利益率",
    unit: "%",
    formula: "対象期営業利益 ÷ 対象期売上高 × 100（売上高 > 0）",
    help: "売上に対する本業の利益。業種によって水準が異なります。",
  },
  equityRatio: {
    label: "自己資本比率",
    unit: "%",
    formula: "対象期末自己資本 ÷ 対象期末総資産 × 100（総資産 > 0）",
    help: "資産に占める自己資本の割合。高低だけで安全性や成長性を断定しません。",
  },
};
export const metricKeys = Object.keys(metricDefinitions) as MetricKey[];
export function selectedPeriod(
  stock: Stock,
  basis: Basis,
): FinancialPeriod | undefined {
  return stock.periods
    .filter((p) => p.basis === basis)
    .sort((a, b) => b.end.localeCompare(a.end))[0];
}
export function compatible(a: FinancialPeriod, b: FinancialPeriod): boolean {
  return (
    a.basis === b.basis && a.standard === b.standard && a.scope === b.scope
  );
}
export function calculateMetrics(stock: Stock, basis: Basis): Metrics {
  const p = selectedPeriod(stock, basis);
  const ratio = (
    a: number | null | undefined,
    b: number | null | undefined,
    mult = 1,
  ): number | null => {
    if (a == null || b == null || b <= 0) return null;
    const value = (a / b) * mult;
    return Number.isFinite(value) ? value : null;
  };
  const previous = p
    ? stock.periods.find(
        (q) =>
          compatible(p, q) &&
          Date.parse(q.end) + 86400000 === Date.parse(p.start),
      )
    : undefined;
  const growth =
    previous &&
    p &&
    p.revenue !== null &&
    previous.revenue !== null &&
    previous.revenue > 0
      ? (p.revenue / previous.revenue - 1) * 100
      : null;
  return {
    per: ratio(stock.price, p?.eps),
    pbr: ratio(stock.price, p?.bps),
    roe: ratio(p?.netIncome, p?.averageEquity, 100),
    dividendYield: ratio(p?.dividendPerShare, stock.price, 100),
    marketCap: stock.marketCap == null ? null : stock.marketCap / 1e8,
    revenueGrowth: growth !== null && Number.isFinite(growth) ? growth : null,
    operatingMargin: ratio(p?.operatingProfit, p?.revenue, 100),
    equityRatio: ratio(p?.equity, p?.totalAssets, 100),
  };
}
export function formatValue(
  value: number | null | undefined,
  unit = "",
): string {
  return value == null
    ? "—（欠損・算出不可）"
    : `${value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${unit}`;
}
