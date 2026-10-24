// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { progressRepository } from "./storage/progress";
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
