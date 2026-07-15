# 実装計画: カテゴリ編集で基準単位も変更可能にする(Issue #3)

> Status: **Approved・実装完了(2026-07-15)** / 作成日: 2026-07-15 / 最終更新: 2026-07-15
> 対象仕様: `docs/spec-issue3.md`(Approved 2026-07-15)
> タスク分解: `docs/tasks-issue3.md`

## 方針

- 純関数の単位合わせ → Firestore 更新 API → CategoriesPage UI → 親仕様更新、の順で積む
- 既存の `toBaseQuantity` / `deleteProductWithRecords`(分割バッチ) / `CategoriesPage` 編集 UI を踏襲し、
  新規パターンを増やさない
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## 主要コンポーネントと依存

```
relabelRecordToBaseUnit (units.ts 純関数)
        │
        ▼
updateCategory (api + 分割バッチで priceRecords 更新)
        │
        ▼
CategoriesPage (編集 UI・確認ダイアログ・案内文)
        │
        ▼
docs/spec.md (親仕様の「変更不可」記述を更新)
```

| コンポーネント | 役割 | 依存 |
|---|---|---|
| `relabelRecordToBaseUnit` | 旧 baseUnit 正規化 → 新 unit リラベル | `toBaseQuantity` のみ |
| `updateCategory` | カテゴリ更新 + 必要時に配下記録を一括更新 | 上記純関数、`chunk`、Firestore |
| `CategoriesPage` | 編集セレクト・confirm・API 呼び出し | `updateCategory`、商品件数 |
| `docs/spec.md` | 親仕様との矛盾解消 | 実装内容の確定後で可 |

## 実装順序

1. **純関数 + 単体テスト** — UI なしで仕様の変換例を固定する
2. **`updateCategory` + バッチ更新** — カテゴリ本体と priceRecords の書き込み
3. **CategoriesPage UI** — 編集セレクト、確認条件、案内文差し替え
4. **親仕様更新** — `docs/spec.md` の単位・カテゴリ記述を本仕様に合わせる

1→2→3 は直列。4 は 3 とほぼ独立だが、文言の最終確認のため最後に置く。

## リスクと緩和

| リスク | 緩和 |
|---|---|
| 途中失敗でカテゴリと一部記録が不整合 | 仕様どおり MVP 割り切り。UI でエラー表示。リトライ可能な形にする |
| `productId in [...]` の Firestore 制限(最大 10) | 商品ごとに query するか、全 priceRecords を取って productId でフィルタ。件数が多い場合は商品単位ループを採用 |
| 既存テストが `renameCategory` 名に依存 | API リネーム時はテスト・呼び出しを一括更新 |
| 確認なしで意図せず記録が書き換わる | UI 側で「baseUnit 変更 AND 商品 ≥ 1」のときだけ confirm |

## 検証チェックポイント

| 時点 | 確認内容 |
|---|---|
| 純関数完了後 | Testing Strategy の変換 4 ケースがグリーン |
| API 完了後 | 名称のみ / 商品ゼロ / baseUnit 変更の分岐がテストまたは手動で確認できる |
| UI 完了後 | Success Criteria の確認ダイアログ・案内文・編集保存が満たせる |
| 全体 | `npm run test` / `npm run lint` / `npm run build` グリーン、親仕様矛盾なし |

## 並行作業

- 純関数テストの執筆と実装は同一タスク内で TDD 可能
- UI と親仕様更新は依存が薄いが、ファイル数が少ないため順次で十分

