# Spec: 価格記録の編集項目を拡充(Issue #42)

> Status: **Implemented** / 作成日: 2026-07-29 / Approved: 2026-07-29 / 実装完了: 2026-07-29
>
> 対象: GitHub Issue [#42](https://github.com/marusho-1266/BottomPriceBook_ad/issues/42)
> 「価格記録の編集項目を拡充（内容量・特売・日付・店舗）」
> このドキュメントは spec-driven development の Phase 1 (Specify) 成果物。
> プロジェクト全体の仕様(Tech Stack・Code Style・Testing Strategy・Boundaries 等)は
> `docs/spec.md`(Approved)を継承し、本ドキュメントでは本機能固有の差分のみを記述する。

## 元 Issue

> 商品詳細の履歴から価格記録を編集できるが、現状は価格のみ。
> 親仕様 H-1 では内容量・特売フラグ・日付・店舗の編集も MVP に含める想定だが未実装。
> `updatePriceRecord` は既にこれらのフィールドを patch 可能なため、
> 主作業は商品詳細のインライン編集 UI の拡充。

## ASSUMPTIONS(ヒアリング確定 + 実装前提)

ヒアリング(2026-07-29)および Issue 草案で以下を採用。**訂正があれば Plan 前に指摘すること。**

1. **編集場所は商品詳細の履歴**: `/products/:id` の記録履歴行から操作する(親仕様 H-1 どおり)
2. **UI はインライン拡張**: 現状の鉛筆編集を広げる。別画面・モーダル・記録画面への遷移はしない
3. **編集対象フィールド**:
   - 価格(`price`) — 既存
   - 内容量(`quantity`) + 単位(`unit`)
   - 特売フラグ(`isSale`)
   - 日付(`recordedAt`)
   - 店舗(`storeId`)
4. **単位制限**: 記録画面と同様、当該商品カテゴリの `baseUnit` に対する `allowedUnits` のみ選択可
5. **日付の扱い**: 記録画面と同じく `<input type="date">`。保存時は
   `new Date(\`${date}T12:00:00\`)` で正午ローカル時刻とする
6. **店舗選択**: 既存店舗の一覧から選ぶ(`<select>` 等で可)。編集中の「その場で店舗追加」はしない
7. **レイアウト**: 項目が増えるため、編集中は行を**縦に展開したミニフォーム**にする
   (横並びに価格だけ出す現状レイアウトは捨ててよい)
8. **キャンセル**: 編集モードに「キャンセル」を置き、未保存で閲覧表示に戻れるようにする
   (現状は保存のみでキャンセルなし。多項目化に伴い追加する)
9. **バリデーション失敗時**: 画面上に短いエラー文言を出す
   (現状の「黙って return」は多項目では分かりにくいため改善する)
10. **API**: 既存 `updatePriceRecord` を使う。Firestore スキーマ変更・新規 npm 依存なし
11. **非対象**: `productId` の付け替え、価格記録の `note`、PC 右ペイン編集、記録画面の UX 変更

## Objective

### 何を作るか

商品詳細の記録履歴で、価格だけでなく内容量・単位・特売・日付・店舗を
インライン編集・保存できるようにする。親仕様 H-1 の未充足分を埋める。

### 誰のためか

- 店頭や帰宅後に入力ミス(店舗違い・特売付け忘れ・日付間違い・内容量の桁ミス)に気づいた買い物客
- 底値判定に効く項目を後から直したい利用者

### ユーザーストーリー

- 買い物客として、商品詳細の履歴から価格以外の項目も直して保存したい
- 買い物客として、誤って編集を始めたらキャンセルして元の表示に戻りたい
- 買い物客として、不正な値では保存されず理由が分かるとよい

## Tech Stack

`docs/spec.md` を継承。新規依存パッケージの追加は不要。
既存の `updatePriceRecord` / `useProductPriceRecords` / `useStores` / `allowedUnits` /
`formatPriceRecordDate` を利用する。

## Commands

`docs/spec.md` の Commands をそのまま使用(`npm run dev / build / test / lint` 等)。

## Project Structure

```
src/routes/ProductDetailPage.tsx              → 履歴インライン編集を全項目対応に拡張
src/features/prices/PriceRecordEditForm.tsx   → (推奨) 編集ミニフォームを切り出し。
                                                ProductDetailPage 内に閉じても可。Plan で確定
src/features/prices/api.ts                    → updatePriceRecord は既存のまま(変更不要想定)
tests/routes/ProductDetailPage.test.tsx       → 全項目編集・バリデーション・キャンセルのテスト
docs/spec.md                                  → H-1 / Success Criteria の達成状況を整合(実装後)
```

Firestore・Cloud Functions・セキュリティルールの変更は不要
(`priceRecords` の update は既存ルールで価格以外も許可済み想定。実装前にルールを確認)。

## 機能仕様

### 閲覧表示(変更なしの要件)

- 各履歴行に価格・特売バッジ・店舗名・内容量+単位・日付を表示(現行どおり)
- 鉛筆(「記録を編集」)とゴミ箱(「記録を削除」)を維持

### 編集モード

鉛筆タップで当該行だけ編集モードに入る。同時に編集できるのは 1 行のみ。

| 入力 | UI | 初期値 | 制約 |
|---|---|---|---|
| 価格 | `number` | `record.price` | 必須・有限・正の数 |
| 内容量 | `number` | `record.quantity` | 必須・有限・正の数 |
| 単位 | `select` | `record.unit`(候補外なら先頭単位) | `allowedUnits(category.baseUnit)` のみ |
| 特売 | checkbox / トグル | `record.isSale` | boolean |
| 日付 | `date` | `recordedAt` のローカル YYYY-MM-DD | 必須 |
| 店舗 | `select` | `record.storeId` | 既存店舗から必須選択 |

アクション:

- **保存**: バリデーション成功後 `updatePriceRecord(bookId, recordId, patch)` を呼び、
  編集モードを閉じる。patch には変更した/フォーム上の全対象フィールドを渡してよい
  (差分だけでも全上書きでも可。結果がフォーム内容と一致すればよい)
- **キャンセル**: 保存せず編集モードを閉じ、表示を元に戻す

### バリデーション / エラー

少なくとも次を拒否し、短い日本語メッセージを出す:

- 価格が空・非数・0 以下 → 「価格を正しく入力してください」等
- 内容量が空・非数・0 以下 → 「内容量を正しく入力してください」等
- 店舗未選択 → 「店舗を選択してください」
- 単位が空(候補なし等の異常) → 保存不可

文言の一字一句固定は不要。記録画面と揃えてもよい。

### 削除

現行どおり。確認ダイアログ後 `deletePriceRecord`。本 Issue で変更しない。

### 反映

保存成功後、既存のリアルタイム購読により履歴・底値(特売込み/通常のみ)・店舗別底値が
再計算・再表示されること。追加の明示的リフェッチは不要。

## API

### `updatePriceRecord`(既存・変更不要想定)

```ts
updatePriceRecord(
  bookId: string,
  recordId: string,
  patch: Partial<Omit<PriceRecordDraft, 'recordedAt'>> & { recordedAt?: Date },
): Promise<void>
```

- `price` / `quantity` が patch に含まれる場合は正の数必須(既存ガード)
- `recordedAt` は `Date` → Firestore `Timestamp` に変換(既存)

本 Issue で API シグネチャを変える必要はない。UI から上記フィールドを渡せば足りる。

## 親仕様への差分

### `docs/spec.md`

実装完了時に:

- H-1「編集(価格・内容量・特売フラグ・日付・店舗)」が UI で満たされた旨を確認
- Success Criteria「価格記録をあとから編集・削除できる」を満たせる状態にする
  (チェック可否は親仕様の運用に合わせる)

文言の大きな書き換えは不要。未実装だった編集項目が揃ったことの整合が目的。

## Code Style

```tsx
/** 価格記録のインライン編集。価格・内容量・単位・特売・日付・店舗 */
export function PriceRecordEditForm(props: {
  record: WithId<PriceRecord>;
  stores: WithId<Store>[];
  baseUnit: string;
  onSave: (patch: ...) => Promise<void>;
  onCancel: () => void;
}) {
  // allowedUnits(baseUnit) で単位候補
  // 保存前バリデーション → onSave
}
```

- コンポーネントは named export
- Firestore アクセスは `features/prices/api.ts` に集約(ページから直接書かない)
- UI 文言は日本語
- フォームを `ProductDetailPage` に直書きしてもよいが、行が肥大化するなら
  `features/prices/` へ切り出す(Plan で選択)

## Testing Strategy

`docs/spec.md` の Testing Strategy を継承。本機能では以下を追加する:

| レベル | 対象 |
|---|---|
| コンポーネント | 編集開始で全フィールドが初期表示されること |
| コンポーネント | 全項目を変更して保存すると `updatePriceRecord` に期待 patch が渡ること |
| コンポーネント | 不正な価格・内容量・店舗未選択で API が呼ばれずエラーが出ること |
| コンポーネント | キャンセルで API が呼ばれず閲覧表示に戻ること |
| コンポーネント | 単位選択肢がカテゴリ `baseUnit` に制限されること |
| 手動 | 実機/ブラウザで編集→底値表示の変化、削除の健在を確認 |

既存の価格のみ編集・削除テストは、拡張後も壊さないよう更新する。

## Boundaries

- **Always**
  - コミット前に `npm run lint` と `npm run test` を通す
  - 単位は `allowedUnits(baseUnit)` に制限する
  - 価格・内容量は正の数のみ保存する
  - 削除フローを壊さない
- **Ask first**
  - Firestore スキーマやセキュリティルールの変更
  - 新規 npm 依存の追加
  - 編集中の店舗新規追加
  - PC 右ペインへの編集 UI
  - 価格記録 `note` の編集
- **Never**
  - `productId` の付け替え UI を本 Issue に含めること
  - 記録画面の新規入力 UX を本 Issue で作り変えること
  - シークレットのコミット、失敗テストの無断スキップ

## Success Criteria

- [x] 商品詳細の履歴から価格・内容量・単位・特売・日付・店舗を編集して保存できる
- [x] 単位は当該商品カテゴリの `baseUnit` に応じた選択肢に制限される
- [x] 不正値では保存されず、エラー文言が見える
- [x] キャンセルで未保存のまま閲覧表示に戻れる
- [x] 保存後、履歴および底値表示に反映される
- [x] 削除は従来どおり動作する
- [x] 関連テストがグリーン、`npm run lint` / `npm run test` が通る
- [x] `docs/spec.md` の H-1 記述と実装が整合している

## Out of Scope

- 価格記録の商品付け替え(`productId`)
- 価格記録の `note` 編集
- PC 右ペインからの編集
- 編集中の店舗・商品のその場追加
- 記録画面(新規登録)の改修
- Firestore / Functions / ルール変更(ルール不備が発覚した場合は Ask first)
- 新規 npm 依存

## Open Questions

なし(ヒアリングでインライン拡張を確定。上記 ASSUMPTIONS 8–9 のキャンセル／エラー表示は
本仕様で提案採用。異論があれば Plan 前に訂正)。

Plan で確定する実装詳細:

- フォームを `PriceRecordEditForm` に切り出すか、ページ内に閉じるか
- 店舗 UI を素の `<select>` にするか、見た目を記録画面に寄せるか(機能は既存店舗選択のみ)

## 次のフェーズ

実装完了。Phase 1〜4 完了(2026-07-29)。
