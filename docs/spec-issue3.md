# Spec: カテゴリ編集で基準単位も変更可能にする(Issue #3)

> Status: **Approved・実装完了(2026-07-15)** / 作成日: 2026-07-15 / 最終更新: 2026-07-15
>
> 対象: GitHub Issue #3「カテゴリ管理の編集対象について」
> このドキュメントは spec-driven development の Phase 1 (Specify) 成果物。
> プロジェクト全体の仕様(Tech Stack・Code Style・Testing Strategy・Boundaries 等)は
> `docs/spec.md`(Approved)を継承し、本ドキュメントでは本機能固有の差分のみを記述する。

## 元 Issue

> 編集時に名称しか変更できないが、基準単位も変更できるようにしたい

## ASSUMPTIONS(確認済み / 本仕様で採用)

ヒアリング(2026-07-15)で以下を確認済み。訂正があれば実装前に指摘すること。

1. 対象画面は既存の「カテゴリ管理」(`CategoriesPage`)の編集 UI
2. 変更可能な基準単位は既存の `BaseUnit`(`g` / `ml` / `個` / `枚` / `組` / `回分`)のまま。
   スキーマへのフィールド追加は不要
3. そのカテゴリに属する**商品が 1 件でもある**状態で基準単位を変更する場合は、
   確認メッセージを出し、同意が得られたときのみ変更を実行する
4. 同意後は、当該カテゴリ配下の全価格記録を「変更後の単位に合わせる」
5. 「合わせる」は**物理換算ではない**。手順は次のとおり:
   1. 現行 `baseUnit` へ数量を正規化する(`kg`→`g`、`L`→`ml` など。`toBaseQuantity` 相当)
   2. 正規化後の数量を保ったまま、`unit` を**新しい `baseUnit` に付け替える**(リラベル)
6. 基準単位同士に換算表は無い(`g`↔`ml`、`個`↔`枚` 等は次元・意味が異なる)。
   確認文で「単価の意味が変わる／物理換算ではない」旨を明示する
7. 商品が 0 件のときは確認なしで `baseUnit` を更新してよい
   (合わせる対象の価格記録も存在しない)
8. 名称のみの変更(基準単位が変わらない)では、本機能の確認・記録更新は行わない
9. 親仕様 `docs/spec.md` および追加フォームの
   「基準単位はあとから変更できません」表記は、本 Issue で合わせて更新する

## Objective

### 何を作るか

カテゴリ管理の編集で、名称に加えて**基準単位(`baseUnit`)も変更**できるようにする。
所属商品がある場合は確認のうえ、配下の全価格記録の単位を新基準単位に揃える。

### 誰のためか

- カテゴリ作成時に基準単位を誤った／後から単位の考え方を変えたい買い物客
  (既存のカテゴリ管理ユーザー)

### ユーザーストーリー

- 買い物客として、カテゴリ編集で基準単位を直したい
- 買い物客として、すでに商品・記録があるカテゴリで基準単位を変えるときは、
  影響が分かる確認を見てから同意したい
- 買い物客として、同意したあとは既存の価格記録も新しい基準単位で単価比較できるようにしたい

## Tech Stack

`docs/spec.md` を継承。新規依存パッケージの追加は不要
(既存の `toBaseQuantity` / Firestore `writeBatch` / `chunk` を利用する)。

## Commands

`docs/spec.md` の Commands をそのまま使用(`npm run dev / build / test / lint` 等)。

## Project Structure

```
src/features/categories/CategoriesPage.tsx
  → 編集 UI に基準単位セレクトを追加。確認ダイアログと案内文を更新
src/features/categories/api.ts
  → renameCategory を名称+基準単位更新に拡張、または updateCategory に置換
src/features/categories/updateCategoryBaseUnit.ts(仮称) または api 内ヘルパー
  → カテゴリ更新 + 配下 priceRecords の単位合わせ(分割バッチ)
src/lib/units.ts
  → 必要なら「旧 baseUnit で正規化 → 新 unit 付け替え」の純関数を追加
tests/features/categories/
  → CategoriesPage / 単位合わせロジックのテスト
docs/spec.md
  → 「基準単位は作成後変更不可」相当の記述・前提を本仕様に合わせて更新
```

