export type Market = "JP" | "US";
export type Basis = "actual" | "forecast";
export interface FinancialPeriod {
  start: string;
  end: string;
  basis: Basis;
  standard: string;
  scope: "consolidated" | "standalone";
  source: string;
  revenue: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
  averageEquity: number | null;
  equity: number | null;
  totalAssets: number | null;
  eps: number | null;
  bps: number | null;
  dividendPerShare: number | null;
}
export interface Stock {
  id: string;
  market: Market;
  code: string;
  name: string;
  sector: string;
  currency: "JPY" | "USD";
  price: number | null;
  priceDate: string | null;
  marketCap: number | null;
  quoteSource: string;
  updatedAt: string | null;
  periods: FinancialPeriod[];
  marketSegment?: string;
  securityType?: import("../master/types").SecurityType;
  masterAsOfDate?: string;
}
export type MetricKey =
  | "per"
  | "pbr"
  | "roe"
  | "dividendYield"
  | "marketCap"
  | "revenueGrowth"
  | "operatingMargin"
  | "equityRatio";
export type Metrics = Record<MetricKey, number | null>;
export interface StockDataProvider {
  load(): Promise<Stock[]>;
}
export const basisLabel = (basis: Basis) =>
  basis === "actual" ? "実績" : "予想";
