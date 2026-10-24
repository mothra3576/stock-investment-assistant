import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  progressRepository,
  completedIds,
  createAttemptId,
  type Attempt,
} from "./progress";
import { lessons } from "../data/lessons";
describe("学習記録", () => {
  it("IndexedDBに正解・不正解を永続化し、同じIDの再保存を重複させない", async () => {
    const a: Attempt = {
      id: "test-1",
      lessonId: "basics",
      correct: false,
      answeredAt: "2026-10-24T00:00:00Z",
    };
    await progressRepository.add(a);
    expect(await progressRepository.list()).toContainEqual(a);
    const updated = { ...a, correct: true };
    await progressRepository.add(updated);
    const saved = await progressRepository.list();
    expect(saved.filter((x) => x.id === a.id)).toEqual([updated]);
  });
  it("正解したレッスンだけを完了とし、再回答しても件数を増やさない", () => {
    const make = (id: string, correct: boolean): Attempt => ({
      id: crypto.randomUUID(),
      lessonId: id,
      correct,
      answeredAt: new Date().toISOString(),
    });
    expect([
      ...completedIds([
        make("basics", true),
        make("basics", true),
        make("risk", false),
      ]),
    ]).toEqual(["basics"]);
  });
  it("全レッスンが有効な正解と解説を持つ", () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(5);
    for (const lesson of lessons) {
      expect(lesson.question.choices[lesson.question.answer]).toBeTruthy();
      expect(lesson.question.explanation.length).toBeGreaterThan(10);
    }
  });
});

it("LAN HTTPなどでrandomUUIDがない場合も重複しないUUIDを作る", () => {
  const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    const ids = Array.from({ length: 100 }, () => createAttemptId());
    expect(new Set(ids).size).toBe(100);
    expect(
      ids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        ),
      ),
    ).toBe(true);
  } finally {
    if (original) Object.defineProperty(crypto, "randomUUID", original);
    else delete (crypto as Partial<Crypto>).randomUUID;
  }
});
