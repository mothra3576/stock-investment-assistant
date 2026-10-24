export function Tools() {
  return (
    <>
      <div className="eyebrow">LOOKING AHEAD</div>
      <h1>これからの投資ツール</h1>
      <p className="lead">学びを実践につなげる機能を、順次追加する予定です。</p>
      <div className="cards">
        {[
          ["ポートフォリオ管理", "保有資産の配分や集中リスクを見える化。"],
          ["通知", "振り返りや学習のタイミングをお知らせ。"],
          [
            "OneDrive同期",
            "Microsoft Graphを使い、個人用OneDriveへ記録を同期。",
          ],
        ].map(([title, description]) => (
          <section className="panel" key={title}>
            <span className="pill">今後追加予定</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </section>
        ))}
      </div>
      <p className="storage-note">
        現在はこのブラウザ内のIndexedDBに保存します。同期・通知・売買は行いません。ブラウザデータの削除や端末の変更で記録を失う可能性があります。
      </p>
    </>
  );
}
