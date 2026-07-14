# Spec: カテゴリ内比較の表示改善(Issue #1)

> Status: **Draft(要レビュー)** / 作成日: 2026-07-14
>
> 対象 Issue: https://github.com/marusho-1266/BottomPriceBook_ad/issues/1
> 親仕様: `docs/spec.md`(Approved・画面構成 5「カテゴリ内比較」を本仕様で更新)
> 対象実装: `src/routes/ComparePage.tsx`, `src/features/prices/bottomPrice.ts`

## 前提(Issue 内容の確認)

Issue #1「カテゴリ内比較の表示」の要望は2点:

1. 店舗も表示するようにしたい
2. カテゴリ内で記録されているデータを順位で全て表示するように

## ヒアリング結果(2026-07-14)

| 論点 | 決定 |
|---|---|
| 「全て表示」の粒度 | **全価格記録を1行ずつ表示**(同一商品が複数回登場してよい)。商品ごとに1件へ集約する現行仕様(`rankByUnitPrice` → 商品ごとの底値のみ)を撤廃する |
| 底値の対象期間(N ヶ月)フィルタ | **適用する**。ホーム・商品詳細と同じ設定値(全期間/3/6/12ヶ月)でこの一覧もフィルタする |
| 特売記録の扱い | **含めて特売バッジ表示**。通常価格・特売価格を区別せず単価順に並べ、特売由来の行にバッジを付ける(ホーム画面と同じ表現) |
| 表示件数の上限 | **単価昇順の上位50件を表示**(ソート後に切り詰め、2026-07-14 レビューで決定)。50件を超える場合はリスト末尾に「他 N 件」の注記を表示する |
| 単価換算不能な記録の扱い | **除外せず末尾に表示**。`calcUnitPrice` が null を返す記録(単位不整合)は単価不明としてランキング末尾に回す(既存の孤児フォールバック方針と `rankByUnitPrice` の null 末尾ソートを踏襲) |
| 同一単価のタイブレーク | **記録日の新しい順**(新しい記録を上位に)。テスト可能な決定的順序とする |

## Objective

### 何を作るか

カテゴリ内比較画面(`ComparePage`)を、現行の「商品ごとの底値1件のみ」表示から
「カテゴリ内の全価格記録を単価順にランキング表示し、各行に店舗名も表示する」形に変更する。

### なぜ必要か

現行実装では商品の最安値(底値)しか出ないため、
「同じ商品でもどの店・いつの記録がどの順位か」「店舗込みでの比較」ができない。
Issue はこの2点の不足を指摘している。

### ユーザーストーリー

- 買い物客として、カテゴリを選んだときに、そのカテゴリの全価格記録を単価の安い順に
  一覧で見て、「どの商品をどの店で買うのが一番お得か」を把握したい
- 買い物客として、ランキングの各行でどの店舗の記録かがひと目でわかるようにしたい

## 現状分析(コード調査結果)

- `src/features/prices/bottomPrice.ts` の `rankByUnitPrice`(108-129行目)は、
  カテゴリ内の商品ごとに `bottomPrice()`(73-79行目 → 内部で `pickBottom`)を呼び、
  商品1件につき「その商品の底値記録1件」のみを返す。店舗名の結合も行っていない
- `ComparePage.tsx` は `usePriceRecords` と `rankByUnitPrice` のみを import し、
  `useStores`(`src/features/stores/api.ts` に既存)を呼んでいないため、
  店舗名がそもそも取得・表示されていない
- `PriceRecord` 型(`src/types/models.ts`)には既に `storeId` があるため、
  店舗名表示自体は `useStores()` との結合のみで対応可能(新規データモデル変更は不要)
- 「全記録を単価順」表示には、商品ごとに1件へ集約する現行ロジックとは別の
  新しい集計関数が必要(既存の `rankByUnitPrice` / `bottomPrice` / `pickBottom` は流用不可、
  置き換えまたは並存させる)
