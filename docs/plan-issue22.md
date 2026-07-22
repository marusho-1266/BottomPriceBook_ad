# 実装計画: アカウント連携(メール → Google)(Issue #22)

> Status: **Draft(レビュー待ち)** / 作成日: 2026-07-22
> 対象仕様: `docs/spec-issue22.md`
> チェックリスト: `docs/tasks-issue22.md`

## 方針

- 新規 npm 依存なし。Firestore / Cloud Functions / セキュリティルール変更なし
- Firebase `linkWithPopup` で同一 `uid` に `google.com` を追加するのみ。マージ・データ移行は書かない
- 縦切り: プロバイダ判定・エラーマッピング(純粋) → `linkGoogleAccount` → UI セクション → 設定画面配線
- 各タスク終了時に該当テスト → `npm run lint` を通してから次へ。最終タスクで `npm run build` も通す

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| `linkGoogleAccount` / `hasGoogleProvider` / `hasPasswordProvider` / エラーマッピングは `src/features/auth/api.ts` | 既存の Google/メール認証 API と同じモジュール。ログイン画面の文言マッピングとも近い関心事 |
| UI は `src/features/auth/LinkGoogleSection.tsx` | 確認ダイアログ・エラー・`requires-recent-login` 時のパスワード再入力・連携済み表示を 1 コンポーネントに閉じる。`SettingsPage` は薄い配線のみ |
| `requires-recent-login` 時は既存 `reauthenticate(password)`(`features/account/api.ts`)を再利用 | 退会フローと同じ再認証経路。新規の再認証実装を増やさない |
| 連携成功後の UI 更新はコンポーネントのローカル状態(+ `linkWithPopup` の結果から Google メール表示) | `onAuthStateChanged` はプロバイダ追加だけでは発火しないことがある。AuthProvider 拡張は本 Issue では必須としない |
| 確認は既存 `ConfirmDialog` を使う | 退会以外の確認 UI と見た目・Esc 挙動を揃える。ダイアログ文言は「別メールの Google でも連携できる」説明のみ(選択先メールはポップアップ前に不明) |
| Analytics は成功時のみ `trackEvent('account_link_google')`(引数なし) | 仕様どおり PII なし。失敗イベントは必須としない |
| ログイン画面は変更しない | 未連携のまま Google サインインすると別アカウントになり得る仕様を維持。対策は設定からの事前連携 |

## 主要コンポーネントと依存

```
Task 1: auth/api.ts
        hasGoogleProvider / hasPasswordProvider / mapLinkGoogleError
      │
      ▼
Task 2: auth/api.ts
        linkGoogleAccount(+ trackEvent)
      │
      ▼
Task 3: LinkGoogleSection.tsx
        確認 → link → エラー / requires-recent-login 再認証 → 連携済み表示
      │
      ▼
Task 4: SettingsPage.tsx 配線
```

## 実装順序(フェーズ)

### Phase 1: Auth API 基盤

1. **Task 1: プロバイダ判定 + エラーマッピング(XS)**
   `hasGoogleProvider` / `hasPasswordProvider` と `mapLinkGoogleError`(仕様の code → 日本語)。
   - 受け入れ: providerData の有無で判定が正しい。衝突・キャンセル・要再認証・ネットワーク・その他の文言が仕様表どおり
   - 検証: `npm run test -- tests/features/auth/api.test.ts` → `npm run lint`
   - Files: `src/features/auth/api.ts`, `tests/features/auth/api.test.ts`

2. **Task 2: `linkGoogleAccount`(S)**
   `auth.currentUser` 必須。`linkWithPopup(user, new GoogleAuthProvider())`。
   成功時 `trackEvent('account_link_google')`。失敗は `mapLinkGoogleError` で throw(専用 Error クラスでも文字列でも可。UI が message を出せればよい)。
   - 受け入れ: 未ログインは reject。成功で `linkWithPopup` + Analytics。衝突 code がユーザー向け文言になる
   - 検証: 同上 + mock に `linkWithPopup` を追加
   - Files: 同上
   - 依存: Task 1

**✅ チェックポイント A**: `npm run test && npm run lint` green。Firestore/DOM 依存なし。

### Phase 2: UI

3. **Task 3: `LinkGoogleSection`(M)**
   - 表示: `hasPasswordProvider && !hasGoogleProvider` → 「Google アカウントを連携」ボタン
   - 連携済み(`hasGoogleProvider` またはローカル成功状態): ボタン非表示、代わりに「Google 連携済み」(メールがあれば表示。PII だがユーザー本人の画面表示であり Analytics には載せない)
   - パスワードのみ以外(Google のみ等): セクション自体を出さない
   - フロー: ボタン → `ConfirmDialog`(説明) → はい → `linkGoogleAccount`
   - `auth/requires-recent-login`: パスワード入力 UI を出し、`reauthenticate(password)` 後に再試行
   - その他エラー: `role="alert"` で表示
   - 受け入れ: 上記分岐のコンポーネントテスト。確認キャンセルで API 未呼び出し
   - 検証: `npm run test -- tests/features/auth/LinkGoogleSection.test.tsx` → `npm run lint`
   - Files: `src/features/auth/LinkGoogleSection.tsx`, `tests/features/auth/LinkGoogleSection.test.tsx`
   - 依存: Task 2

4. **Task 4: SettingsPage 配線(S)**
   ログアウトボタンの直前(または直上)に `<LinkGoogleSection />` を配置。
   - 受け入れ: SettingsPage テストでセクションがマウントされること(子はモック可)
   - 検証: `npm run test -- tests/routes/SettingsPage.test.tsx` →
     `npm run test && npm run lint && npm run build`
   - Files: `src/routes/SettingsPage.tsx`, `tests/routes/SettingsPage.test.tsx`
   - 依存: Task 3

**✅ 最終チェックポイント**:
- `npm run test && npm run lint && npm run build` 全 green
- 手動: メール登録ユーザーで連携 → ログアウト → Google ログインで同一底値帳。別メール Google 可。既使用 Google は衝突メッセージのみ
- `docs/spec-issue22.md` の Success Criteria を満たすこと
- 任意: 親仕様 `docs/spec.md` の将来スコープ近くに「メール→Google 連携(Issue #22)」を実装済み注記(実装完了時)

## 並行可能性

- Task 1→2→3→4 は直列依存。規模が小さいため並行不要

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| `linkWithPopup` 後に `onAuthStateChanged` が発火せず、設定画面が古いまま | 中 | `LinkGoogleSection` が成功時にローカルで連携済み表示へ切替。結果の `providerData` から Google メールを取る |
| `auth/requires-recent-login` | 中 | 既存 `reauthenticate` を再利用し、パスワード入力後に再試行 |
| Emulator で Google ポップアップが使いにくい | 中 | 単体は mock。手動確認は本番/テスト用 Google クライアントで実施 |
| `verbatimModuleSyntax` で型 import 漏れ | 低 | 最終タスクで `npm run build` |
| 退会ダイアログの `providerData[0]` 前提が「複数プロバイダ」後にズレる | 低 | 退会は本 Issue で変更しない。既に Google 連携済みなら先頭が google のこともあり得るが、既存ロジックのまま(Ask first で別 Issue) |

## Open Questions

なし
