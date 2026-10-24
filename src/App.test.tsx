// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { progressRepository } from "./storage/progress";
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("stock-investment-assistant");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("学習フロー", () => {
  it("不正解では未完了、再回答で完了し、再マウントしても履歴を復元する", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /今日の学習を始める/ }),
    );
    await user.click(screen.getByLabelText("来月の家賃"));
    await user.click(screen.getByRole("button", { name: "回答して記録する" }));
    await screen.findByText("もう一度、ポイントを確認しましょう");
    expect(
      (await progressRepository.list()).filter((a) => a.correct),
    ).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "もう一度解く" }));
    await user.click(screen.getByLabelText("生活費や緊急資金と分けた余裕資金"));
    await user.click(screen.getByRole("button", { name: "回答して記録する" }));
    await screen.findByText("正解です！");
    view.unmount();
    render(<App />);
    const progress = await screen.findByRole("progressbar");
    expect(progress.getAttribute("value")).toBe("1");
    await user.click(screen.getByRole("button", { name: /学習履歴/ }));
    expect(await screen.findByText("正解")).toBeTruthy();
    expect(screen.getByText("要復習")).toBeTruthy();
    expect(screen.getAllByRole("time")).toHaveLength(2);
  });
  it("保存失敗時は完了扱いにせず、エラーを表示して再試行できる", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(progressRepository, "list").mockResolvedValue([]);
    vi.spyOn(progressRepository, "add").mockRejectedValue(new Error("quota"));
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /今日の学習を始める/ }),
    );
    await user.click(screen.getByLabelText("生活費や緊急資金と分けた余裕資金"));
    await user.click(screen.getByRole("button", { name: "回答して記録する" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "回答して記録する",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(screen.queryByText("正解です！")).toBeNull();
  });
});

describe("レビュー指摘の回帰テスト", () => {
  it("クイズの回答ボタン付近で保存失敗を知らせ、選択を維持して再試行できる", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const add = vi
      .spyOn(progressRepository, "add")
      .mockRejectedValueOnce(new Error("quota"));
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /今日の学習を始める/ }),
    );
    await user.click(screen.getByLabelText("生活費や緊急資金と分けた余裕資金"));
    const quiz = within(screen.getByRole("region", { name: "理解度チェック" }));
    await user.click(quiz.getByRole("button", { name: "回答して記録する" }));
    const alert = await quiz.findByRole("alert");
    expect(alert.textContent).toContain("もう一度押してください");
    expect(
      alert.parentElement?.contains(
        quiz.getByRole("button", { name: "回答して記録する" }),
      ),
    ).toBe(true);
    expect(
      (
        quiz.getByLabelText(
          "生活費や緊急資金と分けた余裕資金",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(await progressRepository.list()).toHaveLength(0);
    await user.click(quiz.getByRole("button", { name: "回答して記録する" }));
    await quiz.findByText("正解です！");
    expect(quiz.queryByRole("alert")).toBeNull();
    expect(add).toHaveBeenCalledTimes(2);
    expect(await progressRepository.list()).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "ホーム" }),
    );
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1");
  });

  it("別タブ相当のIndexedDB保存を、表示状態への復帰で進捗と履歴に反映する", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    const user = userEvent.setup();
    render(<App />);
    expect((await screen.findByRole("progressbar")).getAttribute("value")).toBe(
      "0",
    );
    await progressRepository.add({
      id: "other-tab",
      lessonId: "risk",
      correct: true,
      answeredAt: "2026-10-24T01:00:00Z",
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() =>
      expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1"),
    );
    fireEvent(document, new Event("visibilitychange"));
    await user.click(
      screen.getByRole("button", { name: "学習履歴" }),
    );
    expect(await screen.findByText("大きな損失を避ける備え")).toBeTruthy();
    expect(screen.getAllByRole("time")).toHaveLength(1);
    expect(screen.getByRole("time").getAttribute("dateTime")).toBe(
      "2026-10-24T01:00:00Z",
    );
  });

  it("タブ復帰時の再取得失敗でも既存の進捗を残し、次回復帰で回復する", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await progressRepository.add({
      id: "existing",
      lessonId: "basics",
      correct: true,
      answeredAt: "2026-10-24T01:00:00Z",
    });
    const list = vi.spyOn(progressRepository, "list");
    const view = render(<App />);
    expect((await screen.findByRole("progressbar")).getAttribute("value")).toBe(
      "1",
    );
    list.mockRejectedValueOnce(new Error("read failure"));
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("alert");
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1");
    await progressRepository.add({
      id: "another-tab",
      lessonId: "risk",
      correct: true,
      answeredAt: "2026-10-24T02:00:00Z",
    });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() =>
      expect(screen.getByRole("progressbar").getAttribute("value")).toBe("2"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    view.unmount();
    const count = list.mock.calls.length;
    fireEvent(document, new Event("visibilitychange"));
    expect(list).toHaveBeenCalledTimes(count);
  });

  it("再取得が回答保存と競合しても、保存済みの回答や選択内容を失わない", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const list = vi.spyOn(progressRepository, "list");
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /今日の学習を始める/ }),
    );
    await user.click(screen.getByLabelText("生活費や緊急資金と分けた余裕資金"));
    let finishRead!: (
      records: Awaited<ReturnType<typeof progressRepository.list>>,
    ) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    fireEvent(document, new Event("visibilitychange"));
    expect(
      (
        screen.getByLabelText(
          "生活費や緊急資金と分けた余裕資金",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "回答して記録する" }));
    await screen.findByText("正解です！");
    await act(async () => {
      finishRead([]);
    });
    await user.click(
      screen.getByRole("button", { name: "ホーム" }),
    );
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1");
    fireEvent(document, new Event("visibilitychange"));
    await user.click(
      screen.getByRole("button", { name: "学習履歴" }),
    );
    expect(screen.getAllByRole("time")).toHaveLength(1);
  });
});
