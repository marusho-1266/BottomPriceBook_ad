# 実装計画: 買い切りライセンス（Issue #36 仕様に基づく実装トラック）

> Status: **Implemented** / 作成日: 2026-07-24 / 承認: 2026-07-25 / 実装: 2026-07-25
> 対象仕様: `docs/spec-issue36.md`（Approved）
> タスク分解: `docs/tasks-issue36.md`
> 注: Issue #36 は仕様承認に加え、本計画どおり **同じ Issue の実装フォロー**（I36-T1〜T9）まで進める。決済は #37
>
> **決定済み（2026-07-25）**
> - Open Q1: **ミラー方式採用**（`books.ownerLicenseStatus`）
> - 商品/店舗件数の **サーバー強制は本トラック対象外**。後続バックログ `I36-BACKLOG-1`（`tasks-issue36.md`）で拾う
> - 運用: **A. #36 実装フォローのまま進める**（別 Issue は切らない）

## 方針

- **判定ロジックを純粋関数で先に固める**（`resolveLicenseStatus` / `canAddProduct` 等）。UI・Rules はその結果に従う
- **帳の実効ライセンスは book 上のミラーで読む**（後述）。真理は `users/{uid}.license`、メンバー可読な判定材料は `books/{bookId}.ownerLicenseStatus`
- **Stripe・金額・Webhook・特商法は含めない**。lifetime への昇格 API は #37 / #38。本トラックでは CTA プレースホルダと free ガードまで
- **既存データ・既存共有を壊さない**。欠落フィールドはすべて free 扱い
- 各タスク終了時に `npm run test && npm run lint`（Rules 変更時は `npm run test:rules`）を通してから次へ

## スコープ境界（#37 との切り分け）

| 本トラック（本計画） | #37 以降 |
|---|---|
| `users/{uid}.license` 型・Rules（本人 read、lifetime 書込禁止） | Stripe Checkout / Webhook で `lifetime` 付与 |
| `books.ownerLicenseStatus` ミラー（作成時 `free`、欠落=free） | 購入成功時に users + 所有 book ミラーを更新 |
| クライアントの無料枠ガード・残り表示・CTA 枠 | CTA → 実決済・価格表示・特商法 |
| 招待 create を lifetime のみに Rules で制限 | プロモ（#38） |
| CSV / 商品追加 / 店舗追加 / 共有 UI のガード | — |

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| 真理: `users/{uid}.license` | 仕様どおり。アカウント単位・#37/#38 の昇格先 |
| 実効判定の読み取り: `books/{bookId}.ownerLicenseStatus: 'free' \| 'lifetime'` | メンバーは既に book を読める。`users/{ownerUid}` をメンバーに広く開けない。仕様 Open Q1 の推奨解 |
| 欠落ミラー / 欠落 license → `free` | 移行バッチ不要（仕様前提） |
| 商品・店舗の件数ガード（本トラック）は **クライアント優先** | Rules でサブコレクション件数を数えられない。サーバー強制は後回し → **`I36-BACKLOG-1`** |
| 招待発行は **Rules でも lifetime 必須** | UI 迂回を防ぐ最小のサーバー強制。ミラーを参照 |
| `ensureBook` で新規 book に `ownerLicenseStatus: 'free'` | 以後の帳は明示。既存帳は欠落=free |
| lifetime へのクライアント書込は不可 | 仕様 Never。テスト用に Emulator / 手動コンソールのみ |
| CTA は `#37` 接続用の disabled / 案内テキスト | 決済画面は作らない |

### Open Q1（確定: ミラー方式）

メンバーがオーナーの `users/{ownerUid}.license` を直接読まない。代わりに:

1. 仕様上の真理: `users/{uid}.license`
2. 帳メンバー向けの非秘密ミラー: `books/{bookId}.ownerLicenseStatus`
3. #37 の付与処理が両者を同期更新する（現状 `bookId === ownerUid` なら 1 book で足りる）

**#37 不変条件（必須）:** lifetime 付与・降格・プロモ適用時は、`users/{uid}.license` と、そのユーザーがオーナーの **全** `books/{bookId}.ownerLicenseStatus` を **同一バッチ（または同等のアトミック更新）で書く**。片方だけの成功を許さない。UI は accountLicense（自分のプラン表示）と ownerLicense（帳ゲート）を分けているため、ここがずれると矛盾表示になる。

