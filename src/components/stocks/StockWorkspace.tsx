import { masterRepository } from "../../storage/master";
import { joinMaster } from "../../master/join";
import { typeLabels } from "../../master/types";
import type { MasterDatasetV2 } from "../../master/types";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateMetrics,
  formatValue,
  selectedPeriod,
} from "../../stocks/metrics";
import { sampleStockProvider } from "../../stocks/provider";
import {
  defaultConditions,
  filterStocks,
  toggleComparison,
} from "../../stocks/screen";
import { basisLabel, type Stock } from "../../stocks/types";
import {
  analysisRepository,
  type SavedDataset,
  type WatchItem,
} from "../../storage/analysis";
import { ScreeningFilters } from "./ScreeningFilters";
import { StockDetail } from "./StockDetail";
import { StockComparison } from "./StockComparison";
import { ImportPanel } from "./ImportPanel";
export function StockWorkspace({
  initialSelection,
  onBackToMaster,
}: { initialSelection?: string | null; onBackToMaster?: () => void } = {}) {
  const [master, setMaster] = useState<MasterDatasetV2 | null>(null);
  const [resultPage, setResultPage] = useState(0);
  const [stocks, setStocks] = useState<Stock[]>([]),
    [dataset, setDataset] = useState<SavedDataset | null>(null),
    [watch, setWatch] = useState<WatchItem[]>([]),
    [conditions, setConditions] = useState({ ...defaultConditions }),
    [compared, setCompared] = useState<string[]>([]),
    [selected, setSelected] = useState<string | null>(initialSelection ?? null),
    [tab, setTab] = useState<"screen" | "compare" | "watch">("screen");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const watchRequest = useRef(0);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [error]);
  const loadWatch = useCallback(async () => {
    const request = ++watchRequest.current;
    const values = await analysisRepository.listWatch();
    if (request === watchRequest.current) setWatch(values);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [samples, saved, savedMaster] = await Promise.all([
        sampleStockProvider.load(),
        analysisRepository.loadDataset(),
        masterRepository.load(),
      ]);
      await loadWatch();
      setMaster(savedMaster);
      setStocks(
        savedMaster
          ? joinMaster(savedMaster, saved?.stocks ?? [])
          : (saved?.stocks ?? samples),
      );
      setDataset(saved);
    } catch {
      setError(
        "銘柄データ・ウォッチリストを読み込めませんでした。保存設定を確認して再試行してください。",
      );
    } finally {
      setLoading(false);
    }
  }, [loadWatch]);
  useEffect(() => {
    void load();
    function visible() {
      if (document.visibilityState === "visible")
        void loadWatch().catch(() =>
          setError(
            "ウォッチリストを更新できませんでした。再読み込みしてください。",
          ),
        );
    }
    document.addEventListener("visibilitychange", visible);
    return () => {
      watchRequest.current++;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, loadWatch]);
  async function watchStock(stock: Stock | WatchItem) {
    if (busy) return;
    setBusy(true);
    setError("");
    ++watchRequest.current;
    try {
      if (watch.some((w) => w.id === stock.id))
        await analysisRepository.removeWatch(stock.id);
      else
        await analysisRepository.addWatch({
          id: stock.id,
          code: stock.code,
          market: stock.market,
          name: stock.name,
          addedAt: new Date().toISOString(),
        });
      await loadWatch();
    } catch {
      setError("ウォッチリストを保存できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  async function importStocks(values: Stock[], fileName: string) {
    const saved: SavedDataset = {
      id: "imported",
      stocks: values,
      fileName,
      importedAt: new Date().toISOString(),
    };
    await analysisRepository.saveDataset(saved);
    setDataset(saved);
    setStocks(master ? joinMaster(master, values) : values);
    setConditions({ ...defaultConditions });
    setCompared([]);
    setSelected(null);
  }
  async function restoreSample() {
    const samples = await sampleStockProvider.load();
    await analysisRepository.saveDataset(null);
    setDataset(null);
    setStocks(master ? joinMaster(master, []) : samples);
    setCompared([]);
    setSelected(null);
    setConditions({ ...defaultConditions });
  }
  useEffect(() => setResultPage(0), [conditions, stocks, tab]);
  function compare(id: string) {
    try {
      setCompared(toggleComparison(compared, id));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const rows = filterStocks(stocks, conditions),
    detail = stocks.find((s) => s.id === selected),
    comparedStocks = compared
      .map((id) => stocks.find((s) => s.id === id))
      .filter((s): s is Stock => !!s);
  function card(stock: Stock) {
    const metrics = calculateMetrics(stock, conditions.basis),
      p = selectedPeriod(stock, conditions.basis),
      watching = watch.some((w) => w.id === stock.id);
    return (
      <article className="panel stock-card" key={stock.id}>
        <div className="stock-card-header">
          <div>
            <small>
              {stock.code} · {stock.sector} · {stock.currency}{" "}
              {stock.marketSegment && ` / ${stock.marketSegment}`}{" "}
              {stock.securityType && ` / ${typeLabels[stock.securityType]}`}
            </small>
            <h3>
              <button
                className="stock-title"
                onClick={() => {
                  setSelected(stock.id);
                  window.scrollTo(0, 0);
                }}
              >
                {stock.name} →
              </button>
            </h3>
          </div>
          <span className="pill">{basisLabel(conditions.basis)}</span>
        </div>
        <p>
          株価{" "}
          {stock.masterAsOfDate && stock.price === null
            ? "データなし"
            : formatValue(
                stock.price,
                stock.currency === "JPY" ? "円" : "USD",
              )}{" "}
          / 基準日 {stock.priceDate ?? "データなし"}
        </p>
        <dl className="metrics-grid compact">
          {(
            [
              ["PER", metrics.per, "倍"],
              ["PBR", metrics.pbr, "倍"],
              ["ROE", metrics.roe, "%"],
              ["配当利回り", metrics.dividendYield, "%"],
            ] as const
          ).map(([label, value, unit]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {stock.masterAsOfDate && value === null
                  ? "データなし"
                  : formatValue(value, unit)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="stock-period">
          会計期間：
          {p
            ? `${p.start}〜${p.end} / ${p.standard} / ${p.scope === "consolidated" ? "連結" : "単体"}`
            : "該当区分なし"}
          <br />
          更新日：{stock.updatedAt ?? "データなし"}
        </p>
        <div className="stock-actions">
          <button
            className="secondary"
            onClick={() => compare(stock.id)}
            aria-pressed={compared.includes(stock.id)}
            disabled={!compared.includes(stock.id) && compared.length >= 5}
          >
            {compared.includes(stock.id) ? "比較から外す" : "比較に追加"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void watchStock(stock)}
            aria-pressed={watching}
          >
            {watching ? "★ ウォッチ解除" : "☆ ウォッチに追加"}
          </button>
        </div>
      </article>
    );
  }
  return (
    <section className="stock-workspace">
      <div className="eyebrow">RESEARCH, NOT RECOMMENDATIONS</div>
      <h1>銘柄を調べる</h1>
      <aside className="data-banner">
        <strong>
          {master
            ? "本人取込の銘柄マスター（サンプルとは別）"
            : dataset
              ? "ユーザー取込データ"
              : "サンプルデータ（架空企業・架空数値）"}
        </strong>
        <p>
          {master
            ? `${master.fileName} / マスター基準日：${master.asOfDate} / 最終更新日時：${new Date(master.importedAt).toLocaleString("ja-JP")}。財務は本人のv1取込データのみ紐付けます。架空サンプルの数値は使いません。`
            : dataset
              ? `${dataset.fileName} / 取込日時：${new Date(dataset.importedAt).toLocaleString("ja-JP")}。形式は検証済みですが、内容の正確性は保証しません。`
              : "実在企業とは無関係です。銘柄選択や投資判断に使用しないでください。"}
        </p>
        <p>投資推奨・売買は行いません。価格はリアルタイムではありません。</p>
      </aside>
      {error && (
        <div role="alert" className="error" ref={errorRef}>
          {error}
          <button className="text-button" onClick={() => void load()}>
            再読み込み
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">銘柄データを読み込んでいます…</p>
      ) : (
        <>
          <ImportPanel
            onImport={importStocks}
            onSample={restoreSample}
            busy={busy}
            hasMaster={!!master}
          />
          <div className="stock-tabs" role="group" aria-label="銘柄画面切替">
            {(
              [
                ["screen", "スクリーニング"],
                ["compare", `比較 (${compared.length}/5)`],
                ["watch", `ウォッチ (${watch.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                className="secondary"
                key={id}
                aria-pressed={tab === id && !detail}
                onClick={() => {
                  setTab(id);
                  setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {detail ? (
            <StockDetail
              stock={detail}
              backLabel={
                initialSelection && onBackToMaster
                  ? "← 銘柄一覧に戻る"
                  : undefined
              }
              basis={conditions.basis}
              onBack={() => {
                if (initialSelection && onBackToMaster) onBackToMaster();
                else setSelected(null);
              }}
            />
          ) : tab === "screen" ? (
            <>
              <ScreeningFilters
                stocks={stocks}
                value={conditions}
                onChange={setConditions}
              />
              <p className="result-count" role="status">
                該当 {rows.length}件 /{" "}
                {stocks.filter((s) => s.market === conditions.market).length}
                銘柄 · {basisLabel(conditions.basis)}
              </p>
              {rows.length === 0 ? (
                <section className="panel">
                  <h2>条件に一致する銘柄はありません</h2>
                  <p>
                    条件を緩めるか、データの市場・欠損・実績／予想区分を確認してください。
                  </p>
                </section>
              ) : (
                <div className="stock-results">
                  {rows.slice(resultPage * 50, (resultPage + 1) * 50).map(card)}
                </div>
              )}
              {rows.length > 50 && (
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={resultPage === 0}
                    onClick={() => setResultPage((p) => p - 1)}
                  >
                    前へ
                  </button>
                  <span>
                    {resultPage + 1} / {Math.ceil(rows.length / 50)}ページ
                  </span>
                  <button
                    className="secondary"
                    disabled={(resultPage + 1) * 50 >= rows.length}
                    onClick={() => setResultPage((p) => p + 1)}
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          ) : tab === "compare" ? (
            <StockComparison
              stocks={comparedStocks}
              basis={conditions.basis}
              onRemove={compare}
            />
          ) : (
            <section>
              <h2>ウォッチリスト</h2>
              <p className="storage-note">
                現在のデータにない登録も名前を残して表示します。保存先はこのブラウザのIndexedDBです。
              </p>
              {watch.length === 0 ? (
                <p className="panel">
                  登録はまだありません。一覧から気になる銘柄を追加してください。
                </p>
              ) : (
                watch.map((item) => {
                  const stock = stocks.find((s) => s.id === item.id);
                  return stock ? (
                    card(stock)
                  ) : (
                    <div className="panel" key={item.id}>
                      <h3>
                        {item.name} / {item.code}
                      </h3>
                      <p>現在のデータセットにはありません。</p>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void watchStock(item)}
                      >
                        ウォッチから削除
                      </button>
                    </div>
                  );
                })
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
