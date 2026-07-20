# 実装計画: オンボーディング機能(Issue #21)

> Status: **Draft(承認済み・実装前)** / 作成日: 2026-07-20
> 対象仕様: `docs/spec-issue21.md`
> チェックリスト: `tasks/todo.md`(= `docs/tasks-issue21.md`)

## 方針

- 新規 npm 依存・新規画像アセットは追加しない。サーバー(Cloud Functions)・Firestore ルールの変更もなし
- 既読フラグは `localStorage`(uid ごとキー)。Firestore への保存はしない
- 縦切り: 基盤(既読フラグ・スライド内容)→ UI コンポーネント → 配線(初回自動表示 → 設定画面からの再表示)、の順に完結させながら積む
- 各タスク終了時に該当テスト → `npm run lint` を通してから次へ進む。Task 4/5 は追加で `npm run build` も通す

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| 既読フラグは `localStorage`(uid ごとキー)、Firestore には保存しない | デバイス間同期不要な軽量機能。`BookProvider.tsx` の `storageKey` パターンを流用 |
| `OnboardingModal` は表示中かどうかを親が state で制御する制御されたコンポーネント | 自動表示(`Gate`)と手動再表示(`SettingsPage`)の両方から同じコンポーネントを再利用できる |
| スライド内容(`content.ts`)とページ送りロジック(`OnboardingModal.tsx`)を分離 | 内容変更時にロジックへ触れずに済む。テストも独立して検証できる |
| Analytics 呼び出しはコンポーネント外(呼び出し側)で行う | `onboarding_reopened` 等「どこから開いたか」に依存するイベントの責務を呼び出し側に置く |
| Escape・背景タップで閉じない(`ConfirmDialog` と挙動を変える) | 誤操作防止。フォーカストラップの実装は流用するが、キーハンドラ・背景 `onClick` は付けない |

詳細は `docs/plan-issue21.md` を参照(本ファイルはその写し)。実装が完了したら本ファイルおよび `tasks/todo.md` はそのまま「直近issueの写し」として維持し、次 Issue 着手時に上書きする(Issue #20 運用と同じ)。