### 商品・店舗件数のサーバー強制（後回し・拾い上げ用）

本トラックでは UI でブロックする。悪意あるクライアントは上限超過の create が可能な残差がある。

**後続で拾う場所:** `docs/tasks-issue36.md` の **`I36-BACKLOG-1`**（カウンタ + Rules）。
想定トリガー例: 課金公開前後のハードニング、悪用観測時、#37 完了後のセキュリティパス。

## 主要コンポーネントと依存

```
types (UserLicense, Book.ownerLicenseStatus)
    │
    ├── license/policy.ts（純関数・単体テスト）
    │
    ├── users API + firestore.rules(users)
    │       │
    │       └── ensureBook が ownerLicenseStatus: 'free' を付与
    │
    ├── useBookOwnerLicense（book ミラー → LicenseStatus）
    │
    ├── UI ガード
    │     ├── 商品追加（Products / Record の新規商品）
    │     ├── 店舗追加（Stores / Record の新規店舗）
    │     ├── ShareSettings（発行 + CTA）
    │     └── Settings（状態表示・使用数・CSV・CTA）
    │
    └── Rules: invites create が ownerLicenseStatus == 'lifetime'
```

## 実装順序（フェーズ）

### Phase 1: ドメイン基盤
1. I36-T1: 型 + `license/policy` 純関数 + テスト
2. I36-T2: `users/{uid}` Rules + 本人 license 購読（欠落=free）
3. I36-T3: `Book.ownerLicenseStatus` + `ensureBook` + Book 型更新

### Phase 2: 実効ライセンスの配線
4. I36-T4: `useBookOwnerLicense`（または同等）とポリシー接続
5. I36-T5: 招待 Rules（lifetime のみ発行）+ ShareSettings UI ガード

### Phase 3: 無料枠 UX
6. I36-T6: 商品追加ガード + 残り表示 + CTA
7. I36-T7: 店舗追加ガード + 残り表示 + CTA
8. I36-T8: 設定（ライセンス表示・使用数・CSV ガード・CTA）

### Phase 4: 仕上げ
9. I36-T9: 回帰・手動 3 パターン・docs Status 更新

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ミラーと `users.license` の不整合 | High | 真理は users。#37 で必ず両方更新。欠落は free で安全側 |
| 件数ガードがクライアントのみ | Med | 本トラックでは許容。拾い上げは `I36-BACKLOG-1` に手順付きで記載 |
| Record 画面のインライン商品/店舗追加を見落とす | Med | T6/T7 で RecordPage も対象に含める |
| 既存共有 + 未購入で招待だけ止まることの説明不足 | Low | ShareSettings の CTA コピーを仕様どおりに固定 |
| `users` 新設で Rules テスト肥大 | Med | 最小 Rules（get 本人、create/update で status 改ざん不可）から入れる |

## Verification Checkpoints

- **Checkpoint A（Phase 1）**: 純関数テスト green。users Rules テストで lifetime 自己付与不可。新規 book にミラー free
- **Checkpoint B（Phase 2）**: free オーナーは招待発行不可（UI + Rules）。lifetime ミラーなら発行可（Emulator でミラーを手書きして確認可）
- **Checkpoint C（Phase 3）**: 無料枠 20/3・CSV・設定表示がマトリクスどおり。既存超過は閲覧可・追加不可
- **Checkpoint D（Phase 4）**: `npm run test && npm run test:rules && npm run lint && npm run build`

## Out of Scope

- Stripe / 価格 / 特商法 / Webhook（#37）
- プロモコード（#38）
- サブスク・広告・App Store
- book 譲渡・複数オーナー帳 UI
- 既存招待の一括無効化
- 商品/店舗カウンタによる Rules 件数強制 → **本トラック外**（`I36-BACKLOG-1` で拾う）
- CTA 先の実決済画面

## 人間レビュー結果

1. Open Q1 ミラー → **採用済み（2026-07-25）**
2. 件数サーバー強制を本トラックに含めない → **後回し確定。`I36-BACKLOG-1`（2026-07-25）**
3. 運用 → **A. #36 実装フォローのまま進める**（別 Issue なし・2026-07-25）
