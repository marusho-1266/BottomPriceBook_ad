# 実装計画: メールアドレス確認とパスワードポリシー強化(Issue #15)

> Status: **Draft(レビュー待ち)** / 作成日: 2026-07-19
> 対象仕様: `docs/spec-issue15.md`
> タスク分解: `docs/tasks-issue15.md`(次フェーズで作成)

## 方針

- **rules の `email_verified` 強制を最初に入れ、ルールテストで固める**(fail fast)。
  クライアント UI はその制約の上に積む(未確認のまま Firestore に触れる経路を作らない)
- パスワードバリデーションは**純関数(`src/features/auth/password.ts`)として切り出し**、
  UI から独立に TDD する
- `Gate` の分岐は「loading → 未ログイン → **未確認** → book 準備 → アプリ」の順に固定。
  メール確認チェックは `ensureBook`(Firestore 書き込み)より必ず前
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| rules は共通ヘルパーに `email_verified` を集約 | 全コレクションで判定が一貫し、追加漏れを防ぐ。Google ユーザーは `email_verified = true` のため影響なし |
| 確認判定はクライアント(`user.emailVerified`)+ rules の二重 | クライアントは UX(確認待ち画面)、rules が実質の強制。片方だけでは不完全 |
| 「確認しました」で `reload()` + `getIdToken(true)` | `emailVerified` はサーバー側で立ってもクライアントの User と ID トークンには自動反映されないため、両方を明示的に更新する |
| パスワード検証は正規表現の純関数 + コンソール設定の二段 | クライアントは即時フィードバック、コンソール設定(8 文字・英小文字・数字)が REST 直叩きも含む最終防衛線 |
| 再送クールダウンは 60 秒のクライアントタイマー | `auth/too-many-requests` の発生を予防。サーバー側クォータはFirebase 任せ |
| VerifyEmailScreen は Gate 直下・BookProvider の外 | 未確認状態で book 関連の購読(Firestore read)を一切走らせないため |

## 主要コンポーネントと依存

```
firestore.rules(email_verified ヘルパー)+ tests/rules 全体更新
        │
        ▼
src/features/auth/password.ts(純関数・TDD)     ←─ 独立・並行可
        │
        ▼
src/features/auth/api.ts(signUpWithEmail 拡張 + resend/refresh 追加)
        │
        ▼
VerifyEmailScreen(再送・確認・ログアウト)
        │
        ▼
App.tsx Gate(emailVerified 分岐を ensureBook より前に挿入)
        │
        ▼
LoginScreen(登録時バリデーション + エラーメッセージ追加)
        │
        ▼
E2E(OOB コード踏破)+ ドキュメント + コンソール手動設定の手順化
```

## 実装順序(フェーズ)

### Phase 1: rules 強制(土台・高リスクを先に)

1. **firestore.rules に `email_verified` 検証を追加** — `request.auth != null` 判定を
   ヘルパーに集約し `request.auth.token.email_verified == true` を AND。
   既存ルールテストの認証トークンに `email_verified: true` を一括付与して回帰させ、
   `false` のトークンで deny される新規テストを追加

### Checkpoint 1
- `npm run test:rules` グリーン(既存全件 + 未確認 deny の新規ケース)

### Phase 2: 認証 API とバリデーション(UI 非依存・並行可)

2. **password.ts** — `validatePassword(password): string | null`(8 文字以上・
   英字・数字)。境界値 TDD(7/8 文字・英字のみ・数字のみ・全角混じり)
3. **auth/api.ts 拡張** — `signUpWithEmail` に `sendEmailVerification` を追加、
   `resendVerificationEmail()` / `refreshEmailVerification()`(reload +
   getIdToken(true) → boolean)を追加。`auth.languageCode = 'ja'` は
   `src/lib/firebase.ts` で設定

### Phase 3: UI

4. **VerifyEmailScreen** — 送信先表示・「確認しました」・「再送」(60 秒無効化)・
   「ログアウト」。コンポーネントテスト(タイマーは fake timers)
5. **Gate 分岐** — `user && !user.emailVerified` なら VerifyEmailScreen。
   確認済みになったら従来フロー(ensureBook → BookProvider)。Gate のテスト追加
6. **LoginScreen** — signup 時に password.ts で事前チェック、
   `auth/password-does-not-meet-requirements` / `auth/too-many-requests` の
   文言追加、`auth/weak-password` の文言を 8 文字基準に更新

### Checkpoint 2
- `npm run test` / `npm run test:rules` / `npm run lint` / `npm run build` グリーン

### Phase 4: E2E・ドキュメント・手動設定

7. **E2E** — エミュレータで 登録 → oobCodes 取得 → 確認リンク踏破 → refresh →
   Firestore アクセス可、および未確認のままの read/write deny を自動検証
8. **ドキュメント + 手動設定手順** — `docs/spec.md` 親仕様へ反映。README または
   spec-issue15 に本番反映チェックリスト(コンソールのパスワードポリシー設定・
   メールテンプレート日本語化・rules デプロイ)を記録

### Checkpoint: 完了
- Success Criteria 全項目にチェック(コンソール手動設定 2 件は本番反映時に人間が実施)

## リスクと緩和

| リスク | 影響 | 緩和 |
|---|---|---|
| rules 強制と ensureBook の順序ミスで新規登録が permission-denied | 高 | Gate の分岐順をテストで固定(未確認時に ensureBook が呼ばれないこと)。E2E でも新規登録フローを通す |
| 確認後もトークン未リフレッシュで deny が続く | 高 | `refreshEmailVerification` で reload + getIdToken(true) を必ずセットで実行。E2E で確認後のアクセス成功を検証 |
| 既存ルールテスト(84 件)の大量修正 | 中 | トークン生成をテストヘルパーに集約してから一括変更。回帰を Checkpoint 1 で確認 |
| Auth エミュレータがパスワードポリシー設定を再現できない | 中 | サーバー側強制はクライアント検証 + 本番コンソール設定で担保。エミュレータ E2E ではクライアント検証のみテスト |
| 既存未確認ユーザーの締め出しによる問い合わせ | 低 | 確認待ち画面に再送導線とログアウトを常備。対象は現状ほぼいない想定 |
| メールが迷惑メール行き | 低 | 画面に「迷惑メールフォルダをご確認ください」を明記 |

## 検証チェックポイント(要約)

| 時点 | 確認内容 |
|---|---|
| Phase 1 完了後 | 未確認トークン deny + 既存ルールテスト全件回帰 |
| Phase 2 完了後 | password.ts 境界値 + api 拡張の単体テストがグリーン |
| Phase 3 完了後 | Gate 分岐・VerifyEmailScreen・LoginScreen のコンポーネントテストがグリーン |
| 全体 | E2E(確認フロー完走・未確認 deny)+ 既存テスト回帰 + lint / build |

## 並行作業

- **Task 1(rules)と Task 2(password.ts)は完全に独立**して並行可
- Task 3(api 拡張)完了後、Task 4(VerifyEmailScreen)と Task 6(LoginScreen)は並行可
- Task 5(Gate)は Task 4 に依存。Task 7-8 は直列(実装完了が前提)

## Open Questions(spec から継続)

- Auth エミュレータのパスワードポリシー再現可否(Task 7 で検証、不可なら spec の代替方針どおり)
- 確認メールの action URL はデフォルトのまま(カスタムは将来スコープ)
