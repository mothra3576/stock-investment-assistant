import { useState } from "react";
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
  async function submit() {
    if (selected === null || saving) return;
    setSaving(true);
    const correct = selected === lesson.question.answer;
    try {
      if (await onAnswer(correct)) setResult(correct);
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
      <section className="panel quiz">
        <div className="eyebrow">CHECK YOUR UNDERSTANDING</div>
        <h2>理解度チェック</h2>
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
          <button
            className="primary"
            disabled={selected === null || saving}
            onClick={() => void submit()}
          >
            {saving ? "保存中…" : "回答して記録する"}
          </button>
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
