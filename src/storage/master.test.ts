import "fake-indexeddb/auto";
import { beforeEach, it, expect, vi } from "vitest";
import { masterRepository } from "./master";
import { analysisRepository } from "./analysis";
import { progressRepository } from "./progress";
import type { MasterDatasetV2 } from "../master/types";
const data = (): MasterDatasetV2 => ({
  version: 2,
  kind: "security-master",
  source: "user-file",
  asOfDate: "2026-09-30",
  dateOrigin: "manual",
  fileName: "artificial.csv",
  sheetName: "CSV",
  importedAt: "2026-10-24T00:00:00Z",
  records: [
    {
      id: "JP:130A",
      code: "130A",
      name: "架空検証",
      marketSegment: "市場甲",
      sector: "業種甲",
      securityType: "ordinary",
    },
  ],
});
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase("stock-investment-master");
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});
it("保存・復元、同一データは更新日時を保持し、新版は置換", async () => {
  const first = data();
  expect(await masterRepository.save(first)).toBe("saved");
  expect(await masterRepository.load()).toEqual(first);
  expect(
    await masterRepository.save({
      ...first,
      fileName: "same.csv",
      importedAt: "2026-10-25T00:00:00Z",
    }),
  ).toBe("unchanged");
  expect(await masterRepository.load()).toEqual(first);
  const next = {
    ...first,
    asOfDate: "2026-10-31",
    records: [{ ...first.records[0], name: "架空検証改名" }],
  };
  expect(await masterRepository.save(next)).toBe("saved");
  expect(await masterRepository.load()).toEqual(next);
});
it("入力検証・トランザクション失敗で旧データを保護", async () => {
  const first = data();
  await masterRepository.save(first);
  await expect(
    masterRepository.save({ ...first, records: [] }),
  ).rejects.toThrow();
  expect(await masterRepository.load()).toEqual(first);
  const put = IDBObjectStore.prototype.put;
  const spy = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const req = put.call(this, value, key);
      this.transaction.abort();
      return req;
    });
  try {
    await expect(
      masterRepository.save({ ...first, asOfDate: "2026-10-31" }),
    ).rejects.toThrow();
  } finally {
    spy.mockRestore();
  }
  expect(await masterRepository.load()).toEqual(first);
});
it("削除・再取込でも学習・ウォッチ・財務データを維持", async () => {
  await progressRepository.add({
    id: "learning-preserved",
    lessonId: "basics",
    correct: true,
    answeredAt: "2026-10-24T00:00:00Z",
  });
  const watch = {
    id: "JP:130A",
    code: "130A",
    market: "JP" as const,
    name: "架空検証",
    addedAt: "2026-10-24T00:00:00Z",
  };
  await analysisRepository.addWatch(watch);
  const financial = {
    id: "imported" as const,
    stocks: [],
    fileName: "financial.json",
    importedAt: "2026-10-24T00:00:00Z",
  };
  await analysisRepository.saveDataset(financial);
  await masterRepository.save(data());
  const backup = JSON.stringify(await masterRepository.load());
  await masterRepository.clear();
  expect(await masterRepository.load()).toBeNull();
  await masterRepository.save(JSON.parse(backup));
  expect(await masterRepository.load()).toEqual(data());
  expect(await analysisRepository.listWatch()).toContainEqual(watch);
  expect(await analysisRepository.loadDataset()).toEqual(financial);
  expect(
    (await progressRepository.list()).some(
      (a) => a.id === "learning-preserved",
    ),
  ).toBe(true);
});
