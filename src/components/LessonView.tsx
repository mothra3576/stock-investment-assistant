import { useEffect, useRef, useState } from "react";
import type { Lesson } from "../data/lessons";
export function LessonView({
  lesson,
  onAnswer,
  onBack,
}: {
  lesson: Lesson;
  onAnswer: (correct: boolean) => Promise<boolean>;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (saveError) actionsRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [saveError]);
  async function submit() {
    if (selected === null || saving) return;
    setSaving(true);
    const correct = selected === lesson.question.answer;
    try {
      if (await onAnswer(correct)) {
        setSaveError(false);
        setResult(correct);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="lesson">
      <button className="back" onClick={onBack}>
        ← 学習一覧へ
      </button>
      <div className="eyebrow">
        {lesson.category} · 約{lesson.minutes}分
      </div>
      <h1>{lesson.title}</h1>
      <p className="lead">{lesson.intro}</p>
      {lesson.sections.map((s) => (
        <section className="panel" key={s.title}>
          <h2>{s.title}</h2>
          <p>{s.text}</p>
        </section>
      ))}
      <section className="panel quiz" aria-labelledby="quiz-title">
        <div className="eyebrow">CHECK YOUR UNDERSTANDING</div>
        <h2 id="quiz-title">理解度チェック</h2>
        <fieldset disabled={saving || result !== null}>
          <legend>{lesson.question.prompt}</legend>
          {lesson.question.choices.map((c, i) => (
            <label
              className={selected === i ? "choice selected" : "choice"}
              key={c}
            >
              <input
                type="radio"
                name="answer"
                checked={selected === i}
                onChange={() => setSelected(i)}
              />
              {c}
            </label>
          ))}
        </fieldset>
        {result === null ? (
          <div className="quiz-actions" ref={actionsRef}>
            {saveError && (
              <div className="error" role="alert">
                <strong>回答を保存できませんでした。</strong>
                <p>
                  回答はまだ記録されていません。空き容量やSafariの保存設定を確認し、下の「回答して記録する」をもう一度押してください。選択した回答はそのまま再試行できます。
                </p>
              </div>
            )}
            <button
              className="primary"
              disabled={selected === null || saving}
              onClick={() => void submit()}
            >
              {saving ? "保存中…" : "回答して記録する"}
            </button>
          </div>
        ) : (
          <div role="status" className="feedback">
            <strong>
              {result ? "正解です！" : "もう一度、ポイントを確認しましょう"}
            </strong>
            <p>{lesson.question.explanation}</p>
            <button
              className="secondary"
              onClick={() => {
                setResult(null);
                setSelected(null);
              }}
            >
              もう一度解く
            </button>
          </div>
        )}
      </section>
    </article>
  );
}
