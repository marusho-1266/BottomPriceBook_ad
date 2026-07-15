# タスク分解: カテゴリ編集で基準単位も変更可能にする(Issue #3)

> Status: **I3-T1〜T4 完了(2026-07-15)** / 作成日: 2026-07-15 / 最終更新: 2026-07-15
> 対象: `docs/spec-issue3.md` / 計画: `docs/plan-issue3.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

- [x] **I3-T1: 単位合わせ純関数 `relabelRecordToBaseUnit`**
  - 内容: `src/lib/units.ts` に `relabelRecordToBaseUnit` を追加。
    旧 `baseUnit` で `toBaseQuantity` 正規化し、成功時は
    `{ quantity: normalized, unit: toBaseUnit }`、
    不整合時は `{ quantity, unit: toBaseUnit }` を返す。
    単体テストを `tests/lib/units.test.ts`(既存があれば追記)に追加し、
    spec Testing Strategy の 4 ケースをカバーする
  - Acceptance: 上記 4 ケース(kg→正規化後リラベル、L→正規化後リラベル、
    個→枚、不整合フォールバック)がすべてグリーン
  - Verify: `npm run test && npm run lint`
  - Files: `src/lib/units.ts`, `tests/lib/units.test.ts`(または同等)
  - 依存: なし / 規模: S

- [x] **I3-T2: カテゴリ更新 API `updateCategory`(記録の一括リラベル含む)**
  - 内容: `renameCategory` を `updateCategory` に置換(または同等拡張)。
    `{ name, baseUnit }` でカテゴリを更新し、
    `previousBaseUnit !== baseUnit` かつ所属商品があるときだけ
    配下 `priceRecords` に `relabelRecordToBaseUnit` を適用して分割バッチ更新する。
    商品 ID の取得は呼び出し側から渡すか API 内で解決してもよい。
    Firestore `in` 上限を避けるため、商品単位クエリまたは全件フィルタを使う。
    API 単体テスト(モック可)で「名称のみは記録更新なし」「baseUnit 変更時は記録更新」を検証
  - Acceptance: 仕様の `updateCategory` 分岐どおり動く。
    バッチ分割パターンは `deleteProductWithRecords` に準拠
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/categories/api.ts` および/または
    `src/features/categories/updateCategory.ts`(仮称)、対応テスト
  - 依存: I3-T1 / 規模: M

- [x] **I3-T3: CategoriesPage 編集 UI・確認ダイアログ・案内文**
  - 内容: 編集モードに基準単位セレクトを追加。
    baseUnit 変更かつ商品 ≥ 1 のとき confirm(仕様の文言要件)。
    キャンセル時は保存しない。同意または確認不要時に `updateCategory` を呼ぶ。
    「基準単位はあとから変更できません」を新案内に差し替え。
    `CategoriesPage.test.tsx` を更新・拡充する
  - Acceptance: Success Criteria の UI 項目
    (編集で名称+基準単位、confirm の有無、キャンセル、案内文)を満たす
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/features/categories/CategoriesPage.tsx`,
    `tests/features/categories/CategoriesPage.test.tsx`
  - 依存: I3-T2 / 規模: S

- [x] **I3-T4: 親仕様 `docs/spec.md` の整合更新**
  - 内容: カテゴリ `baseUnit` が作成後も変更可能であること、
    所属商品がある場合の確認と「正規化→リラベル」(物理換算ではない)を明記。
    商品のカテゴリ変更制限(同一 baseUnit のみ)は維持する旨を残す。
    `docs/spec-issue3.md` の Success Criteria / Status を実装完了に合わせて更新
  - Acceptance: 親仕様と issue3 仕様が矛盾しない。Success Criteria がすべてチェック済み
  - Verify: ドキュメント差分の目視 + `npm run test && npm run lint`
  - Files: `docs/spec.md`, `docs/spec-issue3.md`, `docs/tasks-issue3.md`,
    `docs/plan-issue3.md`(Status 更新)
  - 依存: I3-T3 / 規模: S