## ロジック仕様

### 関数: 価格記録の単位合わせ(仮称 `relabelRecordToBaseUnit`)

純関数。1 件の記録を新しい基準単位向けに変換する。

- 入力: `{ quantity: number; unit: string }`、`fromBaseUnit: BaseUnit`、`toBaseUnit: BaseUnit`
- 処理:
  1. `normalized = toBaseQuantity(quantity, unit, fromBaseUnit)`
  2. `normalized !== null` なら `{ quantity: normalized, unit: toBaseUnit }`
  3. `normalized === null`(現行 baseUnit と不整合な記録)の場合はフォールバック:
     `{ quantity, unit: toBaseUnit }`(数量はそのまま、unit のみ付け替え)
- 戻り値: `{ quantity: number; unit: string }`
- 注: `fromBaseUnit === toBaseUnit` の呼び出しは想定しない(呼び出し側でスキップ)

### 関数: カテゴリ更新(仮称 `updateCategory`)

- 入力: `bookId`、`categoryId`、`{ name: string; baseUnit: BaseUnit }`、
  変更前の `previousBaseUnit`、所属 `productIds: string[]`
- 処理:
  1. カテゴリドキュメントを `{ name, baseUnit }` で `updateDoc`
  2. `previousBaseUnit === baseUnit` または `productIds` が空なら、価格記録の更新は行わない
     (名称のみ・または商品ゼロ)。ステップ 1 のみで完了してよい
  3. それ以外: 所属商品の全 `priceRecords` を取得し、各記録に
     `relabelRecordToBaseUnit(..., previousBaseUnit, baseUnit)` を適用して
     `quantity` / `unit` を更新
  4. Firestore の 1 バッチ 500 書き込み上限があるため、
     商品削除(`deleteProductWithRecords`)と同様に分割バッチで commit する(L-5)
- 失敗時: 途中失敗でカテゴリと一部記録の不整合が起きうる。
  MVP では商品削除と同様に割り切り、リトライ可能な実装とする
  (完璧なトランザクションは求めない)。UI では失敗時にエラーを表示する

### 確認が必要な条件

次を**すべて**満たすとき、保存前に確認ダイアログを出す:

- 編集後の `baseUnit` が変更前と異なる
- そのカテゴリを参照する商品が 1 件以上ある

キャンセルされたら保存しない(名称も `baseUnit` も書かない)。

### 確認メッセージ(文言の要件)

次の情報を含めること(文言の一字一句固定は不要):

- 基準単位が `{旧}` から `{新}` に変わること
- 影響する商品件数(任意で価格記録件数も可)
- **物理的な単位換算ではなく、数量を旧基準単位に揃えたうえで単位名を付け替える**こと
- 単価比較の意味が変わる可能性があること
- 同意しない場合は変更しないこと

## UI 仕様(CategoriesPage)

- 編集モードで、名称入力に加えて基準単位の `<select>`(追加フォームと同じ `BASE_UNITS`)を出す
- 保存時:
  - 名称が空なら既存どおり保存しない(またはエラー)
  - 上記「確認が必要な条件」なら `window.confirm`(または同等)で同意を取る
  - 同意後(または確認不要時)に `updateCategory` を呼ぶ
- 追加フォーム下部の
  「基準単位はあとから変更できません(単価比較の基準になります)」は削除または、
  「変更時は所属商品の記録の単位も付け替えます」旨の案内に置き換える
- 一覧の表示(名称 + 基準単位)は維持。編集中も現在の基準単位が分かるようにする

## 親仕様への差分(`docs/spec.md`)

実装時に親仕様を次の趣旨で更新する:

- カテゴリの `baseUnit` は**作成後も変更可能**
- 変更時、所属商品がある場合は確認のうえ、配下 `priceRecords` を
  「旧 baseUnit へ正規化 → 新 baseUnit へリラベル」する
