import { parseMasterWorkbook } from "./files";
self.onmessage = async (
  event: MessageEvent<{ buffer: ArrayBuffer; name: string }>,
) => {
  try {
    self.postMessage({
      sheets: await parseMasterWorkbook(event.data.buffer, event.data.name),
    });
  } catch (e) {
    self.postMessage({
      error:
        e instanceof Error ? e.message : "ファイルを読み込めませんでした。",
    });
  }
};
