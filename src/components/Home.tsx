import { lessons } from "../data/lessons";
export function Home({
  completed,
  onOpen,
  onLearn,
}: {
  completed: Set<string>;
  onOpen: (id: string) => void;
  onLearn: () => void;
}) {
  const next = lessons.find((l) => !completed.has(l.id));
  return (
    <>
      <div className="eyebrow">YOUR INVESTMENT JOURNEY</div>
      <section className="hero">
        <div>
          <span className="pill">はじめての資産づくり</span>
          <h1>
            投資を知る。
            <br />
            未来の選択肢を育てる。
          </h1>
          <p>
            急がず、比べず、一歩ずつ。
            <br />
            お金を守る知識から、学びを始めましょう。
          </p>
          <button
            className="primary"
            onClick={() => onOpen(next?.id ?? lessons[0].id)}
          >
            {next ? "今日の学習を始める" : "学習を復習する"} <span>→</span>
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="growth">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span>小さな学びが、未来の力に。</span>
        </div>
      </section>
      <section className="progress-panel">
        <div>
          <span className="eyebrow">MY PROGRESS</span>
          <h2>あなたの学びの記録</h2>
        </div>
        <strong>
          {completed.size}
          <small> / {lessons.length} レッスン</small>
        </strong>
        <progress
          aria-label="学習の完了数"
          value={completed.size}
          max={lessons.length}
        />
        <p>クイズに正解するとレッスン完了。何度でも復習できます。</p>
      </section>
      <div className="section-heading">
        <h2>最初に学ぶこと</h2>
        <button className="text-button" onClick={() => onLearn()}>
          すべて見る →
        </button>
      </div>
      <div className="cards">
        {lessons.slice(0, 2).map((l, i) => (
          <button
            className="lesson-card"
            key={l.id}
            onClick={() => onOpen(l.id)}
          >
            <span className="lesson-number">0{i + 1}</span>
            <span className="eyebrow">
              {l.category} · 約{l.minutes}分
            </span>
            <h3>{l.title}</h3>
            <p>{l.intro}</p>
            <span className="card-link">
              {completed.has(l.id) ? "✓ 完了・復習する" : "学習を始める"} →
            </span>
          </button>
        ))}
      </div>
      <aside className="risk-note">
        <span aria-hidden="true">◎</span>
        <div>
          <strong>増やす前に、守ること。</strong>
          <p>
            投資には元本割れのリスクがあります。生活費と緊急資金を確保し、余裕資金で考えましょう。
          </p>
        </div>
      </aside>
    </>
  );
}
