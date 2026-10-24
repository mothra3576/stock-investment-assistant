export interface Attempt {
  id: string;
  lessonId: string;
  correct: boolean;
  answeredAt: string;
}
// Future Graph synchronization can consume local records through this boundary.
export interface ProgressRepository {
  list(): Promise<Attempt[]>;
  add(attempt: Attempt): Promise<void>;
}
const DB_NAME = "stock-investment-assistant";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("attempts", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("他のタブを閉じて再読み込みしてください。"));
  });
}
export const progressRepository: ProgressRepository = {
  async list() {
    const db = await open();
    try {
      return await new Promise<Attempt[]>((resolve, reject) => {
        const tx = db.transaction("attempts", "readonly");
        const request = tx.objectStore("attempts").getAll();
        tx.oncomplete = () => resolve(request.result as Attempt[]);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async add(attempt) {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("attempts", "readwrite");
        tx.objectStore("attempts").put(attempt);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
};
export function completedIds(attempts: Attempt[]): Set<string> {
  return new Set(attempts.filter((a) => a.correct).map((a) => a.lessonId));
}

// randomUUID needs HTTPS; getRandomValues also works for LAN HTTP development.
export function createAttemptId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
