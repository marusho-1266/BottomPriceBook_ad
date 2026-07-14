# Spec: 記録時暫定順位の比較対象見直し(Issue #8)

> Status: **Approved・実装完了(2026-07-15)** / 作成日: 2026-07-15 / 最終更新: 2026-07-15
>
> 対象: GitHub Issue #8「価格入力時の暫定順位機能について」
> このドキュメントは spec-driven development の Phase 1 (Specify) 成果物。
> プロジェクト全体の仕様は `docs/spec.md`(Approved)を継承する。
> 本機能は `docs/spec-issue2.md`(Approved・実装完了)の暫定順位仕様を**一部改訂**する。

## 元 Issue

> 商品選択し、店舗を選び、価格・内容量を入力した時点で、同一カテゴリがあるにも関わらず
> 「カテゴリ内に比較できる記録がありません」と表示される

再現例(ヒアリング):

- カテゴリ A / 商品 a / 店舗 a の記録が 1 件ある状態で、
  カテゴリ A / 商品 a / 店舗 b を入力すると「比較できる記録がありません」となる
- ユーザー期待: 同一商品でも店舗が異なれば比較対象にし、暫定順位を出したい

## ASSUMPTIONS(確認済み / 本仕様で採用)

ヒアリング(2026-07-15)で以下を確認済み。訂正があれば実装前に指摘すること。

1. **保存は追加のまま(方針 A)**。同一商品・同一店舗の再入力でも既存レコードを更新しない。
   履歴は従来どおり残る(`docs/spec.md` の追加型モデル・商品詳細からの編集/削除を維持)
2. **「上書き」は暫定順位の計算上の扱いのみ**。同一商品・同一店舗の既存記録を
   比較母数から除外したうえで、入力中ドラフトの順位を出す
3. **店舗未選択の間は順位を表示しない**(確認済み: 選択肢 A)
4. 比較の粒度はカテゴリ内比較画面(`rankAllRecordsByUnitPrice`)に揃え、
   **価格記録 1 件 = 1 候補**とする(商品ごとの底値集約はやめる)
5. 同一商品・同一店舗に履歴が複数ある場合は、その組み合わせの**全既存記録**を除外する
6. 除外後に他の比較対象が 0 件なら、ドラフト単独として
   **暫定 1 位 / 1 件中**を表示する(「比較できる記録がありません」は出さない)
7. 対象期間(`bottomWindowMonths`)・特売込みは Issue #2 と同様
   (設定の期間フィルタを適用、`excludeSale` 未指定 = 特売込み)
