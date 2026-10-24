import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { masterRepository } from "../../storage/master";
import { analysisRepository, type WatchItem } from "../../storage/analysis";
import { typeLabels, type MasterDatasetV2 } from "../../master/types";
import { MasterImport } from "./MasterImport";
export const MASTER_PAGE_SIZE = 50;
export function MasterPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<MasterDatasetV2 | null>(null),
    [watch, setWatch] = useState<WatchItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  const [query, setQuery] = useState(""),
    [market, setMarket] = useState(""),
    [sector, setSector] = useState(""),
    [type, setType] = useState(""),
    [page, setPage] = useState(0);
  const requestId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const [master, items] = await Promise.all([
        masterRepository.load(),
        analysisRepository.listWatch(),
      ]);
      if (request === requestId.current) {
        setData(master);
        setWatch(items);
        setError("");
      }
    } catch {
      if (request === requestId.current)
        setError(
          "保存データを読み込めません。保存設定を確認して再読み込みしてください。",
        );
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      requestId.current++;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    setPage(0);
  }, [query, market, sector, type, data?.importedAt, data?.asOfDate]);
  const rows = useMemo(() => {
    const search = query.trim().normalize("NFKC").toLowerCase();
    return (data?.records ?? []).filter(
      (r) =>
        (!search ||
          `${r.code} ${r.name}`
            .normalize("NFKC")
            .toLowerCase()
            .includes(search)) &&
        (!market || r.marketSegment === market) &&
        (!sector || r.sector === sector) &&
        (!type || r.securityType === type),
    );
  }, [data, query, market, sector, type]);
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / MASTER_PAGE_SIZE) - 1),
  );
  async function save(value: MasterDatasetV2) {
    if (busy) throw new Error("別の保存が完了してから再試行してください。");
    setBusy(true);
    requestId.current++;
    try {
      const result = await masterRepository.save(value);
      await refresh();
      return result === "unchanged"
        ? "同じ基準日・同じ銘柄データです。重複追加せず保存内容を維持しました。"
        : "銘柄マスターを保存しました。";
    } finally {
      setBusy(false);
    }
  }
  async function toggle(id: string) {
    const record = data?.records.find((r) => r.id === id);
    if (!record || busy) return;
    setBusy(true);
    requestId.current++;
    setError("");
    try {
      if (watch.some((w) => w.id === id))
        await analysisRepository.removeWatch(id);
      else
        await analysisRepository.addWatch({
          id,
          market: "JP",
          code: record.code,
          name: record.name,
          addedAt: new Date().toISOString(),
        });
      setWatch(await analysisRepository.listWatch());
    } catch {
      setError("ウォッチリストを保存できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  function backup() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-master-v2-${data.asOfDate}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  }
  return (
    <section className="stock-workspace master-page">
      <div className="eyebrow">YOUR PERSONAL SECURITY MASTER</div>
      <h1>銘柄一覧</h1>
      <aside className="data-banner">
        <strong>本人が取り込む銘柄マスター</strong>
        <p>
          架空サンプルとは別管理です。外部送信・JPXへの自動取得は行いません。株価・財務は手動取込データと市場＋コードで結び付けます。ない数値は「データなし」で表示します。
        </p>
        <p>
          ブラウザデータの削除・端末の変更で記録が失われます。必要に応じてバックアップを保存してください。
        </p>
      </aside>
      {error && (
        <div className="error" role="alert">
          {error}
          <button className="text-button" onClick={() => void refresh()}>
            再読み込み
          </button>
        </div>
      )}
      <MasterImport onSave={save} disabled={busy} />
      {loading ? (
        <p role="status">銘柄一覧を読み込んでいます…</p>
      ) : !data ? (
        <section className="panel">
          <h2>銘柄マスターは未登録です</h2>
          <p>
            公式サイトから本人が入手したファイルを上の取込画面で選択してください。架空8銘柄は「銘柄分析」から引き続き利用できます。
          </p>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>保存済みマスター</h2>
            <p>
              基準日：{data.asOfDate}（
              {data.dateOrigin === "manual" ? "本人入力" : "元データの列"}）
              <br />
              最終更新日時（取込）：
              {new Date(data.importedAt).toLocaleString("ja-JP")}
              <br />
              元ファイル：{data.fileName} / シート：{data.sheetName}
            </p>
            <p className="storage-note">
              v2バックアップは銘柄マスターのみです。ウォッチ・財務・学習履歴は含みません。元の取込ファイルも保管してください。
            </p>
            <div className="stock-actions">
              <button className="secondary" onClick={backup}>
                マスターをv2 JSONでバックアップ
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmClear(true)}
              >
                保存済みマスターを削除
              </button>
            </div>
            {confirmClear && (
              <div className="import-preview">
                <p>
                  マスターだけを削除します。ウォッチ・財務・学習記録は残ります。
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    requestId.current++;
                    void masterRepository
                      .clear()
                      .then(() => {
                        setConfirmClear(false);
                        return refresh();
                      })
                      .catch(() =>
                        setError("削除できませんでした。再試行してください。"),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  削除を確定
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmClear(false)}
                >
                  キャンセル
                </button>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="filter-grid">
              <label>
                企業名・証券コード検索
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="企業名・英数字コード"
                />
              </label>
              <label>
                市場区分
                <select
                  aria-label="市場区分"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                >
                  <option value="">すべての市場区分</option>
                  {[...new Set(data.records.map((r) => r.marketSegment))]
                    .sort()
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
              <label>
                業種
                <select
                  aria-label="業種"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="">すべての業種</option>
                  {[...new Set(data.records.map((r) => r.sector))]
                    .sort()
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
              <label>
                商品区分
                <select
                  aria-label="商品区分"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">すべての商品区分</option>
                  {Object.entries(typeLabels).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setQuery("");
                setMarket("");
                setSector("");
                setType("");
              }}
            >
              一覧条件をリセット
            </button>
          </section>
          <p role="status">
            該当 {rows.length.toLocaleString()}件 /{" "}
            {data.records.length.toLocaleString()}銘柄
          </p>
          <p className="storage-note">
            1ページ50件で表示します。業種・市場の名称は元ファイルの値を保持します。未分類を普通株式とみなしません。
          </p>
          {rows.length === 0 ? (
            <p className="panel">条件に一致する銘柄はありません。</p>
          ) : (
            <div className="master-list" ref={resultsRef}>
              {rows
                .slice(
                  safePage * MASTER_PAGE_SIZE,
                  (safePage + 1) * MASTER_PAGE_SIZE,
                )
                .map((record) => (
                  <article className="panel" key={record.id}>
                    <small>
                      {record.code} / {record.marketSegment} /{" "}
                      {typeLabels[record.securityType]}
                    </small>
                    <h2>
                      <button
                        className="stock-title"
                        onClick={() => onOpen(record.id)}
                      >
                        {record.name} →
                      </button>
                    </h2>
                    <p>{record.sector}</p>
                    <button
                      className="secondary"
                      disabled={busy}
                      aria-pressed={watch.some((w) => w.id === record.id)}
                      onClick={() => void toggle(record.id)}
                    >
                      {watch.some((w) => w.id === record.id)
                        ? "★ ウォッチ解除"
                        : "☆ ウォッチに追加"}
                    </button>
                  </article>
                ))}
            </div>
          )}
          <div className="pagination">
            <button
              className="secondary"
              disabled={safePage === 0}
              onClick={() => {
                setPage(safePage - 1);
                resultsRef.current?.scrollIntoView?.({ block: "start" });
              }}
            >
              前の50件
            </button>
            <span>
              {safePage + 1} /{" "}
              {Math.max(1, Math.ceil(rows.length / MASTER_PAGE_SIZE))}ページ
            </span>
            <button
              className="secondary"
              disabled={(safePage + 1) * MASTER_PAGE_SIZE >= rows.length}
              onClick={() => {
                setPage(safePage + 1);
                resultsRef.current?.scrollIntoView?.({ block: "start" });
              }}
            >
              次の50件
            </button>
          </div>
        </>
      )}
    </section>
  );
}
