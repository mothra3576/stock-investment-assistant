# まなぶ投資 — stock-investment-assistant

初心者がリスク管理を重視して段階的に学ぶ、日本語の株式投資学習Webアプリです。React + TypeScript + Viteを使用しています。売買・銘柄推奨・実際の金融口座接続は行いません。

## 実装済み機能

- ホーム：学習再開、完了数、おすすめレッスン
- 基礎 → リスク管理 → NISA → ETF → 個別株の5レッスン
- 各レッスンの理解度クイズ、解説、再回答
- IndexedDBへの回答履歴保存、正解したレッスンの完了表示、日時順の履歴
- 銘柄分析・ポートフォリオ・通知・OneDrive同期の予定画面（未実装と明示）
- iPhone向け下部ナビゲーション、セーフエリア、タッチ操作対応

## 開発

Node.js **22.12以上の22系、または24系**とnpmを使用してください（CIは22系）。

```sh
npm ci
npm run dev
```

表示されたURLをブラウザで開きます。GitHub Pagesのパスに合わせて、通常は `http://localhost:5173/stock-investment-assistant/` です。

```sh
npm test          # IndexedDB、完了判定、クイズ・履歴・保存失敗のテスト
npm run build    # TypeScript検査と本番ビルド → dist/
npm run preview  # 本番ビルドのローカル確認
```

キャッシュディレクトリへの書き込みが制限されるクラウド環境では、`npm ci --cache /tmp/stock-assistant-npm-cache` を使用できます。APIキーや環境変数は現在必要ありません。

## GitHubへの反映

```sh
git switch -c feat/initial-learning-app
git add .
git commit -m "株式投資学習アプリの初期版を実装"
git push -u origin feat/initial-learning-app
```

GitHubでPull Requestを作成し、確認後にmainへマージしてください。既存の作業ブランチがある場合はそのブランチを使用できます。

## GitHub Pagesで無料公開

1. GitHubリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。無料公開には通常、公開リポジトリを使用します。非公開リポジトリのPages利用可否はプランを確認してください。
2. mainへのpushでデプロイします。PRの作成・更新時はテスト・ビルドのみを実行し、公開しません。
3. ワークフローが依存導入・テスト・ビルドを行い、成功した `dist/` を公開します。
4. 公開先は `https://mothra3576.github.io/stock-investment-assistant/` です（実際のURLはActionsのdeploy結果で確認）。

`vite.config.ts` の `base` は `/stock-investment-assistant/` です。リポジトリ名を変更する場合は更新してください。画面遷移はReact内の状態で扱うため、Pagesに追加のルーティング設定は不要です。ワークフロー定義を追加しただけでは公開は完了しません。

## iPhone Safariでの確認

公開後、上記のGitHub Pages URLをSafariで開くのが簡単です。公開前はiPhoneとPCを同じ信頼できるWi-Fiに接続し、PCで `npm run dev` を実行して `http://PCのLAN-IP:5173/stock-investment-assistant/` にアクセスします。ファイアウォール設定が必要な場合があります。クラウド環境のlocalhostはiPhoneから直接開けません。

以下を確認してください。

1. 縦向き・横向きで横スクロールや下部ナビの重なりがない。
2. 学習を開き、不正解 → 解説 → 再回答 → 正解まで進められる。
3. ホームで完了数が増え、履歴に両方の回答が表示される。
4. リロード・タブの開き直し後も記録が残る。
5. 他レッスンや予定画面も下部ナビから操作できる。

JavaScriptのビルド対象はSafari 16以上です（`vite.config.ts`で明示）。Safari 15.4への対応は保証していません。iPhone Safari実機は未検証で、ビルド対象の指定だけで実機の動作を保証するものではありません。プライベートブラウズでは記録が終了時に消える場合があります。保存拒否・容量不足時は画面にエラーを表示します。

## 保存と拡張設計

```text
src/
  App.tsx                  画面遷移・ホーム・一覧・履歴・予定画面
  components/Home.tsx       ホーム・学習進捗
  components/LessonView.tsx 教材・クイズUI
  components/Tools.tsx      将来機能の案内
  data/lessons.ts           型付き教材・問題・解説
  storage/progress.ts       ProgressRepositoryとIndexedDB実装
  *.test.tsx / storage/*.test.ts 画面・保存テスト
  styles.css               レスポンシブデザイン
```

UIは `ProgressRepository` の `list` / `add` を通じて保存します。IndexedDBはDBバージョン1、`attempts`ストアにUUID、レッスンID、正誤、ISO日時を記録します。完了数は正解履歴から導出し、再回答で二重加算しません。別タブから戻って表示状態になったとき（`visibilitychange`）にIndexedDBを再取得して、進捗・履歴を更新します。常にIndexedDBを保存元とし、回答中の選択内容は維持します。保存失敗時はクイズの回答ボタン付近に再試行案内を表示します。

将来の個人用OneDrive同期は、このローカル保存層に同期サービスを組み合わせる設計です。Microsoft Graphの専用アダプタ、MSALによる認証（Authorization Code + PKCE）、必要最小限の権限、レコードIDによる重複排除・競合方針・データ形式のバージョン管理を別途実装します。現在はGraphへの通信や認証はありません。クライアントシークレットやアクセストークンをリポジトリに記載しないでください。

記録は端末・ブラウザ・オリジンごとに独立します。ブラウザデータの削除やストレージの自動削除で失われる可能性があり、現時点でバックアップ／同期機能はありません。ローカル開発とPagesの記録も共有されません。

教材は学習用の概要であり、投資助言ではありません。制度の最新情報や適用条件は[金融庁のNISA特設サイト](https://www.fsa.go.jp/policy/nisa2/)などの一次資料で確認してください。