- これは物理換算ではない旨を明記
- 商品のカテゴリ変更制限(同一 baseUnit のカテゴリのみ)は**維持**
  (本 Issue では商品側の制限は変えない)

## Code Style

```ts
/** 旧基準単位で正規化し、新基準単位へ unit を付け替える(物理換算ではない) */
export function relabelRecordToBaseUnit(
  record: { quantity: number; unit: string },
  fromBaseUnit: BaseUnit,
  toBaseUnit: BaseUnit,
): { quantity: number; unit: string } {
  const normalized = toBaseQuantity(record.quantity, record.unit, fromBaseUnit);
  if (normalized === null) {
    return { quantity: record.quantity, unit: toBaseUnit };
  }
  return { quantity: normalized, unit: toBaseUnit };
}
```

`docs/spec.md` の Code Style(命名規則・関数分離方針)を継承する。
API 名は `renameCategory` のまま拡張するか `updateCategory` にリネームしてよいが、
呼び出し側とテストを一貫して更新すること。

## Testing Strategy

`docs/spec.md` の Testing Strategy を継承。本機能では以下を追加する:

- 単体テスト(`relabelRecordToBaseUnit`):
  - `2 kg` + from `g` → to `ml` ⇒ `{ quantity: 2000, unit: 'ml' }`(正規化後リラベル)
  - `1.5 L` + from `ml` → to `個` ⇒ `{ quantity: 1500, unit: '個' }`
  - `3 個` + from `個` → to `枚` ⇒ `{ quantity: 3, unit: '枚' }`
  - 現行 baseUnit と不整合な unit(例: from `g` なのに `個`)は
    quantity そのまま・unit のみ新 baseUnit
- コンポーネント / API テスト:
  - 編集 UI で基準単位を変更して保存できる
  - 商品 0 件のカテゴリでは confirm なしで baseUnit が更新される
  - 商品 1 件以上かつ baseUnit 変更時は confirm が出る。
    キャンセルなら API が呼ばれない。同意なら API が呼ばれる
  - 名称のみ変更では記録の単位合わせ処理が走らない
  - 「あとから変更できません」文言が残っていない(または新案内に置き換わっている)

## Boundaries

`docs/spec.md` の Boundaries を継承。本機能固有:

- **Always:** 基準単位変更で記録を更新するときは、先に旧 baseUnit へ正規化してからリラベルする。
  バッチは 500 書き込み上限を超えないよう分割する
- **Ask first:** 確認 UI を `window.confirm` 以外(専用モーダル等)にする場合
- **Never:** 価格記録の `price` を書き換えない。
  商品の `categoryId` 制限(異 baseUnit カテゴリへの移動禁止)を本 Issue で外さない。
  既存記録を削除して作り直す方式にはしない

## Success Criteria

- [x] カテゴリ編集で名称と基準単位の両方を変更できる
- [x] 商品が 1 件以上あるカテゴリで基準単位を変えると確認が出る。
      キャンセルで何も変わらず、同意でカテゴリと配下記録が更新される
- [x] 同意後、配下記録は「旧 baseUnit 正規化 → 新 baseUnit リラベル」されている
      (`kg`/`L` も旧基準量に直したうえで新 unit になる)
- [x] 商品 0 件、または名称のみの変更では不要な確認・記録更新が走らない
- [x] 追加フォームの「基準単位はあとから変更できません」が解消されている
- [x] `docs/spec.md` の関連記述が本仕様と矛盾しないよう更新されている
- [x] `npm run test` / `npm run lint` がグリーン

## 将来スコープ(本 Issue に含めない)

- 基準単位変更の履歴・監査ログ
- 記録ごとの個別単位の手動再設定 UI
- 異次元単位間の「意味のある」換算テーブル
- 商品を別カテゴリへ移すときの自動単位合わせ
- 多人数同時編集時の厳密なトランザクション保証

## Open Questions

- なし(2026-07-15 のヒアリングで方針確定。
  「商品がある場合は確認 → 同意後に正規化+リラベル」で進める)

