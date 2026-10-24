import { useEffect, useState } from "react";
import { metricDefinitions, metricKeys } from "../../stocks/metrics";
import { defaultConditions, type ScreenConditions } from "../../stocks/screen";
import type { Stock } from "../../stocks/types";
export function ScreeningFilters({
  stocks,
  value,
  onChange,
}: {
  stocks: Stock[];
  value: ScreenConditions;
  onChange: (value: ScreenConditions) => void;
}) {
  const invalid = metricKeys.some((k) => {
    const r = value.ranges[k];
    return (
      r &&
      ((r.min !== undefined && !Number.isFinite(r.min)) ||
        (r.max !== undefined && !Number.isFinite(r.max)) ||
        (r.min !== undefined && r.max !== undefined && r.min > r.max))
    );
  });
  return (
    <section className="panel filters" aria-label="スクリーニング条件">
      <div className="filter-grid">
        <label>
          証券コード・企業名
          <input
            type="search"
            value={value.query}
            placeholder="例：S001、架空あおば"
            onChange={(e) => onChange({ ...value, query: e.target.value })}
          />
        </label>
        <label>
          市場・通貨
          <select
            value={value.market}
            onChange={(e) =>
              onChange({
                ...value,
                market: e.target.value as Stock["market"],
                sector: "",
                ranges: {},
              })
            }
          >
            <option value="JP">日本株 / JPY</option>
            <option value="US">米国株 / USD</option>
          </select>
        </label>
        <label>
          業種
          <select
            value={value.sector}
            onChange={(e) => onChange({ ...value, sector: e.target.value })}
          >
            <option value="">すべての業種</option>
            {[
              ...new Set(
                stocks
                  .filter((s) => s.market === value.market)
                  .map((s) => s.sector),
              ),
            ]
              .sort()
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
        </label>
        <label>
          財務データ
          <select
            value={value.basis}
            onChange={(e) =>
              onChange({
                ...value,
                basis: e.target.value as ScreenConditions["basis"],
              })
            }
          >
            <option value="actual">実績（最新通期）</option>
            <option value="forecast">予想（最新通期）</option>
          </select>
        </label>
      </div>
      <details>
        <summary>数値条件を設定する（すべてAND）</summary>
        <div className="filter-grid ranges">
          {metricKeys.map((key) => {
            const m = metricDefinitions[key];
            const unit =
              key === "marketCap"
                ? `億${value.market === "JP" ? "円" : "USD"}`
                : m.unit;
            return (
              <fieldset key={key}>
                <legend>
                  {m.label}（{unit}）
                </legend>
                {(["min", "max"] as const).map((bound) => (
                  <label key={bound}>
                    {bound === "min" ? "下限" : "上限"}
                    <RangeInput
                      label={`${m.label}${bound === "min" ? "下限" : "上限"}`}
                      value={value.ranges[key]?.[bound]}
                      onChange={(n) =>
                        onChange({
                          ...value,
                          ranges: {
                            ...value.ranges,
                            [key]: { ...value.ranges[key], [bound]: n },
                          },
                        })
                      }
                    />
                  </label>
                ))}
                {key === "per" && (
                  <label className="quick-range">
                    PER上限のクイック設定（0〜100倍）
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      aria-label="PER上限クイック設定"
                      value={
                        Number.isFinite(value.ranges.per?.max)
                          ? Math.min(100, Math.max(0, value.ranges.per!.max!))
                          : 100
                      }
                      onChange={(e) =>
                        onChange({
                          ...value,
                          ranges: {
                            ...value.ranges,
                            per: {
                              ...value.ranges.per,
                              max: Number(e.target.value),
                            },
                          },
                        })
                      }
                    />
                    <small>
                      現在：
                      {value.ranges.per?.max === undefined
                        ? "指定なし（操作すると適用）"
                        : `${value.ranges.per.max}倍`}
                      。範囲外や小数は上の数値欄で指定できます。
                    </small>
                  </label>
                )}
              </fieldset>
            );
          })}
        </div>
      </details>
      {invalid && (
        <p className="error" role="alert">
          数値を正しく入力し、下限が上限以下になるよう条件を修正してください（該当0件）。
        </p>
      )}
      <p className="storage-note">
        範囲の端を含みます。条件を指定した指標が欠損・算出不可なら除外します。未指定なら含めます。0は有効な値です。並べ替え時の欠損は常に最後です。
      </p>
      <div className="filter-grid">
        <label>
          並べ替え
          <select
            value={value.sort}
            onChange={(e) =>
              onChange({
                ...value,
                sort: e.target.value as ScreenConditions["sort"],
              })
            }
          >
            <option value="code">証券コード</option>
            {metricKeys.map((k) => (
              <option key={k} value={k}>
                {metricDefinitions[k].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          順序
          <select
            value={value.direction}
            onChange={(e) =>
              onChange({
                ...value,
                direction: e.target.value as "asc" | "desc",
              })
            }
          >
            <option value="asc">昇順</option>
            <option value="desc">降順</option>
          </select>
        </label>
      </div>
      <button
        className="secondary"
        onClick={() => onChange({ ...defaultConditions, ranges: {} })}
      >
        条件をリセット
      </button>
    </section>
  );
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setDraft((current) =>
      value === undefined
        ? ""
        : Number.isFinite(value) && Number(current) !== value
          ? String(value)
          : current,
    );
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={value !== undefined && !Number.isFinite(value)}
      value={draft}
      placeholder="指定なし"
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const clean = text.trim();
        const n =
          clean === ""
            ? undefined
            : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean)
              ? Number(clean)
              : NaN;
        onChange(n);
      }}
    />
  );
}
