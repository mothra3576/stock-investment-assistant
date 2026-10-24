import {
  calculateMetrics,
  formatValue,
  metricDefinitions,
  metricKeys,
  selectedPeriod,
} from "../../stocks/metrics";
import { basisLabel, type Basis, type Stock } from "../../stocks/types";
export function StockComparison({
  stocks,
  basis,
  onRemove,
}: {
  stocks: Stock[];
  basis: Basis;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="panel">
      <h2>銘柄比較（{stocks.length}/5）</h2>
      <p>
        数値の高低だけで優劣は決まりません。期間・通貨・会計基準の違いも確認してください。
      </p>
      <p className="storage-note">表は左右にスクロールできます。</p>
      {stocks.length === 0 ? (
        <p>一覧の「比較に追加」から最大5銘柄を選択してください。</p>
      ) : (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="銘柄比較表（横スクロール可能）"
        >
          <table className="comparison">
            <thead>
              <tr>
                <th>指標</th>
                {stocks.map((s) => (
                  <th key={s.id}>
                    {s.name}
                    <br />
                    {s.code} / {s.currency}
                    <br />
                    <button
                      className="text-button"
                      onClick={() => onRemove(s.id)}
                      aria-label={`${s.name}を比較から削除`}
                    >
                      比較から削除
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>株価・基準日</th>
                {stocks.map((s) => (
                  <td key={s.id}>
                    {formatValue(s.price, s.currency === "JPY" ? "円" : "USD")}
                    <br />
                    {s.priceDate}
                  </td>
                ))}
              </tr>
              <tr>
                <th>会計期間・区分</th>
                {stocks.map((s) => {
                  const p = selectedPeriod(s, basis);
                  return (
                    <td key={s.id}>
                      {basisLabel(basis)}
                      <br />
                      {p ? `${p.start}〜${p.end}` : "欠損"}
                      <br />
                      {p
                        ? `${p.standard} / ${p.scope === "consolidated" ? "連結" : "単体"}`
                        : ""}
                    </td>
                  );
                })}
              </tr>
              {metricKeys.map((k) => (
                <tr key={k}>
                  <th>{metricDefinitions[k].label}</th>
                  {stocks.map((s) => (
                    <td key={s.id}>
                      {formatValue(
                        calculateMetrics(s, basis)[k],
                        k === "marketCap"
                          ? `億${s.currency === "JPY" ? "円" : "USD"}`
                          : metricDefinitions[k].unit,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>出典・更新日</th>
                {stocks.map((s) => (
                  <td key={s.id}>
                    {s.quoteSource}
                    <br />
                    {selectedPeriod(s, basis)?.source ?? "財務データなし"}
                    <br />
                    {s.updatedAt}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
