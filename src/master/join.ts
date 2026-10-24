import type { Stock } from "../stocks/types";
import type { MasterDatasetV2 } from "./types";
export function joinMaster(
  master: MasterDatasetV2,
  financial: Stock[],
): Stock[] {
  const byId = new Map(
    financial.filter((s) => s.market === "JP").map((s) => [s.id, s]),
  );
  return master.records.map((record) => {
    const data = byId.get(record.id);
    return {
      id: record.id,
      market: "JP",
      code: record.code,
      name: record.name,
      sector: record.sector,
      currency: "JPY",
      price: data?.price ?? null,
      priceDate: data?.priceDate ?? null,
      marketCap: data?.marketCap ?? null,
      quoteSource: data?.quoteSource ?? "",
      updatedAt: data?.updatedAt ?? null,
      periods: data?.periods ?? [],
      marketSegment: record.marketSegment,
      securityType: record.securityType,
      masterAsOfDate: master.asOfDate,
    };
  });
}
