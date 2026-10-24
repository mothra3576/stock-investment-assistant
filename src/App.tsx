import { useEffect, useState } from "react";
import { lessons } from "./data/lessons";
import {
  completedIds,
  createAttemptId,
  progressRepository,
  type Attempt,
} from "./storage/progress";
import { Home } from "./components/Home";
import { Tools } from "./components/Tools";
import { LessonView } from "./components/LessonView";
type Page = "home" | "learn" | "history" | "tools";
export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    progressRepository
      .list()
      .then(setAttempts)
      .catch(() =>
        setError(
          "学習記録を読み込めませんでした。Safariの保存設定を確認して再読み込みしてください。",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const completed = completedIds(attempts);
  const lesson = lessons.find((l) => l.id === lessonId);
  function navigate(p: Page) {
    setPage(p);
    setLessonId(null);
    window.scrollTo(0, 0);
  }
  function openLesson(id: string) {
    setLessonId(id);
    setPage("learn");
    window.scrollTo(0, 0);
  }
  async function answer(correct: boolean) {
    if (!lesson) return false;
    const attempt: Attempt = {
      id: createAttemptId(),
      lessonId: lesson.id,
      correct,
      answeredAt: new Date().toISOString(),
    };
    try {
      await progressRepository.add(attempt);
      setAttempts((a) => [...a, attempt]);
      setError("");
      return true;
    } catch {
      setError(
        "記録を保存できませんでした。空き容量やSafariの保存設定を確認し、再度回答してください。",
      );
      return false;
    }
  }
  return (
    <>
      <header className="header">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-icon">芽</span>
          <span>
            まなぶ投資<small>一歩ずつ、未来のために。</small>
          </span>
        </button>
        <span className="local-badge">● この端末に保存</span>
      </header>
      <div className="layout">
        <nav aria-label="メインナビゲーション">
          {(
            [
              ["home", "⌂", "ホーム"],
              ["learn", "▤", "学習する"],
              ["history", "◷", "学習履歴"],
              ["tools", "◇", "投資ツール"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
          <div className="nav-note">
            まずは知識を、
            <br />
            そして自分のペースで。
          </div>
        </nav>
        <main id="main">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {loading ? (
            <p role="status">学習記録を読み込んでいます…</p>
          ) : lesson ? (
            <LessonView
              key={lesson.id}
              lesson={lesson}
              onAnswer={answer}
              onBack={() => navigate("learn")}
            />
          ) : (
            <>
              {page === "home" && (
                <Home
                  completed={completed}
                  onOpen={openLesson}
                  onLearn={() => navigate("learn")}
                />
              )}
              {page === "learn" && (
                <>
                  <div className="eyebrow">LEARNING PATH</div>
                  <h1>学習する</h1>
                  <p className="lead">
                    基礎からリスク管理へ。順番に学ぶのがおすすめです。
                  </p>
                  <div className="lesson-list">
                    {lessons.map((l, i) => (
                      <button
                        className="lesson-row"
                        key={l.id}
                        onClick={() => openLesson(l.id)}
                      >
                        <span className="lesson-number">0{i + 1}</span>
                        <span>
                          <small>
                            {l.category} · 約{l.minutes}分
                          </small>
                          <h2>{l.title}</h2>
                          <p>{l.intro}</p>
                          <strong>
                            {completed.has(l.id)
                              ? "✓ 完了・復習する"
                              : "未完了"}
                          </strong>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {page === "history" && (
                <>
                  <div className="eyebrow">YOUR LEARNING LOG</div>
                  <h1>学習履歴</h1>
                  <p className="lead">正解も間違いも、学びの足あとです。</p>
                  {attempts.length === 0 ? (
                    <section className="panel empty">
                      <h2>最初の一歩を記録しよう</h2>
                      <p>
                        クイズに回答すると、日時と結果がここに表示されます。
                      </p>
                      <button
                        className="primary"
                        onClick={() => navigate("learn")}
                      >
                        学習へ進む
                      </button>
                    </section>
                  ) : (
                    <ol className="history">
                      {[...attempts]
                        .sort((a, b) =>
                          b.answeredAt.localeCompare(a.answeredAt),
                        )
                        .map((a) => (
                          <li className="panel" key={a.id}>
                            <span
                              className={a.correct ? "result good" : "result"}
                            >
                              {a.correct ? "正解" : "要復習"}
                            </span>
                            <h2>
                              {lessons.find((l) => l.id === a.lessonId)
                                ?.title ?? "レッスン"}
                            </h2>
                            <time dateTime={a.answeredAt}>
                              {new Date(a.answeredAt).toLocaleString("ja-JP")}
                            </time>
                            <button
                              className="text-button"
                              onClick={() => openLesson(a.lessonId)}
                            >
                              復習する →
                            </button>
                          </li>
                        ))}
                    </ol>
                  )}
                </>
              )}
              {page === "tools" && <Tools />}
            </>
          )}
          <footer>
            まなぶ投資 ·
            学習を目的とした情報です。特定の金融商品の推奨や、個別の投資助言ではありません。
            <br />
            <a
              href="https://www.fsa.go.jp/policy/nisa2/"
              target="_blank"
              rel="noreferrer"
            >
              金融庁 NISA特設サイト ↗
            </a>
          </footer>
        </main>
      </div>
    </>
  );
}
