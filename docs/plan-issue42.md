# 実装計画: 価格記録の編集項目を拡充(Issue #42)

> Status: **Implemented** / 作成日: 2026-07-29 / Approved: 2026-07-29 / 実装完了: 2026-07-29
> 対象仕様: `docs/spec-issue42.md`(Implemented)
> タスク分解: `docs/tasks-issue42.md`(Done)

## 方針

- **API は触らない**: 既存 `updatePriceRecord` で全対象フィールドを patch 可能
- **編集 UI をフォーム部品に切り出す**: `PriceRecordEditForm` を新設し、
  `ProductDetailPage` は閲覧行 ↔ 編集フォームの切替に専念する
- **単位・日付は記録画面と同じ規則**: `allowedUnits(baseUnit)` と
  `date` + `T12:00:00` 正午ローカル
- **店舗は素の `<select>`**: 既存店舗のみ。見た目寄せや PickerSheet はしない
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| `PriceRecordEditForm` を `features/prices/` に新設 | ProductDetailPage が肥大化しない。単体テストしやすい |
| 店舗 UI は `<select>` | 機能要件は既存店舗選択のみ。記録画面の PickerSheet は過剰 |
| 編集中は行全体をフォームに置換(縦並び) | 6 項目を横並びにできない。spec ASSUMPTION 7 |
| キャンセル + エラー文言をフォーム内に持つ | spec ASSUMPTION 8–9。ページ側は `editingId` の開閉のみ |
| `updatePriceRecord` は変更なし | シグネチャ・バリデーション・writeBatch 済み |
| Firestore ルール変更なし | update で `storeId` / `quantity` / `unit` / `isSale` / `recordedAt` は既に許可 |
| 親仕様 `docs/spec.md` は最終タスクで整合確認 | H-1 / Success Criteria の文言ずれを防ぐ |

## 主要コンポーネントと依存

```
PriceRecordEditForm(新規)
  ├── allowedUnits(baseUnit)
  ├── stores(select)
  ├── onSave(patch) / onCancel()
  └── 内部: バリデーション + エラー表示

ProductDetailPage
  ├── editingId で閲覧行 ↔ PriceRecordEditForm 切替
  ├── updatePriceRecord(bookId, id, patch)
  └── deletePriceRecord(既存のまま)
```

## 実装順序(フェーズ)

### Phase A: 編集フォーム
1. **I42-T1**: `PriceRecordEditForm` + 単体テスト
   (初期値・保存 patch・バリデーション・キャンセル・単位制限)

### Phase B: ページ配線
2. **I42-T2**: `ProductDetailPage` をフォーム切替に置換。既存テスト更新 +
   全項目保存の結合テスト

### Phase C: 仕上げ
3. **I42-T3**: `docs/spec.md` の H-1 / Success Criteria 整合 + 回帰
   (`npm run test && npm run lint`)

## 画面・操作の詳細(Plan 確定事項)

### PriceRecordEditForm

Props(案):

```ts
{
  record: WithId<PriceRecord>;
  stores: WithId<Store>[];
  baseUnit: string;
  onSave: (patch: {
    price: number;
    quantity: number;
    unit: string;
    isSale: boolean;
    storeId: string;
    recordedAt: Date;
  }) => Promise<void>;
  onCancel: () => void;
}
```

- 初期値: 各フィールドを `record` から。単位が `allowedUnits` 外なら先頭単位
- 日付初期値: `recordedAt.toDate()` をローカル `YYYY-MM-DD` に変換
  (既存 RecordPage の `todayISO` 相当を流用または小ヘルパー)
- 保存: バリデーション後 `onSave`。成功待ち中は二重送信防止(disabled 程度で可)
- キャンセル: `onCancel`(親が `editingId` をクリア)
- エラー: フォーム下部に短いテキスト

### ProductDetailPage

- 鉛筆: `setEditingId(record.id)` のみ(フィールド state はフォーム内)
- 編集中行: 閲覧 UI + 鉛筆/ゴミ箱の代わりに `<PriceRecordEditForm ... />`
- `onSave`: `await updatePriceRecord(...); setEditingId(null)`
- `onCancel`: `setEditingId(null)`
- 削除・底値表示・「商品情報を編集」リンクは変更しない

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 日付のタイムゾーンずれで表示日がずれる | Med | RecordPage と同じ `T12:00:00`。テストで日付変更の patch を検証 |
| 単位候補外の既存データで初期値が空 | Low | 候補外なら `units[0]` にフォールバック(記録画面と同パターン) |
| 既存「価格のみ編集」テストが壊れる | Med | T2 で期待を全項目 patch に更新 |
| フォーム肥大でモバイル縦スペース不足 | Low | 縦並び + コンパクトな入力高。必要なら後続 Issue |

## 検証チェックポイント

| タイミング | 確認 |
|---|---|
| T1 完了後 | フォーム単体テスト緑。不正値で `onSave` 未呼び出し |
| T2 完了後 | 商品詳細から全項目編集・キャンセル・削除がテストで通る |
| T3 完了後 | `npm run test && npm run lint`、親仕様 H-1 と実装が一致 |

## Out of Scope

- `productId` 付け替え、価格記録 `note`、PC 右ペイン編集
- 編集中の店舗追加、記録画面の改修
- Firestore / Functions / ルール変更、新規 npm 依存

## 次のフェーズ

実装完了(I42-T1〜T3)。
