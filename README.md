# TaskBox v0.1 — URL共有型タスクボード

Next.js + Supabase による、ログイン不要の共有タスク管理Webアプリです。

## 機能
- プロジェクトごとにランダムな個別共有URLを発行
- タスク・グループの作成、編集、削除、色変更
- PC向けドラッグ＆ドロップによる移動・並び替え
- 横並び、縦並び、グリッド、自由配置
- Supabase PostgreSQLへの永続保存、約3秒間隔の更新確認
- 更新競合時は409を返して上書きを防止

## セットアップ
1. Supabaseでプロジェクトを作り、SQL Editorで `supabase/schema.sql` を実行。
2. `.env.example` を `.env.local` にコピーし、Supabase Project URLとservice_roleキーを設定。
3. `npm install` と `npm run dev` を実行。
4. VercelにGitHubリポジトリをインポート。
5. Vercelに `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を環境変数として設定してデプロイ。
6. 2台の端末で同じ共有URLを開いて同期を確認。

## セキュリティと制限
- service_roleキーはサーバー環境変数のみ。GitHubやクライアントに公開しない。
- RLS有効、anonポリシーなし。共有URLを知っている人は全編集権限を持つ。
- URL失効・再発行、APIレート制限、監査ログ、バックアップは未実装。
- タスク登録数にUI上の固定上限はないが、APIのJSONサイズ制限などがある。
- 同期はWebSocketではなく3秒ポーリング。スマホのドラッグ操作は未検証。
- Supabase接続、Vercel公開、実機テストは未実施。

## 注意
公開前に権限・レート制限・削除復元の安全性を確認してください。
