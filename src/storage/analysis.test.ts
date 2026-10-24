import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { analysisRepository } from "./analysis";
import { sampleStockProvider } from "../stocks/provider";
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase("stock-investment-analysis");
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});
describe("銘柄分析の永続化", () => {
  it("ウォッチを保存・復元・重複排除・削除", async () => {
    expect(await analysisRepository.listWatch()).toEqual([]);
    const item = {
      id: "JP:S001",
      market: "JP" as const,
      code: "S001",
      name: "架空あおば",
      addedAt: "2026-10-24T00:00:00Z",
    };
    await analysisRepository.addWatch(item);
    await analysisRepository.addWatch(item);
    expect(await analysisRepository.listWatch()).toEqual([item]);
    await analysisRepository.removeWatch(item.id);
    expect(await analysisRepository.listWatch()).toEqual([]);
  });
  it("取込データを保存・復元・削除してもウォッチは残る", async () => {
    const stocks = await sampleStockProvider.load();
    const saved = {
      id: "imported" as const,
      stocks,
      fileName: "sample.json",
      importedAt: "2026-10-24T00:00:00Z",
    };
    await analysisRepository.saveDataset(saved);
    expect(await analysisRepository.loadDataset()).toEqual(saved);
    await analysisRepository.addWatch({
      id: "JP:S001",
      market: "JP",
      code: "S001",
      name: "架空あおば",
      addedAt: saved.importedAt,
    });
    await analysisRepository.saveDataset(null);
    expect(await analysisRepository.loadDataset()).toBeNull();
    expect(await analysisRepository.listWatch()).toHaveLength(1);
  });
});
