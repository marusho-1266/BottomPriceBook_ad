# 実装計画: オンボーディング機能(Issue #21)

> Status: **Draft(承認済み・実装前)** / 作成日: 2026-07-20
> 対象仕様: `docs/spec-issue21.md`
> チェックリスト: `tasks/todo.md`(= `docs/tasks-issue21.md`)

## Context

現状アプリは開発者が身内に口頭で使い方を説明する前提でリリースされており、初見のユーザーには
価格記録・底値確認・カテゴリ内比較・共有という主要な使い方が伝わらない。初回ログイン直後に
スライド式のウォークスルー(4枚)を自動表示し、設定画面からいつでも再表示できるようにする
ことで、口頭説明なしでも最低限の使い方が伝わるようにする。

既存の同種実装(参考): `docs/plan-issue20.md`(CSV エクスポート)の縦切り・チェックポイント運用を踏襲

## 調査で確認した既存パターン

- **表示トリガー地点**: `src/App.tsx` の `Gate` コンポーネント。`bookReady`(book 初期化完了)
  になった時点で `<BookProvider>` 配下の `<Routes>` を描画している
- **localStorage の uid スコープ管理**: `src/features/books/BookProvider.tsx` の
  `storageKey(uid)` パターン
- **中央モーダルのオーバーレイ実装**: `src/components/ConfirmDialog.tsx`
  (`fixed inset-0` オーバーレイ + フォーカストラップ + Tab ループ)。
  本機能は仕様のとおり Escape・背景タップでは閉じない
- **Analytics イベント送信**: `src/lib/analytics.ts` の `trackEvent(name, params?)`
- **設定画面への項目追加**: `src/routes/SettingsPage.tsx` の `SettingsLink` パターン
  (今回はモーダルを開く操作なので `<button>` で同等の見た目にする)
- **テストのモック方法**: `tests/App.test.tsx`、`tests/routes/SettingsPage.test.tsx`

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| 既読フラグは `localStorage`(uid ごとキー)、Firestore には保存しない | デバイス間同期不要な軽量機能。`BookProvider.tsx` の既存パターンを流用 |
| `OnboardingModal` は表示中かどうかを親が state で制御する制御されたコンポーネント | 自動表示と手動再表示の両方から同じコンポーネントを再利用できる |
| スライド内容(`content.ts`)とページ送りロジック(`OnboardingModal.tsx`)を分離 | 内容変更時にロジックへ触れずに済む。テストも独立して検証できる |
| Analytics 呼び出しはコンポーネント外(呼び出し側)で行う | `onboarding_reopened` 等「どこから開いたか」に依存するイベントの責務を呼び出し側に置く |
| Escape・背景タップで閉じない(`ConfirmDialog` と挙動を変える) | 誤操作防止。フォーカストラップは流用するが、キーハンドラ・背景 `onClick` は付けない |

詳細タスクは `tasks/todo.md`(= `docs/tasks-issue21.md`)を参照。実装が完了したら
本ファイルおよび `tasks/todo.md` はそのまま「直近issueの写し」として維持し、
次 Issue 着手時に上書きする(Issue #20 運用と同じ)。
