# Spec: ホーム・比較の内容量表示

> Status: **Implemented** / 作成日: 2026-08-04 / Approved: 2026-08-04 / 実装完了: 2026-08-04
> 実装計画: `docs/plan-quantity-on-lists.md` / タスク: `docs/tasks-quantity-on-lists.md`
>
> 対象: ホーム(モバイル / PC)およびカテゴリ内比較の商品行に、
> 価格記録の内容量(`quantity` + `unit`)を表示する。
> このドキュメントは spec-driven development の Phase 1 (Specify) 成果物。
> プロジェクト全体の仕様は `docs/spec.md`(Approved)を継承し、本機能固有の差分のみを記述する。

## 背景

価格記録時に内容量は必須入力だが、ホーム・比較の一覧では単価のみを見せており、
「その単価がどの内容量の記録から来たか」が一覧上で分からない。
商品詳細の履歴行では既に `店舗 · {quantity}{unit} · 日付` の形式で表示している。

## ASSUMPTIONS

訂正があれば Plan 前に指摘すること。

1. **表示元**: 各行が参照している価格記録の `quantity` + `unit`
   - ホーム: その商品の底値記録(`best.record`)
   - 比較: その行の記録(`row.record`)
2. **表記**: 商品詳細履歴と同じく `{quantity}{unit}`(スペースなし)。例: `240ml` / `1.2L` / `5kg`
3. **ホーム(モバイル)**: 副行を `店舗 · 内容量 · 単価` にする
   (現状: `店舗 · 単価`)
4. **ホーム(PC)**: テーブルに「内容量」列を追加する(底値と店舗の間)
5. **比較**: メタ行を `¥価格 · 内容量 · 店舗 · 日付` にする
   (現状: `¥価格 · 店舗 · 日付`)
6. **スコープ外**: 商品詳細ヒーロー / PC 右ペインヒーロー / 記録画面 / Firestore・API 変更 /
   商品名からの内容量推定・重複除去(商品名に「240ml」があっても記録側の内容量は出す)
7. **新規 npm 依存なし**。共通フォーマット用の小さなヘルパー追加は可
8. **親仕様・デザイン更新**: 承認後に `docs/spec.md` 画面構成と `docs/design.md` ホーム行説明を追随更新する

## Objective

### 何を作るか

ホームと比較の商品表示欄に、登録時の内容量を一覧で読めるようにする。

### 誰のためか

- 店頭・帰宅後に一覧を見て、底値/順位がどの内容量の記録かを確認したい買い物客

### ユーザーストーリー

- ホームで底値を見たとき、その価格が何 ml / kg 等の記録か分かる
- 比較ランキングで、内容量の違う記録が並んでいても各行の内容量が分かる

## Tech Stack

`docs/spec.md` を継承。変更は React 表示層のみ。

## Commands

```
開発:   npm run dev
テスト: npm run test
Lint:   npm run lint
ビルド: npm run build
```

## Project Structure(変更分)

```
src/routes/HomePage.tsx              → モバイル行に内容量を追加
src/components/PcHomeDashboard.tsx   → PC テーブルに内容量列を追加
src/routes/ComparePage.tsx           → 比較行メタに内容量を追加
src/lib/units.ts                     → (任意) formatQuantityLabel ヘルパー
tests/routes/HomePage.test.tsx       → 内容量表示の期待を追加
tests/routes/PcHomeDashboard.test.tsx
tests/routes/ComparePage.test.tsx
docs/spec.md / docs/design.md        → 画面説明の追随(承認後)
docs/spec-quantity-on-lists.md       → 本仕様
```

## Code Style

```tsx
/** 内容量ラベル。商品詳細履歴と同じ {quantity}{unit} */
export function formatQuantityLabel(quantity: number, unit: string): string {
  return `${quantity}${unit}`;
}

// ホーム副行
{storeName(best.record.storeId)} · {formatQuantityLabel(best.record.quantity, best.record.unit)} ·{' '}
{formatPricePerBase(best.unitPrice, category.baseUnit)}
```

- named export / 既存の `·` 区切りを維持
- UI 文言のラベル「内容量」は PC テーブル見出しのみ。モバイル・比較は値のみ

## Testing Strategy

| レベル | 対象 |
|---|---|
| コンポーネント | ホームに底値記録の内容量(例: `240ml`)が出る |
| コンポーネント | PC ホームに内容量列/値が表示される |
| コンポーネント | 比較各行にその記録の内容量が出る(例: `1.2L`) |
| 回帰 | 既存の店舗・単価・特売・順位の表示テストが緑のまま |

## Boundaries

- **Always**
  - コミット前に `npm run lint` と `npm run test` を通す
  - 表示元は価格記録の `quantity` / `unit`(商品マスタではない)
  - 商品詳細履歴と同じ表記 `{quantity}{unit}`
- **Ask first**
  - 表示位置・順序の大幅変更(例: 単価より前に内容量を大きく出す)
  - ヒーローや他画面への横展開
  - 新規 Issue 起票の要否
- **Never**
  - Firestore スキーマやセキュリティルール変更
  - 内容量未入力を許容するバリデーション緩和
  - 失敗テストの無断スキップ

## Success Criteria

- [x] ホーム(モバイル)の各商品行に、底値記録の内容量が出る
- [x] ホーム(PC)の各商品行に、底値記録の内容量が出る
- [x] 比較の各行に、その記録の内容量が出る
- [x] 表記が商品詳細履歴と同じ `{quantity}{unit}`
- [x] 関連テストがグリーン、`npm run lint` / `npm run test` が通る
- [x] `docs/spec.md` / `docs/design.md` の該当説明が更新されている

## Out of Scope

- 商品詳細ヒーロー / PC 右ペインへの内容量追加
- 記録画面・編集フォームの変更
- 内容量でのソートやフィルタ
- 商品名と内容量の重複抑制 UI

## Open Questions

なし。

## 次のフェーズ

Phase 1〜4 完了(2026-08-04)。