8. 同順位は「ドラフト単価より厳密に安い候補数 + 1」(Issue #2 前提 8 を踏襲)
9. 変更範囲は `RecordPage` の暫定順位表示と `rankDraftInCategory`(およびそのテスト)に限定する

## Objective

### 何を作るか

価格記録画面の暫定順位を、カテゴリ内の**価格記録単位**で算出し直す。

- 同一商品・別店舗の記録は比較対象に含める
- 同一商品・同一店舗の既存記録は「上書き予定」として母数から除外する
- 店舗が選ばれるまで順位は出さない
- 保存動作・データモデルは変更しない(履歴は残る)

### 誰のためか

- 店頭で「この店のこの価格は、カテゴリ内の記録と比べて何位か」をその場で判断したい買い物客

### ユーザーストーリー

- 買い物客として、同じ商品でも別店舗の記録と比較した暫定順位を見たい
- 買い物客として、同じ商品・同じ店舗へ再入力するときは、その既存記録を除いた順位を見たい
- 買い物客として、店舗を選ぶ前に順位が出て混乱しないようにしたい

## Tech Stack / Commands

`docs/spec.md` を継承。新規依存パッケージは不要。

```
Dev:   npm run dev
Test:  npm run test
Lint:  npm run lint
Build: npm run build
```

## Project Structure

```
docs/spec-issue8.md                 → 本仕様(本ファイル)
docs/spec-issue2.md                 → 改訂対象の親機能仕様(差分は本ファイルが優先)
src/features/prices/bottomPrice.ts  → rankDraftInCategory の比較ロジック改訂
src/routes/RecordPage.tsx           → 店舗必須・表示文言・引数連携
tests/features/prices/bottomPrice.test.ts → 単体テスト改訂
tests/routes/RecordPage.test.tsx    → コンポーネントテスト改訂
```

## 現行仕様との差分(Issue #2 からの変更点)

| 項目 | Issue #2(現行実装) | 本 Issue(改訂後) |
|---|---|---|
| 比較粒度 | 他商品の底値(商品集約) | カテゴリ内の各価格記録 |
| 同一商品・別店舗 | 対象外(自商品は丸ごと除外) | **比較対象に含める** |
| 同一商品・同一店舗 | 対象外(自商品除外の副作用) | **既存を除外しドラフトで順位**(上書き扱い) |
| 店舗未選択 | 順位を表示する | **非表示** |
| 候補 0 件時 | 「比較できる記録がありません」 | **暫定 1 位 / 1 件中**(ドラフト単独) |
| 表示単位の文言 | `N 商品中` | `N 件中`(記録単位に合わせる) |
| 保存 | 追加 | **変更なし(追加のまま)** |

## ロジック仕様

### 関数: `rankDraftInCategory`(シグネチャ改訂)

入力:

- `productsInCategory`: 対象カテゴリの商品一覧(productId の所属判定に使用)
- `records`: book 内の価格記録
- `targetProductId` / `targetStoreId`: 入力中の商品・店舗
- `draft`: `{ price, quantity, unit }`
- `baseUnit` / `options`(`windowMonths` / `now` / 任意で `excludeSale`)

戻り値:

- `null` … 順位を出さない(下記の無効条件)
- `{ kind: 'ranked'; rank: number; total: number; reference?: DraftRankReference }` … 順位算出成功
  - `reference` … 候補が1件以上あるときのみ。候補中の最安記録(同単価は記録日新しい方)
  - `reference.displayRank` … ドラフトが1位なら `2`、それ以外なら `1`

※ `{ kind: 'noCandidates' }` は本改訂で**廃止**(単独時は 1/1 を返すため不要)

### 無効条件(`null` を返す)

次のいずれかなら順位計算しない:

1. `targetStoreId` が未設定(店舗未選択)
2. `draft.price <= 0` または内容量・単位が換算不能(`calcUnitPrice` が null)
3. 対象商品がカテゴリに属さない等、呼び出し側で前提を満たさない場合

### 処理

1. ドラフト単価 `draftUnitPrice` を算出。不能なら `null`
2. 候補記録を次でフィルタする:
   - `productId` が `productsInCategory` に含まれる
   - `options` の期間・特売フィルタを満たす(`filterRecords` 相当)
   - 単価が算出可能(`calcUnitPrice` が non-null)。不能な記録は母数から除外
   - **`productId === targetProductId` かつ `storeId === targetStoreId` の記録は除外**(上書き扱い)
3. `cheaperCount` = ドラフト単価より**厳密に安い**候補の数
4. `rank = cheaperCount + 1`
5. `total = 候補数 + 1`(ドラフト自身を含む)
6. 候補 0 件なら `{ kind: 'ranked', rank: 1, total: 1 }`

### 具体例

**例 1 — 同一商品・別店舗(Issue #8 の再現ケース)**

- 既存: 商品 a / 店舗 a / 単価 1.0
- 入力: 商品 a / 店舗 b / 単価 0.8
- 結果: 店舗 a の記録は候補 → 暫定 **1 位 / 2 件中**

**例 2 — 同一商品・同一店舗(上書き扱い)**

- 既存: 商品 a / 店舗 a / 単価 1.0(現状 n 位相当)
- 入力: 商品 a / 店舗 a / 単価 2.0
- 結果: 既存の a×店舗 a を除外。他に候補が無ければ **1 位 / 1 件中**

**例 3 — 同一商品・同一店舗 + 別店舗の記録あり**

- 既存: a×店舗 a(1.0)、a×店舗 b(0.5)、商品 x×店舗 c(0.8)
- 入力: a×店舗 a / 単価 0.7
- 結果: a×店舗 a のみ除外。候補は 0.5 と 0.8 → 暫定 **2 位 / 3 件中**

**例 4 — 店舗未選択**

- 商品・価格・内容量が揃っていても順位は**非表示**(`null`)

## UI 仕様(RecordPage)

- 表示条件: 商品・**店舗**・価格・内容量が揃い、単位換算可能で `kind: 'ranked'` のとき
- 文言: `このカテゴリで暫定 {rank} 位 / {total} 件中`
- 比較行(候補が1件以上あるときのみ):
  - ドラフトが2位以下 → `1位: {商品名} / {店舗名} / {単価}`
  - ドラフトが1位 → `2位: {商品名} / {店舗名} / {単価}`
  - 単価は `formatPricePerBase`(基準単位あたり)。比較対象は候補中の最安記録
    (同単価なら記録日の新しい方)
  - 候補0件(`1位 / 1件中`)のときは比較行を出さない
- 「カテゴリ内に比較できる記録がありません」は本改訂後は**表示しない**
  (該当分岐を削除してよい)
- 入力・店舗の変更で即時再計算(保存ボタン不要)
- 保存ボタンの挙動は現状維持(常に新規 `priceRecords` 追加)

## Code Style

```ts
export type DraftRankReference = {
  productId: string;
  storeId: string;
  unitPrice: number;
  displayRank: 1 | 2;
};

export type DraftRankResult = {
  kind: 'ranked';
  rank: number;
  total: number;
  reference?: DraftRankReference;
};

/** 入力中ドラフトが、カテゴリ内の価格記録(同一商品×同一店舗は除外)と比べ何位かを返す */
export function rankDraftInCategory<P extends { id: string }, R extends PriceRecordInput>(
  productsInCategory: P[],
  records: R[],
  targetProductId: string,
  targetStoreId: string,
  draft: { price: number; quantity: number; unit: string },
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): DraftRankResult | null;
```

- `DraftRankResult` から `noCandidates` を削除する(呼び出し側も合わせて整理)
- 命名・関数分離方針は `docs/spec.md` を継承

## Testing Strategy

`docs/spec.md` / `docs/spec-issue2.md` の Testing Strategy を継承し、以下を差し替える。

### 単体(`bottomPrice.test.ts`)

- 同一商品・別店舗の記録が候補になり、順位が付く
- 同一商品・同一店舗の既存記録はすべて除外される
- 除外後に候補 0 なら `{ kind: 'ranked', rank: 1, total: 1 }`
- `targetStoreId` が空/未指定相当の扱いは呼び出し側責務だが、
  関数は storeId 必須引数として他店舗記録と比較できること
- 期間フィルタ・単位不能記録の除外・同額は上に寄せる、は Issue #2 相当を維持
- 旧「他商品の底値のみ」「noCandidates」前提のテストは本仕様に合わせて書き換える

### コンポーネント(`RecordPage.test.tsx`)

- 店舗未選択の間は、価格・内容量が揃っても順位も旧メッセージも出ない
- 店舗選択後に同一商品・別店舗の既存記録があれば順位が表示される
- 同一商品・同一店舗のみ既存のとき、除外後は `暫定 1 位 / 1 件中`
- 文言が `件中` であること
- `bottomWindowMonths` が候補フィルタに効くこと(期間外のみなら 1/1)
- 候補があるとき比較行が出る(自分が1位なら `2位:`、2位以下なら `1位:`)
- 候補がないとき(1位/1件中)は比較行が出ない

## Boundaries

- **Always**: 保存は追加のままにする。履歴削除・自動上書き保存を持ち込まない。
  変更後に `npm run test` / `npm run lint` を通す
- **Ask first**: 保存時の upsert(実データの上書き)、データモデル変更、
  カテゴリ内比較画面自体の仕様変更
- **Never**: 「比較できる記録がありません」を残したまま矛盾する順位ロジックを同居させない。
  Issue #2 の旧前提(他商品底値のみ)を本仕様と並記したまま実装しない
  (ドキュメント上は本ファイルが暫定順位の比較ロジックについて優先)

## Success Criteria

- [x] 商品 a / 店舗 a の記録がある状態で、商品 a / 店舗 b を入力すると暫定順位が表示される
      (「比較できる記録がありません」にならない)
- [x] 商品 a / 店舗 a の記録がある状態で、同じ商品 a / 店舗 a を入力すると、
      その既存記録を除外した順位になる(他候補が無ければ 1 位 / 1 件中)
- [x] 店舗未選択の間は順位が表示されない
- [x] 保存後も同一商品・同一店舗の過去記録が履歴として残る(追加保存のまま)
- [x] 表示文言が `暫定 {rank} 位 / {total} 件中` である
- [x] 候補があるとき比較行(1位または2位の商品名・店舗・単価)が表示される
- [x] 候補がないとき(1位/1件中)は比較行が出ない
- [x] `npm run test` / `npm run lint` がグリーン

## 将来スコープ(本 Issue に含めない)

- 記録画面からの同一商品・同一店舗 upsert(実データ上書き)
- カテゴリ内比較画面の UI 変更
- 順位履歴・推移グラフ

## Open Questions

- なし(2026-07-15 ヒアリングで方針 A・店舗必須を確認済み)
  ※ 仮定 5〜6(複数履歴は全除外、単独時は 1/1)に異論があれば実装前に訂正すること

## 関連ドキュメント

- 親仕様: `docs/spec.md`
- 改訂対象: `docs/spec-issue2.md`(暫定順位の初回仕様。比較ロジックは本ファイルが優先)
- 比較粒度の参考: `docs/spec-issue1-category-comparison.md`(全記録ランキング)
- Issue: https://github.com/marusho-1266/BottomPriceBook_ad/issues/8
