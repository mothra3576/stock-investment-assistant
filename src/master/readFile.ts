import { MAX_MASTER_BYTES, type MasterSheet } from "./types";
export async function readMasterFile(file: File): Promise<MasterSheet[]> {
  if (!file.size || file.size > MAX_MASTER_BYTES)
    throw new Error("ファイルは空でない8MB以下にしてください。");
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./file.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "読込が30秒を超えました。対象のシートだけをCSVに変換してください。",
        ),
      );
    }, 30000);
    worker.onmessage = (event) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.sheets);
    };
    worker.onerror = () => {
      finish();
      reject(new Error("ファイルの読込に失敗しました。再試行してください。"));
    };
    worker.postMessage({ buffer, name: file.name }, [buffer]);
  });
}
