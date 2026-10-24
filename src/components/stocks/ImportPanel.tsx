import { useState, type FormEvent } from "react";
import { MAX_FILE_BYTES } from "../../stocks/import";
import { FileStockDataProvider } from "../../stocks/provider";
import type { Stock } from "../../stocks/types";
export function ImportPanel({
  onImport,
  onSample,
  busy,
  hasMaster = false,
}: {
  onImport: (stocks: Stock[], fileName: string) => Promise<void>;
  onSample: () => Promise<void>;
  busy: boolean;
  hasMaster?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || working || busy) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES)
        throw new Error("ファイルは2MB以下にしてください。");
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "json" && ext !== "csv")
        throw new Error("拡張子.csvまたは.jsonのファイルを指定してください。");
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        throw new Error(
          "UTF-8形式のファイルを指定してください（Shift_JIS不可）。",
        );
      }
      const stocks = await new FileStockDataProvider(text, ext).load();
      await onImport(stocks, file.name);
      setMessage(
        `${stocks.length}銘柄を取り込み、このブラウザに保存しました。`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "取り込みに失敗しました。元のデータは維持されています。",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <details className="panel">
      <summary>CSV / JSONを取り込む・見本をダウンロード</summary>
      <p>
        UTF-8 /
        最大2MB・2,000行。すべて検証してから現在の銘柄データを置き換えます。株価は円／USD、財務金額は円／USDの実額で入力してください。ファイルは外部へ送信しません。
      </p>
      <p>
        <a href={`${import.meta.env.BASE_URL}examples/stocks.csv`} download>
          CSV見本
        </a>{" "}
        /{" "}
        <a href={`${import.meta.env.BASE_URL}examples/stocks.json`} download>
          JSON見本
        </a>{" "}
        /{" "}
        <a href={`${import.meta.env.BASE_URL}examples/FORMAT.txt`}>
          形式・指標の注意点
        </a>
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          取込ファイル
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={working || busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
              setMessage("");
            }}
          />
        </label>
        <button className="primary" disabled={!file || working || busy}>
          {working ? "検証・保存中…" : "検証して取り込む"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button
        className="secondary"
        disabled={working || busy}
        onClick={() => {
          if (working || busy) return;
          setWorking(true);
          setMessage("");
          setError("");
          void onSample()
            .then(() =>
              setMessage(
                hasMaster
                  ? "財務取込データを削除しました。マスターは維持します。"
                  : "取込データを削除してサンプルに戻しました。",
              ),
            )
            .catch(() =>
              setError("サンプルに戻せませんでした。再試行してください。"),
            )
            .finally(() => setWorking(false));
        }}
      >
        {hasMaster
          ? "財務取込データを削除（マスターは維持）"
          : "サンプルに戻す（取込データを削除）"}
      </button>
    </details>
  );
}
