# タスク分解: 買い切りライセンス（Issue #36 仕様・実装トラック）

> Status: **Done** / 作成日: 2026-07-24 / 承認: 2026-07-25 / 実装: 2026-07-25
> 対象: `docs/spec-issue36.md`（Approved）/ 計画: `docs/plan-issue36.md`（Approved）
> 運用: Issue #36 の実装フォロー（別 Issue なし）。1 タスク = 1 コミット相当。Verify を通してから次へ
> 凡例は `docs/tasks.md` と同じ（受け入れ / Verify / 依存 / 規模）。
> Stripe・lifetime の本番付与は含めない（#37）。手動/Emulator でミラーを `lifetime` にして検証する。
> 件数サーバー強制は本トラック外 → 末尾 **`I36-BACKLOG-1`**。
>
> **検証メモ（2026-07-25）**: `npm run test` / `lint` / `build` 成功。Microsoft OpenJDK 21 導入後、`npm run test:rules` **172 passed**。

---

## Phase 1: ドメイン基盤

- [x] **I36-T1: ライセンス型 + policy 純関数**
  - 内容: `LicenseStatus` / `UserLicense`、定数 `FREE_PRODUCT_LIMIT=20` / `FREE_STORE_LIMIT=3`、
    `resolveLicenseStatus` / `canAddProduct` / `canAddStore` / `canInvite` / `canExportCsv` /
    `remainingProductSlots` 等を `src/features/license/policy.ts` に追加し単体テストする
  - Acceptance: free は 20/3 未満のみ追加可、lifetime は常に可、欠落 license は free、
    超過時は追加不可でも「既存維持」前提（関数は件数のみ見る）
  - Verify: `npm run test -- tests/features/license/policy.test.ts` → `npm run lint`
  - Files: `src/types/models.ts`, `src/features/license/policy.ts`,
    `tests/features/license/policy.test.ts`
  - 依存: なし / 規模: S

- [x] **I36-T2: `users/{uid}` Rules + 本人 license 購読**
  - 内容: Firestore Rules に `users/{uid}` を追加（本人 get 可。list 不可。
    クライアントが `license.status` を `lifetime` にできない。初回 create は free のみ可）。
    `useUserLicense(uid)`（欠落/未作成 → free）を追加
  - Acceptance: Rules テストで他人 read 不可・lifetime 自己昇格不可。フックは欠落時 free
  - Verify: `npm run test:rules` && `npm run test` && `npm run lint`
  - Files: `firestore.rules`, `tests/rules/users.rules.test.ts`,
    `src/features/license/api.ts`
  - 依存: I36-T1 / 規模: M

- [x] **I36-T3: `Book.ownerLicenseStatus` ミラー + ensureBook**
  - 内容: `Book` 型に `ownerLicenseStatus?: 'free' | 'lifetime'` を追加。
    `ensureBook` の新規作成時に `ownerLicenseStatus: 'free'` を書く。
    既存 book の欠落はクライアントで free 扱い。book の keys 検証 Rules を整合
  - Acceptance: 新規 book にミラー free。既存 book でもアプリが free と解釈する
  - Verify: `npm run test` && `npm run test:rules` && `npm run lint`
  - Files: `src/types/models.ts`, `src/features/books/api.ts`, `firestore.rules`,
    `tests/rules/ensureBook.test.ts`, `tests/rules/fieldValidation3.rules.test.ts`
  - 依存: I36-T1 / 規模: M

### Checkpoint A
- [x] 純関数・users Rules・新規 book ミラー

---

## Phase 2: 実効ライセンス配線 + 招待

- [x] **I36-T4: `useBookOwnerLicense`（book ミラー → LicenseStatus）**
  - 内容: 現在の book の `ownerLicenseStatus` を返すフック。UI はこれを帳の実効ライセンス入力にする
  - Acceptance: ミラー欠落 → free、`lifetime` → lifetime。自分の license と取り違えない
  - Verify: `npm run test` && `npm run lint`
  - Files: `src/features/license/useBookOwnerLicense.ts`
  - 依存: I36-T3 / 規模: S

- [x] **I36-T5: 招待発行ガード（Rules + ShareSettings）**
  - 内容: `invites` create を `ownerLicenseStatus == 'lifetime'` のときのみ許可。
    `ShareSettings` は free 時発行不可 + CTA
  - Acceptance: free オーナーは UI/Rules とも発行不可。lifetime なら発行可
  - Verify: `npm run test:rules` && `npm run test` && `npm run lint`
  - Files: `firestore.rules`, `tests/rules/invites.rules.test.ts`,
    `tests/rules/sharingApi.rules.test.ts`, `src/features/sharing/ShareSettings.tsx`,
    `tests/features/sharing/ShareSettings.test.tsx`, `src/features/license/UpgradeCta.tsx`
  - 依存: I36-T4 / 規模: M

### Checkpoint B
- [x] free では招待不可（UI + Rules 確認済み）

---

## Phase 3: 無料枠 UX

