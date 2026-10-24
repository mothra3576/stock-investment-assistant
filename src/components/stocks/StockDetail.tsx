import {
  calculateMetrics,
  compatible,
  formatValue,
  metricDefinitions,
  metricKeys,
  selectedPeriod,
} from "../../stocks/metrics";
import { basisLabel, type Basis, type Stock } from "../../stocks/types";
import { FinancialChart } from "./FinancialChart";
export function StockDetail({
  stock,
  basis,
  onBack,
  backLabel = "← スクリーニングに戻る",
}: {
  stock: Stock;
  basis: Basis;
  onBack: () => void;
  backLabel?: string;
}) {
  const masterFormat = (v: number | null | undefined, unit = "") =>
    stock.masterAsOfDate && v == null ? "データなし" : formatValue(v, unit);
  const p = selectedPeriod(stock, basis),
    metrics = calculateMetrics(stock, basis),
    money = stock.currency === "JPY" ? "円" : "USD";
  return (
    <article>
      <button className="back" onClick={onBack}>
        {backLabel}
      </button>
      <h2>{stock.name}</h2>
      <p>
        {stock.market} / {stock.code} / {stock.sector}{" "}
        {stock.marketSegment && `/ ${stock.marketSegment}`}
      </p>
      {stock.masterAsOfDate && (
        <p className="storage-note">
          本人取込マスターの基準日：{stock.masterAsOfDate}
          。財務がない銘柄も表示します。
        </p>
      )}
      <section className="panel">
        <h3>株価 {masterFormat(stock.price, money)}</h3>
        <p>
          株価基準日：{stock.priceDate ?? "データなし"} / 更新日：
          {stock.updatedAt ?? "データなし"}
        </p>
        <p>株価・時価総額の出典：{stock.quoteSource || "データなし"}</p>
        <p>
          財務区分：<strong>{basisLabel(basis)}</strong> /{" "}
          {p
            ? `${p.start}〜${p.end}（通期） / ${p.standard} / ${p.scope === "consolidated" ? "連結" : "単体"}`
            : "対応する通期データなし"}
        </p>
        <p>財務データ出典：{p?.source ?? "—"}</p>
        <p className="storage-note">
          株価基準日と会計期間は別です。指標はこの基準日の株価と選択した区分の最新通期から算出します。異なる決算期の企業は単純比較できません。
        </p>
      </section>
      <section className="panel">
        <h3>財務指標と読み方</h3>
        <dl className="metrics-grid">
          {metricKeys.map((k) => (
            <div key={k}>
              <dt>{metricDefinitions[k].label}</dt>
              <dd>
                {masterFormat(
                  metrics[k],
                  k === "marketCap" ? `億${money}` : metricDefinitions[k].unit,
                )}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="metrics-grid">
          {(
            [
              ["売上高", p?.revenue],
              ["営業利益", p?.operatingProfit],
              ["純利益", p?.netIncome],
              ["平均自己資本", p?.averageEquity],
              ["期末自己資本", p?.equity],
              ["総資産", p?.totalAssets],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {masterFormat(
                  value == null ? null : value / 1e6,
                  `百万${money}`,
                )}
              </dd>
            </div>
          ))}
          {(
            [
              ["EPS（1株利益）", p?.eps],
              ["BPS（1株純資産）", p?.bps],
              ["年間1株配当", p?.dividendPerShare],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{masterFormat(value, money)}</dd>
            </div>
          ))}
        </dl>
        <details>
          <summary>算出方法・初心者向け解説</summary>
          {metricKeys.map((k) => (
            <div className="metric-help" key={k}>
              <h4>{metricDefinitions[k].label}</h4>
              <p>{metricDefinitions[k].formula}</p>
              <p>{metricDefinitions[k].help}</p>
            </div>
          ))}
          <p>
            EPS・BPS・年間配当・平均自己資本は入力元の値です。EPS・BPSには株式分割などの調整があり得るため、出典の定義を確認してください。未入力・分母が0以下・比較可能な前期がない場合は「—」と表示します。年率換算や異なる会計基準の補正は行いません。
          </p>
        </details>
      </section>
      <section className="panel">
        <h3>{basisLabel(basis)}の業績推移</h3>
        {p ? (
          <FinancialChart
            periods={stock.periods.filter((q) => compatible(p, q))}
            currency={stock.currency}
          />
        ) : (
          <p>該当区分のデータはありません。</p>
        )}
      </section>
    </article>
  );
}
