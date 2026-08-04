# Plan: ホーム・比較の内容量表示

> Spec: `docs/spec-quantity-on-lists.md`(Approved 2026-08-04)

## 方針

表示専用の薄い変更。データ取得・底値計算は触らない。
表記は `formatQuantityLabel(quantity, unit)` に寄せ、商品詳細履歴と同じ `{quantity}{unit}` を保証する。

## コンポーネントと依存

```
formatQuantityLabel (units.ts)
        │
        ├── HomePage (モバイル副行)
        ├── PcHomeDashboard (テーブル列)
        └── ComparePage (メタ行)
```

順序: ヘルパー → ホーム(モバイル) → ホーム(PC) → 比較 → 親ドキュメント追随。

## リスク

| リスク | 緩和 |
|---|---|
| 副行が長くなり狭い端末で切れる | 既存どおり truncate は商品名のみ。副行は現状どおり折り返し可 |
| 商品名に容量があり冗長 | Spec どおり許容(Out of Scope) |
| 既存スナップショット的アサーションが壊れる | テストは部分一致(`/240ml/`)で追加 |

## 検証チェックポイント

1. `formatQuantityLabel` 単体テスト緑
2. Home / PC / Compare のコンポーネントテスト緑
3. `npm run lint` / `npm run test` 全体緑
