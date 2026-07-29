# 実装計画: 設定に商品管理を追加(Issue #40)

> Status: **Implemented** / 作成日: 2026-07-29 / Approved: 2026-07-29 / 実装完了: 2026-07-29
> 対象仕様: `docs/spec-issue40.md`(Implemented)
> タスク分解: `docs/tasks-issue40.md`(Done)

## 方針

- **フォームと API を先にメモ対応**し、記録画面のその場登録を壊さないまま共通基盤を揃える
- **ProductsPage は CategoriesPage / StoresPage と同型**に作る(一覧 + 上部追加 + 行の編集/削除)
- **既存 API を配線**する(`updateProduct` / `deleteProductWithRecords` は新規ロジックを増やさない)
- 商品詳細はマスタ CRUD を持たず、**「商品情報を編集」リンクのみ**追加する
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| ルート `/settings/products` → `ProductsPage` | カテゴリ・店舗と同じ設定サブページ構成 |
| 編集 deep-link は `?edit=:productId` | 商品詳細からの導線で該当行をすぐ編集モードにできる。必須 UX |
| `ProductForm` に `note` を追加し登録/編集で共用 | T7 時点のフォームを拡張。記録画面も同じフォームを使う |
| `note` 空保存は空文字 `''` を書く | ルールの任意文字列に適合。`deleteField` は使わない(実装単純) |
| クライアント側メモ上限 500 文字 | `firestore.rules` の `isValidOptionalString(..., 500)` と揃える |
| 削除は既存 `deleteProductWithRecords` | H-2 / L-5 済み。再実装しない |
| PC 右ペインには商品編集導線を置かない | spec Out of Scope / Ask first。詳細→商品管理の二段で足りる |
| `docs/spec.md` と `docs/spec-issue32.md` は最終タスクで更新 | 実装と文言のずれを防ぐ |

## 主要コンポーネントと依存

```
ProductForm(+ note) ──┬── RecordPage(既存のその場登録・壊さない)
                      │
                      └── ProductsPage(新規)
                              ├── addProduct / updateProduct(+ note)
                              ├── deleteProductWithRecords
                              └── useProducts / useCategories

SettingsPage ──「商品管理」── /settings/products

ProductDetailPage ──「商品情報を編集」── /settings/products?edit=:id
```

## 実装順序(フェーズ)

### Phase A: 共通フォーム / API
1. **I40-T1**: `ProductForm` にメモ欄 + 500 文字制限。テスト更新
2. **I40-T2**: `addProduct` / `updateProduct` に `note` を配線

### Phase B: 商品管理画面
3. **I40-T3**: `ProductsPage`(一覧・登録・編集・削除) + ルート + 設定リンク
4. **I40-T4**: `?edit=` で該当行を編集モード起動 + 商品詳細からの導線

### Phase C: 仕上げ
5. **I40-T5**: 親仕様・Issue #32 仕様の整合更新 + 回帰確認

## 画面・操作の詳細(Plan 確定事項)

### ProductsPage

- `SubPageHeader title="商品管理" backTo="/settings"`
- 上部: 追加用 `ProductForm`(submitLabel: 「登録」)。成功後にフォームをリセット
  (`key` リセットまたは controlled なクリア。実装時に既存パターンへ合わせる)
- 一覧: 商品名 + カテゴリ名。メモがある行は1行要約または「メモあり」程度でよい
  (全文は編集フォームで確認)
- 行アクション: 「編集」「削除」(店舗管理と同文言)
- 編集中: 行内または行置換で `ProductForm`(initial + submitLabel: 「保存」)
- 削除 confirm 文言に商品名と「配下の価格記録も削除」を含める
- `?edit=:productId` があるとき、マウント時に該当商品を編集モードにする。
  存在しない ID なら無視(一覧のみ)

### ProductDetailPage

- ヘッダー直下または底値セクションより上に
  `Link to={`/settings/products?edit=${product.id}`}`「商品情報を編集」
- 履歴の「記録を編集」と離して配置し、混同を避ける

### RecordPage

- `ProductForm` の props 変更に追従するだけ。記録フローの UX 変更はしない
  (メモ欄が追加フォームに見えるのは spec 許容)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `ProductForm` 変更で記録画面の登録が壊れる | High | T1 でフォーム単体テストを先に緑化。RecordPage 既存テストを維持 |
| `note` 未対応の既存データで編集初期値が undefined | Low | `initial.note ?? ''` で扱う |
| 削除 confirm をスキップした実装 | Med | テストで confirm 同意時のみ API が呼ばれることを検証 |
| `?edit=` と一覧の編集 state が競合 | Low | マウント時に一度だけ `edit` を読んで state 初期化。保存/キャンセル後はクエリを消してもよい(任意) |
| Issue #32 文言更新を忘れる | Low | T5 を独立タスクにし、Success Criteria に含める |

## 検証チェックポイント

| タイミング | 確認 |
|---|---|
| T1–T2 完了後 | `ProductForm` / API 型が note 対応。既存 ProductForm・Record 系テスト緑 |
| T3 完了後 | 設定 → 商品管理で登録・編集・削除が手動でも通る |
| T4 完了後 | 商品詳細 → 商品管理で対象が編集モードになる |
| T5 完了後 | `npm run test && npm run lint`、docs 整合、記録のその場登録が健在 |

## Out of Scope

- 価格記録編集の項目拡充
- PC 右ペインへの商品編集導線
- 商品管理の検索・カテゴリ絞り込み・一括操作
- Firestore / Functions / ルール変更
- 新規 npm 依存

## 次のフェーズ

実装完了(I40-T1〜T5)。