- [x] **I36-T6: 商品追加ガード + 残り表示**
  - 内容: `RecordPage` の新規商品追加でガード・残り表示・CTA
  - Acceptance: free で 20 件到達後に新規商品不可。lifetime は制限なし
  - Verify: `npm run test` && `npm run lint`
  - Files: `src/routes/RecordPage.tsx`, `tests/routes/RecordPage.test.tsx`
  - 依存: I36-T4 / 規模: M

- [x] **I36-T7: 店舗追加ガード + 残り表示**
  - 内容: `StoresPage` および `RecordPage` の新規店舗追加に同様のガード（上限 3）
  - Acceptance: free で 3 件到達後に新規店舗不可
  - Verify: `npm run test` && `npm run lint`
  - Files: `src/features/stores/StoresPage.tsx`, `src/routes/RecordPage.tsx`, テスト
  - 依存: I36-T4 / 規模: S

- [x] **I36-T8: 設定 — ライセンス表示・使用数・CSV・CTA**
  - 内容: プラン表示、オーナー帳の使用数、CSV ガード、CTA
  - Acceptance: マトリクスどおり。共有帳でオーナー lifetime ならゲストも CSV 可
  - Verify: `npm run test` && `npm run lint`
  - Files: `src/routes/SettingsPage.tsx`, `tests/routes/SettingsPage.test.tsx`
  - 依存: I36-T2, I36-T4 / 規模: M

### Checkpoint C
- [x] コンポーネントテストで free/lifetime の主要ガードを確認

---

## Phase 4: 仕上げ

- [x] **I36-T9: 回帰・docs 反映**
  - 内容: 全ユニットテスト通過。docs Status 更新。Rules 実行は JDK 21 待ちと明記
  - Acceptance: `npm run test && npm run lint && npm run build` 成功
  - Verify: `npm run test && npm run test:rules && npm run lint && npm run build`
  - Files: `docs/plan-issue36.md`, `docs/tasks-issue36.md`, `docs/spec-issue36.md`
  - 依存: I36-T5〜T8 / 規模: S

### Checkpoint D
- [x] `npm run test && npm run lint && npm run build`
- [x] `npm run test:rules`（2026-07-25: 172 passed / JDK 21）

---

## 明示的に後続へ送るもの

| 項目 | 送り先 |
|---|---|
| Stripe・価格・Webhook・users/book の lifetime 同期更新 | #37 |
| プロモでの lifetime 付与 | #38 |
| 商品/店舗カウンタ + Rules 件数強制 | **`I36-BACKLOG-1`（下記）** |
| CTA → 実決済画面 | #37 |
| Rules エミュレータでの回帰実行 | 完了（2026-07-25） |

---

## バックログ（本トラック完了後に拾う）

> 意図的に後回し。実装トラック（I36-T1〜T9）には含めない。
> 拾うタイミング例: #37 公開前後のハードニング、悪用観測時、セキュリティパス。

- [ ] **I36-BACKLOG-1: 商品/店舗件数のサーバー強制（カウンタ + Rules）**
  - 背景: 本トラックはクライアントのみで 20/3 をガードする。Rules はサブコレクション件数を数えられないため、改変クライアントによる超過 create が残りうる
  - 方針:
    1. `books/{bookId}` に `productCount` / `storeCount`（int、欠落は 0 扱いまたは移行で埋める）を追加
    2. 商品/店舗の create・delete を **book カウンタ更新と同一バッチ**にする（既存 `rateLimits` と同型の強制パターンを踏襲）
    3. Rules: `ownerLicenseStatus == 'lifetime'`（欠落は free）なら件数不問。free なら create 時に `productCount < 20` / `storeCount < 3` を検証。カウンタ改ざん（+1/-1 以外・バッチ外更新）を拒否
    4. 既存帳: 一度だけ件数を集計してカウンタを埋める（Callable / 管理スクリプト / 初回読取時の修復のいずれか。実装時に選ぶ）
    5. クライアントの `canAddProduct` / `canAddStore` は残す（UX）。真実の上限は Rules
  - Acceptance:
    - free 帳で Emulator から直接 21 件目の product create が PERMISSION_DENIED
    - lifetime ミラーの帳は件数無制限で create 可
    - 削除後に枠が空き、再度 create 可
    - 既存超過帳（導入前データ）は仕様どおり「既存維持・新規のみ不可」（カウンタが 20 超でも create だけ拒否）
  - Verify: `npm run test:rules` && `npm run test` && `npm run lint`
  - Files（想定）: `src/types/models.ts`, `src/features/products/api.ts`,
    `src/features/stores/api.ts`, `firestore.rules`, Rules テスト,
    既存帳バックフィル用 script または Function
  - 依存: I36-T3（ミラー）、I36-T5〜T7（クライアントガード）が先にあると安全 / 規模: M〜L
  - トリガー: Ask first で Issue 化してから着手（本チェックを外すときは専用 Issue または PR 説明に本 ID を書く）
