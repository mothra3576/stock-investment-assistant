import { calculateMetrics } from "./metrics";
import type { Basis, Market, MetricKey, Stock } from "./types";
export type Ranges = Partial<Record<MetricKey, { min?: number; max?: number }>>;
export interface ScreenConditions {
  query: string;
  sector: string;
  market: Market;
  basis: Basis;
  ranges: Ranges;
  sort: MetricKey | "code";
  direction: "asc" | "desc";
}
export const defaultConditions: ScreenConditions = {
  query: "",
  sector: "",
  market: "JP",
  basis: "actual",
  ranges: {},
  sort: "code",
  direction: "asc",
};
export function filterStocks(stocks: Stock[], c: ScreenConditions): Stock[] {
  const query = c.query.trim().normalize("NFKC").toLocaleLowerCase();
  const rows = stocks
    .filter(
      (s) =>
        s.market === c.market &&
        (!c.sector || s.sector === c.sector) &&
        (!query ||
          `${s.code} ${s.name}`
            .normalize("NFKC")
            .toLocaleLowerCase()
            .includes(query)),
    )
    .map((stock) => ({ stock, metrics: calculateMetrics(stock, c.basis) }));
  return rows
    .filter(({ metrics }) =>
      Object.entries(c.ranges).every(([key, range]) => {
        if (range.min === undefined && range.max === undefined) return true;
        const value = metrics[key as MetricKey];
        return (
          value !== null &&
          (range.min === undefined || value >= range.min) &&
          (range.max === undefined || value <= range.max)
        );
      }),
    )
    .sort((a, b) => {
      if (c.sort === "code")
        return (
          (c.direction === "asc" ? 1 : -1) *
          a.stock.code.localeCompare(b.stock.code)
        );
      const av = a.metrics[c.sort],
        bv = b.metrics[c.sort];
      if (av === null && bv === null)
        return a.stock.code.localeCompare(b.stock.code);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (
        (c.direction === "asc" ? av - bv : bv - av) ||
        a.stock.code.localeCompare(b.stock.code)
      );
    })
    .map((r) => r.stock);
}
export function toggleComparison(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= 5)
    throw new Error("比較は最大5銘柄です。先に選択を解除してください。");
  return [...ids, id];
}
