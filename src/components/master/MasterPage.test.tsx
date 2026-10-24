// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MasterPage } from "./MasterPage";
import { masterRepository } from "../../storage/master";
import { analysisRepository } from "../../storage/analysis";
import { progressRepository } from "../../storage/progress";
import type { MasterDatasetV2 } from "../../master/types";
import App from "../../App";
vi.mock("../../master/readFile", async () => {
  const { parseMasterWorkbook } = await import("../../master/files");
  return {
    readMasterFile: async (file: File) =>
      parseMasterWorkbook(await file.arrayBuffer(), file.name),
  };
});
const data = (count = 1): MasterDatasetV2 => ({
  version: 2,
  kind: "security-master",
  source: "user-file",
  asOfDate: "2026-09-30",
  dateOrigin: "manual",
  fileName: "artificial.csv",
  sheetName: "CSV",
  importedAt: "2026-10-24T00:00:00Z",
  records: Array.from({ length: count }, (_, i) => ({
    id: `JP:${1000 + i}`,
    code: String(1000 + i),
    name: `架空検証${i}`,
    marketSegment: i % 2 ? "市場乙" : "市場甲",
    sector: i % 2 ? "業種乙" : "業種甲",
    securityType: i % 2 ? "etf" : "ordinary",
  })),
});
beforeEach(async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  for (const db of [
    "stock-investment-master",
    "stock-investment-analysis",
    "stock-investment-assistant",
  ])
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.deleteDatabase(db);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function file(text: string, name = "artificial.csv") {
  const f = new File([text], name);
  Object.defineProperty(f, "arrayBuffer", {
    value: async () => new TextEncoder().encode(text).buffer,
  });
  return f;
}
const csv =
  "any-code,any-name,any-market,any-sector\n130A,架空取込検証,市場甲,業種甲\n0130,架空取込検証B,市場乙,業種乙";
async function mapFile(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("銘柄一覧ファイル"), file(csv));
  await screen.findByLabelText("証券コード列");
  for (const [label, index] of [
    ["証券コード列", "0"],
    ["企業名列", "1"],
    ["市場区分列", "2"],
    ["業種列", "3"],
  ])
    await user.selectOptions(screen.getByLabelText(label), index);
  await user.type(screen.getByLabelText(/基準日（列がない場合/), "2026-09-30");
  await user.click(
    screen.getByRole("button", { name: "インポート前プレビューを作成" }),
  );
}
it("インポートは列対応・件数プレビューの確認後にだけ保存する", async () => {
  const user = userEvent.setup();
  render(<MasterPage onOpen={() => {}} />);
  await screen.findByText("銘柄マスターは未登録です");
  await mapFile(user);
  expect(await masterRepository.load()).toBeNull();
  expect(
    screen.getByRole("heading", { name: "プレビュー：2銘柄" }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "この内容でマスターを保存" }),
  );
  await screen.findByText("銘柄マスターを保存しました。");
  expect((await masterRepository.load())?.records).toHaveLength(2);
  expect(screen.getByText("該当 2件 / 2銘柄")).toBeTruthy();
});
it("保存失敗時はプレビューを残し、旧一覧を破壊しない", async () => {
  await masterRepository.save(data());
  const original = await masterRepository.load();
  const user = userEvent.setup();
  render(<MasterPage onOpen={() => {}} />);
  await screen.findByText("保存済みマスター");
  await mapFile(user);
  vi.spyOn(masterRepository, "save").mockRejectedValueOnce(new Error("quota"));
  await user.click(
    screen.getByRole("button", { name: "この内容でマスターを保存" }),
  );
  await screen.findByRole("alert");
  expect(await masterRepository.load()).toEqual(original);
  expect(
    screen.getByRole("heading", { name: "プレビュー：2銘柄" }),
  ).toBeTruthy();
});
it("6000件を50件ずつ表示し、検索・市場・業種・商品区分で絞込", async () => {
  await masterRepository.save(data(6000));
  const user = userEvent.setup();
  render(<MasterPage onOpen={() => {}} />);
  await screen.findByText("該当 6,000件 / 6,000銘柄");
  expect(screen.getAllByRole("button", { name: /架空検証\d+ →/ })).toHaveLength(
    50,
  );
  await user.click(screen.getByRole("button", { name: "次の50件" }));
  expect(screen.getByRole("button", { name: "架空検証50 →" })).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("市場区分"), "市場乙");
  expect(screen.getByText("該当 3,000件 / 6,000銘柄")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("業種"), "業種乙");
  await user.selectOptions(screen.getByLabelText("商品区分"), "etf");
  await user.type(screen.getByLabelText("企業名・証券コード検索"), "6999");
  expect(screen.getByText("該当 1件 / 6,000銘柄")).toBeTruthy();
  await user.clear(screen.getByLabelText("企業名・証券コード検索"));
  await user.type(
    screen.getByLabelText("企業名・証券コード検索"),
    "存在しない",
  );
  expect(screen.getByText("条件に一致する銘柄はありません。")).toBeTruthy();
});
it("マスター削除後もウォッチと学習履歴は残り、v2から復元できる", async () => {
  await masterRepository.save(data());
  await progressRepository.add({
    id: "a",
    lessonId: "basics",
    correct: true,
    answeredAt: "2026-10-24T00:00:00Z",
  });
  const user = userEvent.setup();
  render(<MasterPage onOpen={() => {}} />);
  await screen.findByText("保存済みマスター");
  await user.click(screen.getByRole("button", { name: "☆ ウォッチに追加" }));
  await screen.findByRole("button", { name: "★ ウォッチ解除" });
  await user.click(
    screen.getByRole("button", { name: "保存済みマスターを削除" }),
  );
  await user.click(screen.getByRole("button", { name: "削除を確定" }));
  await screen.findByText("銘柄マスターは未登録です");
  expect(await analysisRepository.listWatch()).toHaveLength(1);
  expect(await progressRepository.list()).toHaveLength(1);
  await user.upload(
    screen.getByLabelText("銘柄一覧ファイル"),
    file(JSON.stringify(data()), "master.json"),
  );
  await screen.findByText("v2バックアップ復元プレビュー");
  await user.click(
    screen.getByRole("button", { name: "この内容でマスターを復元" }),
  );
  await screen.findByText("銘柄マスターを保存しました。");
  expect(await masterRepository.load()).not.toBeNull();
});
it("銘柄タップで既存分析画面へ移動し、財務なしはデータなしになる", async () => {
  await masterRepository.save(data());
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "銘柄一覧" }));
  await user.click(await screen.findByRole("button", { name: "架空検証0 →" }));
  await screen.findByRole("heading", { name: "財務指標と読み方" });
  expect(screen.getByRole("heading", { name: "株価 データなし" })).toBeTruthy();
  expect(
    within(screen.getByRole("main")).getAllByText("データなし").length,
  ).toBeGreaterThan(5);
  expect(screen.queryByText("サンプルデータ（架空企業・架空数値）")).toBeNull();
  await user.click(screen.getByRole("button", { name: "← 銘柄一覧に戻る" }));
  await screen.findByRole("heading", { name: "保存済みマスター" });
});
it("不正ファイル・v2を拒否し、列対応不備では保存ボタンを無効化", async () => {
  const user = userEvent.setup();
  render(<MasterPage onOpen={() => {}} />);
  await screen.findByText("銘柄マスターは未登録です");
  await user.upload(
    screen.getByLabelText("銘柄一覧ファイル"),
    file("{}", "bad.json"),
  );
  await screen.findByRole("alert");
  expect(await masterRepository.load()).toBeNull();
  await user.upload(screen.getByLabelText("銘柄一覧ファイル"), file(csv));
  await screen.findByLabelText("証券コード列");
  await user.click(
    screen.getByRole("button", { name: "インポート前プレビューを作成" }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "この内容でマスターを保存",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  expect(await masterRepository.load()).toBeNull();
});
