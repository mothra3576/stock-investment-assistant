import { formatValue } from "../../stocks/metrics";
import type { FinancialPeriod } from "../../stocks/types";
export function FinancialChart({
  periods,
  currency,
}: {
  periods: FinancialPeriod[];
  currency: string;
}) {
  const rows = [...periods].sort((a, b) => a.end.localeCompare(b.end));
  if (rows.length < 2)
    return <p>比較可能な複数期データがないため、業績グラフは表示しません。</p>;
  const values = rows
    .flatMap((p) => [p.revenue, p.operatingProfit])
    .filter((v): v is number => v !== null);
  const min = Math.min(0, ...values) / 1e6,
    max = Math.max(1, ...values) / 1e6,
    span = max - min || 1;
  const x = (i: number) => 65 + (i * 450) / (rows.length - 1);
  const y = (v: number) => 160 - ((v / 1e6 - min) / span) * 135;
  return (
    <figure className="financial-chart">
      <figcaption>
        業績推移（単位：百万{currency === "JPY" ? "円" : "USD"}）<br />
        <span className="chart-revenue">● 売上高</span> /{" "}
        <span className="chart-profit">● 営業利益</span> ·
        同じ実績／予想区分・会計基準・連結区分のみ
      </figcaption>
      <svg
        viewBox="0 0 600 210"
        role="img"
        aria-label="通期売上高と営業利益の推移。正確な値は下の表を参照。"
      >
        <line x1="60" y1={y(0)} x2="530" y2={y(0)} stroke="#bac5b8" />
        <text x="0" y="20">
          {formatValue(max)}
        </text>
        <text x="0" y="164">
          {formatValue(min)}
        </text>
        {(["revenue", "operatingProfit"] as const).map((key, j) => (
          <g
            key={key}
            stroke={j ? "#a16b28" : "#276b56"}
            fill={j ? "#a16b28" : "#276b56"}
          >
            {rows.map((p, i) => {
              const value = p[key];
              return value === null ? null : (
                <g key={p.end}>
                  <circle cx={x(i)} cy={y(value)} r="4" />
                  {i > 0 && rows[i - 1][key] !== null && (
                    <line
                      x1={x(i - 1)}
                      y1={y(rows[i - 1][key]!)}
                      x2={x(i)}
                      y2={y(value)}
                      strokeWidth="2"
                    />
                  )}
                </g>
              );
            })}
          </g>
        ))}
        {rows.map((p, i) => (
          <text key={p.end} x={x(i)} y="195" textAnchor="middle">
            {p.end.slice(0, 7)}
          </text>
        ))}
      </svg>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="業績推移の数値"
      >
        <table>
          <thead>
            <tr>
              <th>会計期間</th>
              <th>売上高</th>
              <th>営業利益</th>
              <th>出典</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.end}>
                <th>
                  {p.start}〜{p.end}
                </th>
                <td>
                  {formatValue(p.revenue === null ? null : p.revenue / 1e6)}
                </td>
                <td>
                  {formatValue(
                    p.operatingProfit === null ? null : p.operatingProfit / 1e6,
                  )}
                </td>
                <td>{p.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