- `rankByUnitPrice` の利用箇所は `ComparePage.tsx` のみ(grep 確認済み・2026-07-14)。
  本変更で置き換え後は未使用となるため、**テストごと削除する**(Ask first 不要と確定)

## Tech Stack

変更なし。既存プロジェクトの構成に準拠(`docs/spec.md` の Tech Stack を参照)。
- React 19 + TypeScript + Vite / Tailwind CSS v4 / Cloud Firestore / Vitest

## Commands

既存と同じ(`docs/spec.md` の Commands を参照)。

```
テスト:        npm run test
テスト(監視): npm run test:watch
Lint:          npm run lint
ビルド:        npm run build
```

## Project Structure(変更対象)

```
src/
  features/
    prices/
      bottomPrice.ts     → 新規関数を追加(既存のrankByUnitPriceはテストごと削除)
  routes/
    ComparePage.tsx       → useStores 結合、全記録表示、特売バッジ、期間フィルタ表示に変更
tests/
  features/prices/bottomPrice.test.ts (相当)  → 新規関数のテストを追加
```

## データ設計

### 新しいランキング行の型(案)

```ts
// features/prices/bottomPrice.ts
export interface RankedRecord<P extends { id: string }, R extends PriceRecordInput> {
  product: P;
  record: R;                 // 個々の priceRecord(集約しない)
  unitPrice: number | null;  // 基準単位あたり単価(baseUnit換算後)。単位不整合時は null
}

/**
 * カテゴリ内の全価格記録を、対象期間でフィルタしたうえで
 * 基準単位あたり単価の昇順に並べて返す(商品への集約は行わない)。
 * 単価が null の行は末尾。同一単価は記録日の新しい順。
 */
export function rankAllRecordsByUnitPrice<P extends { id: string }, R extends PriceRecordInput>(
  productsInCategory: P[],
  records: R[],
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): RankedRecord<P, R>[]
```

- 型は既存の `PriceRecordInput` / `BottomPriceOptions`(`bottomPrice.ts` に定義済み)を流用する。
  新規の options 型は定義しない(`excludeSale` は未指定=特売を含める)
- 既存の `bottomWindowMonths` フィルタ(既存の `filterRecords` を流用)を適用
- 単価計算(kg→g, L→ml 換算含む)は既存の `calcUnitPrice` / 単位換算ロジックをそのまま流用
- `calcUnitPrice` が null を返す記録(単位不整合)は除外せず、**単価不明としてランキング末尾**に置く
  (既存 `rankByUnitPrice` の null 末尾ソートと同じ方針)
- ソート順: 単価昇順 → null は末尾 → 同一単価は記録日の新しい順(決定的な順序にする)
- 特売(`isSale`)の記録も対象に含める(除外しない)
- **上位50件への切り詰めはこの関数では行わない**(純粋なランキング関数のまま保つ)。
  切り詰めと「他 N 件」の算出は `ComparePage` 側で `slice(0, 50)` により行う
- 既存の `rankByUnitPrice`(商品ごと1件)は利用箇所が `ComparePage` のみと確認済みのため、
  置き換え後にテストごと削除する

### UI 表示行

各行に表示する情報:
- 順位(index)
- 商品名
- 店舗名(`useStores()` で解決。参照切れの場合は「(不明な店舗)」フォールバック
  ※ 既存の孤児フォールバック方針(`docs/spec.md` 187行目付近)を踏襲)
- 基準単位あたり単価(バー表示は既存踏襲。単価 null の行はバーなしで単価不明表示)
- 特売バッジ(`isSale === true` の行にのみ表示。既存のホーム画面の特売バッジと同じ見た目)
- 記録日(**必須**。同一商品・同一店舗の記録が複数行並ぶのが本仕様の前提のため、
  記録日がないと行を区別できない)

表示件数・その他:
- 表示は単価昇順の**上位50件**まで。50件を超える場合はリスト末尾に
  「他 N 件(上位50件を表示中)」の注記行を出す(N = 総件数 − 50)
