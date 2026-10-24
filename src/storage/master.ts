import type { MasterDatasetV2 } from "../master/types";
import { validateV2 } from "../master/validation";
export interface MasterRepository {
  load(): Promise<MasterDatasetV2 | null>;
  save(dataset: MasterDatasetV2): Promise<"saved" | "unchanged">;
  clear(): Promise<void>;
}
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("stock-investment-master", 1);
    let blocked = false;
    req.onupgradeneeded = () => req.result.createObjectStore("master");
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
      reject(new Error("他のタブを閉じて再試行してください。"));
    };
  });
}
export const masterRepository: MasterRepository = {
  async load() {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("master", "readonly"),
          req = tx.objectStore("master").get("current");
        tx.oncomplete = () => {
          try {
            resolve(req.result ? validateV2(req.result) : null);
          } catch (e) {
            reject(e);
          }
        };
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async save(input) {
    const data = validateV2(input),
      db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("master", "readwrite"),
          store = tx.objectStore("master"),
          req = store.get("current");
        let result: "saved" | "unchanged" = "saved";
        req.onsuccess = () => {
          const previous = req.result as MasterDatasetV2 | undefined;
          if (
            previous &&
            previous.asOfDate === data.asOfDate &&
            JSON.stringify(previous.records) === JSON.stringify(data.records)
          ) {
            result = "unchanged";
            return;
          }
          store.put(data, "current");
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () =>
          reject(tx.error ?? new Error("保存を中断しました。"));
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async clear() {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("master", "readwrite");
        tx.objectStore("master").delete("current");
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
};
