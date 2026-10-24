// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import sample from "../../stocks/sample.json";
import { StockWorkspace } from "./StockWorkspace";
import { StockComparison } from "./StockComparison";
import { sampleStockProvider } from "../../stocks/provider";
import { analysisRepository } from "../../storage/analysis";
beforeEach(async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase("stock-investment-analysis");
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("検索・詳細・ウォッチ追加・再マウント復元・削除", async () => {
  const user = userEvent.setup();
  const view = render(<StockWorkspace />);
  await user.type(await screen.findByLabelText("証券コード・企業名"), "S001");
  expect(screen.getByText("該当 1件 / 8銘柄 · 実績")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "☆ ウォッチに追加" }));
  await user.click(await screen.findByRole("button", { name: "ウォッチ (1)" }));
  await user.click(screen.getByRole("button", { name: /架空あおば製作所 →/ }));
  expect(
    screen.getByRole("heading", { name: "財務指標と読み方" }),
  ).toBeTruthy();
  expect(screen.getByText(/株価・時価総額の出典/)).toBeTruthy();
  view.unmount();
  render(<StockWorkspace />);
  await user.click(await screen.findByRole("button", { name: "ウォッチ (1)" }));
  await user.click(screen.getByRole("button", { name: "★ ウォッチ解除" }));
  await screen.findByText(
    "登録はまだありません。一覧から気になる銘柄を追加してください。",
  );
  expect(await analysisRepository.listWatch()).toEqual([]);
});
it("5銘柄選択で追加を止め、比較表で個別の期間と出典を確認・解除", async () => {
  const user = userEvent.setup();
  render(<StockWorkspace />);
  await screen.findByLabelText("証券コード・企業名");
  for (let i = 0; i < 5; i++)
    await user.click(screen.getAllByRole("button", { name: "比較に追加" })[0]);
  expect(
    screen
      .getAllByRole("button", { name: "比較に追加" })
      .every((b) => (b as HTMLButtonElement).disabled),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "比較 (5/5)" }));
  const table = within(screen.getByRole("table"));
  expect(table.getByText("会計期間・区分")).toBeTruthy();
  expect(table.getByText("出典・更新日")).toBeTruthy();
  expect(table.getAllByRole("button", { name: /を比較から削除/ })).toHaveLength(
    5,
  );
  await user.click(table.getAllByRole("button", { name: /を比較から削除/ })[0]);
  expect(screen.getByRole("heading", { name: "銘柄比較（4/5）" })).toBeTruthy();
});
function file(text: string, name = "data.json") {
  const f = new File([text], name, { type: "application/json" });
  Object.defineProperty(f, "arrayBuffer", {
    value: async () => new TextEncoder().encode(text).buffer,
  });
  return f;
}
it("取込成功は永続化し、異常入力で既存データを置換しない", async () => {
  const user = userEvent.setup();
  const view = render(<StockWorkspace />);
  await screen.findByLabelText("証券コード・企業名");
  await user.click(
    screen.getByText("CSV / JSONを取り込む・見本をダウンロード"),
  );
  await user.upload(
    screen.getByLabelText("取込ファイル"),
    file(
      JSON.stringify([
        { ...sample[0], code: "TEST01", name: "架空インポート検証" },
      ]),
    ),
  );
  await user.click(screen.getByRole("button", { name: "検証して取り込む" }));
  await screen.findByText("1銘柄を取り込み、このブラウザに保存しました。");
  expect(screen.getByText("ユーザー取込データ")).toBeTruthy();
  await user.upload(
    screen.getByLabelText("取込ファイル"),
    file("[{}]", "invalid.json"),
  );
  await user.click(screen.getByRole("button", { name: "検証して取り込む" }));
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: /架空インポート検証 →/ }),
  ).toBeTruthy();
  expect((await analysisRepository.loadDataset())?.fileName).toBe("data.json");
  view.unmount();
  render(<StockWorkspace />);
  expect(
    await screen.findByRole("button", { name: /架空インポート検証 →/ }),
  ).toBeTruthy();
});
it("比較表は欠損を0に置き換えず、無配は0%表示", async () => {
  const stocks = await sampleStockProvider.load();
  render(
    <StockComparison
      stocks={[stocks[0], stocks[6]]}
      basis="actual"
      onRemove={() => {}}
    />,
  );
  expect(screen.getByText("0%")).toBeTruthy();
  expect(screen.getAllByText("—（欠損・算出不可）").length).toBeGreaterThan(0);
});
it("範囲の負数・小数入力、異常値、条件リセットと0件表示", async () => {
  const user = userEvent.setup();
  render(<StockWorkspace />);
  await screen.findByLabelText("証券コード・企業名");
  await user.click(screen.getByText("数値条件を設定する（すべてAND）"));
  const lower = screen.getByLabelText("営業利益率下限");
  await user.type(lower, "-0.5");
  expect((lower as HTMLInputElement).value).toBe("-0.5");
  expect(screen.getByText("該当 7件 / 8銘柄 · 実績")).toBeTruthy();
  await user.type(screen.getByLabelText("PER上限"), "oops");
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText("該当 0件 / 8銘柄 · 実績")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "条件をリセット" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect((lower as HTMLInputElement).value).toBe("");
  expect(screen.getByText("該当 8件 / 8銘柄 · 実績")).toBeTruthy();
});
it("ウォッチ保存失敗時は登録済みとせず、再試行して保存できる", async () => {
  const user = userEvent.setup();
  vi.spyOn(analysisRepository, "addWatch").mockRejectedValueOnce(
    new Error("quota"),
  );
  render(<StockWorkspace />);
  await screen.findByLabelText("証券コード・企業名");
  await user.click(
    screen.getAllByRole("button", { name: "☆ ウォッチに追加" })[0],
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "ウォッチ (0)" })).toBeTruthy();
  expect(await analysisRepository.listWatch()).toHaveLength(0);
  await user.click(
    screen.getAllByRole("button", { name: "☆ ウォッチに追加" })[0],
  );
  await screen.findByRole("button", { name: "ウォッチ (1)" });
  expect(await analysisRepository.listWatch()).toHaveLength(1);
});
it("取込データの保存失敗で既存のサンプルを維持", async () => {
  const user = userEvent.setup();
  vi.spyOn(analysisRepository, "saveDataset").mockRejectedValueOnce(
    new Error("quota"),
  );
  render(<StockWorkspace />);
  await screen.findByLabelText("証券コード・企業名");
  await user.click(
    screen.getByText("CSV / JSONを取り込む・見本をダウンロード"),
  );
  await user.upload(
    screen.getByLabelText("取込ファイル"),
    file(JSON.stringify([sample[0]])),
  );
  await user.click(screen.getByRole("button", { name: "検証して取り込む" }));
  await screen.findByRole("alert");
  expect(screen.getByText("サンプルデータ（架空企業・架空数値）")).toBeTruthy();
  expect(screen.getByText("該当 8件 / 8銘柄 · 実績")).toBeTruthy();
  expect(await analysisRepository.loadDataset()).toBeNull();
});
