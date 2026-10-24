import type { Stock } from "../stocks/types";
export interface WatchItem {
  id: string;
  market: Stock["market"];
  code: string;
  name: string;
  addedAt: string;
}
export interface SavedDataset {
  id: "imported";
  stocks: Stock[];
  fileName: string;
  importedAt: string;
}
export interface AnalysisRepository {
  listWatch(): Promise<WatchItem[]>;
  addWatch(item: WatchItem): Promise<void>;
  removeWatch(id: string): Promise<void>;
  loadDataset(): Promise<SavedDataset | null>;
  saveDataset(dataset: SavedDataset | null): Promise<void>;
}
// A separate, versioned database leaves all existing learning records untouched.
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("stock-investment-analysis", 1);
    let blocked = false;
    req.onupgradeneeded = () => {
      req.result.createObjectStore("watch", { keyPath: "id" });
      req.result.createObjectStore("datasets", { keyPath: "id" });
    };
    req.onsuccess = () => {
      if (blocked) {
        req.result.close();
        return;
      }
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      blocked = true;
      reject(new Error("別タブを閉じて再試行してください。"));
    };
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = run(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result as T);
      tx.onabort = () => reject(tx.error ?? new Error("保存を中断しました。"));
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export const analysisRepository: AnalysisRepository = {
  listWatch: () =>
    transaction<WatchItem[]>("watch", "readonly", (s) => s.getAll()),
  addWatch: (item) =>
    transaction<void>("watch", "readwrite", (s) => s.put(item)),
  removeWatch: (id) =>
    transaction<void>("watch", "readwrite", (s) => s.delete(id)),
  async loadDataset() {
    return (
      (await transaction<SavedDataset | undefined>(
        "datasets",
        "readonly",
        (s) => s.get("imported"),
      )) ?? null
    );
  },
  saveDataset: (dataset) =>
    transaction<void>("datasets", "readwrite", (s) =>
      dataset ? s.put(dataset) : s.delete("imported"),
    ),
};
