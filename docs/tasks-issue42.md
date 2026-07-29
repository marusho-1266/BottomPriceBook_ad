# タスク分解: 価格記録の編集項目を拡充(Issue #42)

> Status: **Done** / 作成日: 2026-07-29 / 実装完了: 2026-07-29
> 対象: `docs/spec-issue42.md`(Implemented) / 計画: `docs/plan-issue42.md`(Implemented)
> 実装は 1 タスク = 1 コミット相当で進める。各タスクの Verify を通してから次へ。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase A: 編集フォーム

- [x] **I42-T1: `PriceRecordEditForm` + 単体テスト**
  - 内容: `src/features/prices/PriceRecordEditForm.tsx` を新規作成。
    - Props: `record`, `stores`, `baseUnit`, `onSave(patch)`, `onCancel`
    - フィールド: 価格・内容量・単位・特売・日付・店舗(縦並び)
    - 初期値は `record` から。単位が `allowedUnits(baseUnit)` 外なら先頭単位
    - 日付はローカル `YYYY-MM-DD`。保存時 `new Date(\`${date}T12:00:00\`)`
    - 店舗は既存一覧の `<select>`(その場追加なし)
    - バリデーション失敗時は短い日本語エラーを表示し `onSave` を呼ばない
      (価格/内容量の正の数、店舗必須)
    - 「保存」「キャンセル」ボタン
    - 日付の ISO 変換ヘルパーが必要なら `features/prices/` か既存 util に小さく置く
      (`RecordPage` の `todayISO` を無理に共有しなくてよい)
    `tests/features/prices/PriceRecordEditForm.test.tsx` を新設し、少なくとも以下を検証:
    - 初期値が表示される
    - 全項目変更後の保存で期待 patch が `onSave` に渡る
    - 不正な価格・内容量・店舗未選択で `onSave` 未呼び出し + エラー表示
    - キャンセルで `onCancel` が呼ばれ `onSave` は呼ばれない
    - 単位選択肢が `baseUnit` に制限される
  - Acceptance: フォーム単体で仕様の編集・検証・キャンセルが満たせる
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/prices/PriceRecordEditForm.tsx`,
    `tests/features/prices/PriceRecordEditForm.test.tsx`,
    必要なら日付ヘルパー 1 ファイル
  - 依存: なし / 規模: M

### Checkpoint A
- [x] `PriceRecordEditForm` の単体テストがグリーン

---

## Phase B: ページ配線

- [x] **I42-T2: `ProductDetailPage` を全項目編集に置換**
  - 内容: 履歴の価格のみインライン編集をやめ、`editingId` 一致行で
    `PriceRecordEditForm` を表示する。
    - `onSave`: `await updatePriceRecord(bookId, id, patch)` 後に `editingId` クリア
    - `onCancel`: `editingId` クリア
    - 削除・底値・「商品情報を編集」は変更しない
    `tests/routes/ProductDetailPage.test.tsx` を更新:
    - 既存の価格編集テストがあれば全項目 patch 期待に更新
    - 全項目保存で `updatePriceRecord` が呼ばれること
    - キャンセルで API 未呼び出し
    - 削除の既存テストは維持
  - Acceptance: 商品詳細から全項目の編集・キャンセル・削除ができる
  - Verify: `npm run test && npm run lint`
  - Files: `src/routes/ProductDetailPage.tsx`,
    `tests/routes/ProductDetailPage.test.tsx`
  - 依存: I42-T1 / 規模: M

### Checkpoint B
- [x] 商品詳細の履歴編集が H-1 の全項目に対応している

---

## Phase C: 仕上げ

- [x] **I42-T3: 親仕様整合 + 回帰確認**
  - 内容:
    - `docs/spec.md`: H-1 / 商品詳細 / Success Criteria
      「価格記録をあとから編集・削除できる」が実装と矛盾しないことを確認・必要なら追記
      (大書き換えは不要。未充足だった編集項目が揃った旨の整合が目的)
    - `docs/spec-issue42.md` / `plan` / `tasks` の Status を実装完了に更新
    - Success Criteria をテストと目視で確認
  - Acceptance: docs が矛盾しない。`npm run test && npm run lint && npm run build` が通る
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `docs/spec.md`, `docs/spec-issue42.md`,
    `docs/plan-issue42.md`, `docs/tasks-issue42.md`
  - 依存: I42-T2 / 規模: S

### Checkpoint: Complete
- [x] Issue #42 Success Criteria を満たす
- [x] 既存テスト全通過、レビュー可能な状態

---

## 実装時の注意

- TDD 推奨: 失敗するテスト → 実装 → 緑化の順(特に T1 / T2)
- 1 タスク完了ごとに Verify を通す。失敗したまま次タスクへ進まない
- `updatePriceRecord` / Firestore ルールは変更しない(不備発覚時は Ask first)
- コミットはユーザー依頼時のみ(勝手に push / commit しない)
