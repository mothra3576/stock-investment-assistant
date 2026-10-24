import { useState } from "react";
import { readMasterFile } from "../../master/readFile";
import {
  makeDataset,
  previewMaster,
  validateV2,
} from "../../master/validation";
import {
  MAX_MASTER_BYTES,
  typeLabels,
  type ColumnMapping,
  type MasterDatasetV2,
  type MasterPreview,
  type MasterSheet,
  type SecurityType,
} from "../../master/types";
export function MasterImport({
  onSave,
  disabled = false,
}: {
  disabled?: boolean;
  onSave: (data: MasterDatasetV2) => Promise<string>;
}) {
  const [sheets, setSheets] = useState<MasterSheet[]>([]),
    [sheetIndex, setSheetIndex] = useState(0),
    [header, setHeader] = useState(0),
    [mapping, setMapping] = useState<ColumnMapping>({
      code: -1,
      name: -1,
      marketSegment: -1,
      sector: -1,
    }),
    [classes, setClasses] = useState<Record<string, SecurityType>>({}),
    [date, setDate] = useState(""),
    [fileName, setFileName] = useState(""),
    [preview, setPreview] = useState<MasterPreview | null>(null),
    [backup, setBackup] = useState<MasterDatasetV2 | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const isBusy = busy || disabled;
  const sheet = sheets[sheetIndex];
  const columns = sheet?.rows[header] ?? [];
  async function choose(file: File | undefined) {
    if (!file || isBusy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setSheets([]);
    setBackup(null);
    setPreview(null);
    setFileName(file.name);
    setMapping({ code: -1, name: -1, marketSegment: -1, sector: -1 });
    setClasses({});
    setDate("");
    setHeader(0);
    setSheetIndex(0);
    try {
      if (
        !file.size ||
        file.size >
          (file.name.toLowerCase().endsWith(".json")
            ? 32 * 1024 * 1024
            : MAX_MASTER_BYTES)
      )
        throw new Error(
          "Excel/CSVは8MB以下、v2 JSONは32MB以下の空でないファイルを選択してください。",
        );
      if (file.name.toLowerCase().endsWith(".json")) {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
        setBackup(validateV2(JSON.parse(text)));
      } else setSheets(await readMasterFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "読込に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  function changeMapping(key: keyof ColumnMapping, value: string) {
    setMapping((current) => ({
      ...current,
      [key]: value === "" ? undefined : Number(value),
    }));
    setPreview(null);
    if (key === "type") setClasses({});
  }
  async function save() {
    if (isBusy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = backup
        ? { ...backup, importedAt: new Date().toISOString() }
        : makeDataset(preview!, fileName, sheet.name);
      setMessage(await onSave(data));
      setPreview(null);
      setBackup(null);
      setSheets([]);
    } catch (e) {
      setError(
        `保存できませんでした。既存データは維持します。${e instanceof Error ? e.message : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  const typeValues =
    sheet && mapping.type !== undefined
      ? [
          ...new Set(
            sheet.rows
              .slice(header + 1)
              .map((row) => String(row[mapping.type!] ?? "").trim()),
          ),
        ].filter(Boolean)
      : [];
  return (
    <section className="panel master-import">
      <h2>銘柄マスターの手動取込</h2>
      <p>
        JPXへの自動アクセス・送信は行いません。.xlsx / UTF-8 CSV /
        マスターのバックアップv2
        JSONに対応します。旧.xlsは表計算アプリで変換してください。
      </p>
      <p className="storage-note">
        JPX実ファイルのヘッダー・シート構造は未検証です。自動の項目推定は行わず、下の実際の行表示を見て対応を指定します。公式ファイル・掲載ページの基準日も確認してください。
      </p>
      <p>
        <a
          href="https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"
          target="_blank"
          rel="noreferrer"
        >
          JPX公式の銘柄一覧ページを開く（本人が取得・条件を確認）
        </a>
      </p>
      <label>
        銘柄一覧ファイル
        <input
          type="file"
          accept=".xlsx,.csv,.json"
          disabled={isBusy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            void choose(file);
          }}
        />
      </label>
      {busy && <p role="status">読込・保存中…</p>}
      {sheet && (
        <>
          <div className="filter-grid">
            <label>
              シート
              <select
                aria-label="シート"
                value={sheetIndex}
                disabled={isBusy}
                onChange={(e) => {
                  setSheetIndex(Number(e.target.value));
                  setHeader(0);
                  setMapping({
                    code: -1,
                    name: -1,
                    marketSegment: -1,
                    sector: -1,
                  });
                  setClasses({});
                  setPreview(null);
                }}
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ヘッダー行
              <select
                aria-label="ヘッダー行"
                value={header}
                disabled={isBusy}
                onChange={(e) => {
                  setHeader(Number(e.target.value));
                  setMapping({
                    code: -1,
                    name: -1,
                    marketSegment: -1,
                    sector: -1,
                  });
                  setClasses({});
                  setPreview(null);
                }}
              >
                {sheet.rows.slice(0, 50).map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}行目
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="取込ファイルの行プレビュー"
          >
            <table>
              <caption>選択した行から最大5行（元の値）</caption>
              <tbody>
                {sheet.rows.slice(header, header + 5).map((row, i) => (
                  <tr key={i}>
                    <th>{header + i + 1}行</th>
                    {row.map((cell, j) => (
                      <td key={j}>
                        {cell instanceof Date
                          ? cell.toISOString().slice(0, 10)
                          : String(cell ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="filter-grid">
            {(
              [
                ["code", "証券コード列"],
                ["name", "企業名列"],
                ["marketSegment", "市場区分列"],
                ["sector", "業種列"],
                ["type", "商品区分の元列（任意）"],
                ["date", "基準日列（任意）"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={label}
                  disabled={isBusy}
                  value={
                    mapping[key] === undefined || mapping[key] === -1
                      ? ""
                      : mapping[key]
                  }
                  onChange={(e) => changeMapping(key, e.target.value)}
                >
                  <option value="">未指定</option>
                  {columns.map((cell, i) => (
                    <option key={i} value={i}>
                      {i + 1}列目：{String(cell ?? "（空欄）")}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label>
            基準日（列がない場合は必須。自動で今日の日付にしません）
            <input
              type="date"
              disabled={isBusy}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          {typeValues.length > 0 && (
            <fieldset className="classification">
              <legend>商品区分の対応（未設定は未分類）</legend>
              <p>
                市場区分の列も元列として選択できます。名前やコードからは推測しません。
              </p>
              {typeValues.slice(0, 50).map((raw) => (
                <label key={raw}>
                  {raw}
                  <select
                    disabled={isBusy}
                    aria-label={`商品区分:${raw}`}
                    value={classes[raw] ?? "unknown"}
                    onChange={(e) => {
                      setClasses((c) => ({
                        ...c,
                        [raw]: e.target.value as SecurityType,
                      }));
                      setPreview(null);
                    }}
                  >
                    {Object.entries(typeLabels).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {typeValues.length > 50 && (
                <p>
                  値が50種類を超えています。元列の選択を確認してください。表示外の値は未分類になります。
                </p>
              )}
            </fieldset>
          )}
          <button
            className="primary"
            disabled={isBusy}
            onClick={() => {
              setError("");
              setMessage("");
              setPreview(previewMaster(sheet, header, mapping, classes, date));
            }}
          >
            インポート前プレビューを作成
          </button>
        </>
      )}
      {preview && (
        <section
          className="import-preview"
          aria-label="インポート結果プレビュー"
        >
          <h3>プレビュー：{preview.records.length}銘柄</h3>
          <p>
            基準日：{preview.asOfDate ?? "未確認"} / 同一内容の重複：
            {preview.duplicates}行を統合 / 未分類：{preview.unclassified}銘柄 /
            エラー：{preview.errorCount}件
          </p>
          {preview.errorCount > 0 && (
            <div role="alert">
              <p>
                エラーがあるため保存できません。元ファイル・列の対応を修正してください。
              </p>
              <ul>
                {preview.errors.map((item, i) => (
                  <li key={i}>
                    {item.row ? `${item.row}行目：` : ""}
                    {item.message}
                  </li>
                ))}
              </ul>
              {preview.errorCount > preview.errors.length && (
                <p>エラーは先頭100件まで表示しています。</p>
              )}
            </div>
          )}
          <ul>
            {preview.records.slice(0, 5).map((record) => (
              <li key={record.id}>
                {record.code} / {record.name} / {record.marketSegment} /{" "}
                {record.sector} / {typeLabels[record.securityType]}
              </li>
            ))}
          </ul>
          <p>
            保存すると現在のマスター全体を置き換えます。古い基準日のファイルで上書きする場合も、この基準日を確認してください。ウォッチ・財務・学習記録は削除しません。
          </p>
          <button
            className="primary"
            disabled={
              isBusy || preview.errorCount > 0 || !preview.records.length
            }
            onClick={() => void save()}
          >
            この内容でマスターを保存
          </button>
        </section>
      )}
      {backup && (
        <section className="import-preview">
          <h3>v2バックアップ復元プレビュー</h3>
          <p>
            {backup.records.length}銘柄 / 基準日：{backup.asOfDate} /
            元ファイル：{backup.fileName}
          </p>
          <p>
            現在のマスターを置き換えます。ウォッチ・学習記録は変更しません。
          </p>
          <button
            className="primary"
            disabled={isBusy}
            onClick={() => void save()}
          >
            この内容でマスターを復元
          </button>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
