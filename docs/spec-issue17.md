# Spec: Issue #17 スケール前提のコスト構造

> Status: **実装済み**(PWA プリキャッシュ: 491 entries / 8067 KiB → 19 entries / 4805 KiB に削減。全テスト・lint・build 通過) / 作成: 2026-07-20
> 対象 Issue: [#17 スケール前提のコスト構造](https://github.com/marusho-1266/BottomPriceBook_ad/issues/17)
> 親仕様: `docs/spec.md`

## Issue 本文

- priceRecords 全件購読(`src/features/prices/api.ts:49`)— 期間クエリ制限を。
- PWA プリキャッシュ約 8 MB(フォント)— Hosting 無料枠の最初のボトルネック。

## ヒアリング結果(2026-07-20 確定)

1. **priceRecords のクエリ最適化はページごとに要件が異なるため、画面ごとに最適なクエリへ分ける**方針を採用する。
   一律に `bottomWindowMonths` で絞ると以下が壊れるため:
   - `ProductDetailPage`(商品詳細)の「記録履歴」セクションは対象商品の**全期間**の記録を表示する仕様であり、
     期間で絞ると履歴が消える。
   - `StoresPage`(店舗管理)の削除可否判定(参照カウント、H-2)は**全期間**の記録を見て
     「1件でも参照があれば削除禁止」を判定する必要があり、期間で絞ると古い記録のみで
     使われている店舗を誤って削除できてしまう(データ不整合のリスク)。
2. **フォント最適化は不要な言語サブセットを import から除外する方式を採用する。**
   ランタイムキャッシュ化(workbox `runtimeCaching`)は行わない(設定の複雑化を避ける)。

## 前提(仮定 — 誤りがあれば指摘してください)

1. `PriceRecord.recordedAt` は Firestore `Timestamp` 型で保存されており、範囲クエリ(`where('recordedAt', '>=', ...)`)が可能(既存スキーマ通り)
2. `firestore.rules` の `priceRecords` の `list` 許可条件はクエリ形状に依存しない(book メンバーシップのみで判定)ため、
   クエリを絞ってもルール変更は不要
3. `useCollection`(`src/lib/firestoreHooks.ts`)の `useEffect` 依存は `[query]` であり、
   呼び出し側が `useMemo` で安定化した `query` の中身(`bookId` / `productId` / カットオフ等)が変わるたびに
   購読が再作成される。そのため `ProductDetailPage` で `productId`(ルートパラメータ)が
   同一マウント中に変化しても、新しい `productId` のクエリで正しく再購読される
4. `@fontsource/m-plus-rounded-1c` は太さ+サブセット別 CSS(例: `japanese-400.css` / `latin-400.css`)を提供しており、
   これらは個別 import 可能(既存パッケージ構成で確認済み)
5. アプリは日本語専用(`lang="ja"`)であり、UI 文言はすべて日本語 + 半角英数字(価格・記号)のみ。
   `latin-ext` / `cyrillic` / `cyrillic-ext` / `greek` / `greek-ext` / `vietnamese` サブセットの文字は使用しない
6. 現状使用しているフォントウェイトは 400(通常)/ 500(`font-medium`)/ 700(`font-bold`)/ 800(`font-extrabold`)の4種類のみ
   (`src` 全体を grep して確認済み。5種目以降・斜体は未使用)

## Objective

### 何を作るか

1. **priceRecords 購読のクエリ最適化**(`src/features/prices/api.ts`)
   - `HomePage` / `ComparePage` / `RecordPage`: 底値計算にしか使わないため、
     `book.bottomWindowMonths`(0 = 全期間)に基づき Firestore クエリ自体を
     `where('recordedAt', '>=', cutoff)` で絞り込む。ウィンドウ外の記録はダウンロードしない
   - `ProductDetailPage`: 現状「book 内の全 priceRecords を購読 → productId でクライアント側フィルタ」
     という最もコストの高い使い方をしている(1商品の詳細を見るために book 全体の記録を読む)。
     `where('productId', '==', productId)` に変更し、対象商品の記録だけを購読する。
     期間では絞らない(記録履歴は全期間表示のため)
   - `StoresPage`: 参照カウント(削除可否判定)は全期間・全商品の記録が必要なため、
     **現状の全件購読を維持**(本 Issue のスコープ外。将来的にカウンタ化 等での最適化が必要なら別 Issue)

2. **PWA プリキャッシュ削減**(`src/index.css`)
   - `@fontsource/m-plus-rounded-1c/{400,500,700,800}.css`(全言語サブセット込み)への import を、
     `japanese-{weight}.css` + `latin-{weight}.css` の組み合わせ(4ウェイト×2サブセット = 8 import)に変更
   - ビルド後の precache エントリ数・サイズが `npm run build` の PWA プラグイン出力ログで
     大幅に削減されていることを確認する(目安: 491 entries / 8067 KiB → 大幅減。実測は Success Criteria 参照)

### なぜ

- priceRecords は記録が蓄積するほど際限なく増える(スケールしないコスト構造)。特に `ProductDetailPage` は
  1商品を見るためだけに book 全体の記録を毎回ダウンロード・購読しており、記録数に比例して
  無駄な読み取り課金・帯域・レンダリング遅延が増える
- フォントの言語サブセットは Workbox の `globPatterns` がファイル内容(unicode-range)を見ずに
  拡張子だけでプリキャッシュ対象を決めるため、実際には一切使われない cyrillic / greek / vietnamese /
  latin-ext のサブセットまで Service Worker インストール時に強制ダウンロードされている。
  Firebase Hosting 無料枠(帯域)を早期に消費する最初のボトルネックになっている

## 対象外(Non-goals)

- `StoresPage` の参照カウントを全件購読以外の方式(カウンタフィールド化・per-store クエリ化等)に変更すること
- ランタイムキャッシュ(`workbox.runtimeCaching`)の導入
- フォントウェイトの削減(現状使用中の4ウェイトはそのまま維持)
- ページネーション・無限スクロール等、UI 側の表示件数制御

## 実装方針

### `src/features/prices/api.ts`

```ts
// windowStart は bottomPrice.ts からエクスポートして再利用
export function usePriceRecords(options?: { windowMonths: number; now: Date }) {
  const { bookId } = useBook();
  const cutoff = options ? windowStart(options.now, options.windowMonths) : null;
  const recordsQuery = useMemo(() => {
    const base = collection(db, 'books', bookId, 'priceRecords');
    return cutoff ? query(base, where('recordedAt', '>=', Timestamp.fromDate(cutoff))) : query(base);
  }, [bookId, cutoff?.getTime()]);
  return useCollection<PriceRecord>(recordsQuery);
}

export function useProductPriceRecords(productId: string | undefined) {
  const { bookId } = useBook();
  const recordsQuery = useMemo(
    () =>
      productId
        ? query(collection(db, 'books', bookId, 'priceRecords'), where('productId', '==', productId))
        : null,
    [bookId, productId],
  );
  return useCollection<PriceRecord>(recordsQuery);
}
```

- `windowStart(now, months)`: `months <= 0` なら `null`(絞り込みなし)。既存の `bottomPrice.ts` 内のロジックをそのまま export して共有する(ロジック重複を避ける)
- `StoresPage` は `usePriceRecords()`(引数なし = 全件)のまま変更しない

### 呼び出し側の変更

| ページ | Before | After |
|---|---|---|
| `HomePage` | `usePriceRecords()` | `usePriceRecords({ windowMonths, now })` |
| `ComparePage` | `usePriceRecords()` | `usePriceRecords({ windowMonths, now })` |
| `RecordPage` | `usePriceRecords()` | `usePriceRecords({ windowMonths, now })` |
| `ProductDetailPage` | `usePriceRecords()` + `records.filter(productId)` | `useProductPriceRecords(productId)`(フィルタ不要に) |
| `StoresPage` | `usePriceRecords()` | 変更なし |

`windowMonths` / `now` は既存どおり各ページで `book?.bottomWindowMonths ?? DEFAULT_BOTTOM_WINDOW_MONTHS` /
`useMemo(() => new Date(), [])` から計算し、フックへ渡す(計算方法自体は変更しない)。

### `src/index.css`

```css
@import '@fontsource/m-plus-rounded-1c/japanese-400.css';
@import '@fontsource/m-plus-rounded-1c/latin-400.css';
@import '@fontsource/m-plus-rounded-1c/japanese-500.css';
@import '@fontsource/m-plus-rounded-1c/latin-500.css';
@import '@fontsource/m-plus-rounded-1c/japanese-700.css';
@import '@fontsource/m-plus-rounded-1c/latin-700.css';
@import '@fontsource/m-plus-rounded-1c/japanese-800.css';
@import '@fontsource/m-plus-rounded-1c/latin-800.css';
```

## Tech Stack

React 19 / TypeScript / Vite / Firebase(Firestore, Auth) / vite-plugin-pwa / Vitest（既存踏襲、変更なし）

## Commands

```
Build: npm run build
Test:  npm test
Lint:  npm run lint
Dev:   npm run dev
```

## Project Structure(変更ファイルのみ)

```
src/features/prices/api.ts        → usePriceRecords に options 追加、useProductPriceRecords 新設
src/features/prices/bottomPrice.ts → windowStart を export
src/routes/HomePage.tsx           → usePriceRecords 呼び出し変更
src/routes/ComparePage.tsx        → usePriceRecords 呼び出し変更
src/routes/RecordPage.tsx         → usePriceRecords 呼び出し変更
src/routes/ProductDetailPage.tsx  → useProductPriceRecords に変更
src/index.css                     → フォント import をサブセット限定に変更
tests/features/prices/api.test.ts → 新規クエリ引数のテスト追加
tests/routes/*.test.tsx           → 既存モックの調整(必要な場合のみ)
```

## Testing Strategy

- 既存の Vitest 単体テストパターンを踏襲(`firebase/firestore` はモック、`query`/`where` の呼び出し引数を検証)
- `usePriceRecords({ windowMonths, now })` が `windowMonths <= 0` のとき `where` を呼ばない(全件)こと、
  `windowMonths > 0` のとき正しいカットオフで `where('recordedAt', '>=', ...)` を呼ぶことを検証
- `useProductPriceRecords` が `where('productId', '==', productId)` を呼ぶことを検証
- 各ページの既存テスト(`HomePage.test.tsx` 等)がモックしている `usePriceRecords` の呼び出しシグネチャ変更に追従
- フォント変更は自動テスト対象外。`npm run build` の PWA プラグイン出力(precache entries / size)を目視確認し、
  Success Criteria の数値で確認する

## Boundaries

- Always: 変更前後で `npm test` / `npm run lint` / `npm run build` を通す
- Ask first: `firestore.indexes.json` へのインデックス追加が必要になった場合(通常は単一フィールド範囲クエリのため不要のはず)
- Never: `StoresPage` の参照カウントロジックを不完全な期間絞り込みに変更しない(データ不整合防止)

## Success Criteria

1. `ProductDetailPage` は対象商品の記録のみを購読し、book 内の他商品の記録を読み込まない
   (テストで `where('productId', '==', ...)` が呼ばれることを確認)
2. `HomePage` / `ComparePage` / `RecordPage` は `bottomWindowMonths > 0` のとき、
   カットオフより前の記録を購読しない(テストで `where('recordedAt', '>=', ...)` を確認)
3. `bottomWindowMonths === 0`(全期間設定)のときは従来通り全件購読される(回帰なし)
4. `StoresPage` の店舗削除可否判定(参照カウント)は挙動が変わらない(既存テストが通る)
5. `npm run build` の PWA プラグイン出力で precache サイズが現状(491 entries / 約 8067 KiB)から明確に削減される
6. 既存の全テスト(`npm test`)・lint・build が通る

## Open Questions

なし(ヒアリングで解消済み)