- 実装注意: 現行の行キーは `row.product.id`(`ComparePage.tsx` 83行目)だが、
  全記録表示では商品IDが重複するため **`record.id` ベースのキー**に変更する
  (React の key 重複警告をテスト観点に含める)

## Code Style

既存の `docs/spec.md` の Code Style に準拠。

```tsx
// features/prices/bottomPrice.ts
/** カテゴリ内の全価格記録を単価昇順でランキングする(商品への集約なし) */
export function rankAllRecordsByUnitPrice<P extends { id: string }, R extends PriceRecordInput>(
  productsInCategory: P[],
  records: R[],
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): RankedRecord<P, R>[] {
  // ...
}
```

- Firestore アクセスは `features/*/api.ts` に集約(既存方針を継続。`ComparePage` から直接 SDK 呼び出し禁止)
- 集計ロジックは `features/prices/bottomPrice.ts` の純粋関数として実装し、UI から独立してテスト可能にする

## Testing Strategy

| レベル | 対象 | ツール |
|---|---|---|
| 単体 | `rankAllRecordsByUnitPrice`(期間フィルタ・特売含む・単位換算・複数記録の順序・単価 null の末尾配置・同一単価は記録日の新しい順) | Vitest |
| コンポーネント | `ComparePage` の表示(店舗名表示、特売バッジ、記録日表示、記録が0件のカテゴリの空表示、51件以上での上位50件切り詰めと「他 N 件」注記、行キー重複警告が出ないこと) | Vitest + React Testing Library |
| 手動確認 | 同一商品が複数店舗・複数回登場するカテゴリで、単価順に正しく並び、店舗名が表示されること | 手動(エミュレータ) |

- 既存のカバレッジ目標(`lib/` と `features/*/` は 80% 以上)を維持

## Boundaries

- **Always**
  - コミット前に `npm run lint` と `npm run test` を通す
  - 既存の底値算出ロジック(ホーム・商品詳細)には影響を与えない
    (`bottomPrice.ts` に新規関数を追加する形とし、既存関数の挙動は変更しない)
  - 店舗参照切れは既存方針どおり「(不明な店舗)」でフォールバックし、クラッシュさせない
  - 表示件数の上限は50件(仮想スクロール等は導入しない。意図的な割り切り)
- **Ask first**
  - `docs/spec.md` の画面構成・データモデル節の更新(本 Issue の変更を親仕様へ反映するタイミング)
- **Never**
  - 価格・単価の計算ロジック(単位換算含む)を独自に再実装する(既存の `calcUnitPrice` 等を再利用)
  - 失敗しているテストの無断削除・スキップ

## Success Criteria

- [ ] カテゴリ内比較画面で、カテゴリ内の**全価格記録**(商品ごとに集約されない)が
      基準単位あたり単価の昇順で一覧表示される
- [ ] 各行に**店舗名**と**記録日**が表示される(参照切れは「(不明な店舗)」)
- [ ] 設定の底値対象期間(全期間/3/6/12ヶ月)が一覧のフィルタに反映される
- [ ] 特売由来の記録には特売バッジが表示される
- [ ] 表示は上位50件まで。51件以上あるカテゴリでは末尾に「他 N 件」の注記が表示される
- [ ] 単位不整合で単価計算できない記録は消えずに、単価不明として末尾に表示される
- [ ] 内容量・単位が異なる記録(例: 240ml と 1.2L)が正しく単価換算されて順位に反映される
- [ ] 新規集計ロジックの単体テストが Vitest で通り、`npm run lint` / `npm run build` も通る

## Open Questions

なし(2026-07-14 ヒアリングおよびレビューで解消。表示上限50件・換算不能記録の末尾表示・
タイブレークは同日レビューで決定)

## 親仕様(docs/spec.md)への影響

- 画面構成 5「カテゴリ内比較」(201行目)の説明文を、本仕様の内容に沿って更新する必要がある
  (実装完了後、Ask first のうえで反映)
