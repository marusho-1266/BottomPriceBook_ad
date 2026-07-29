# タスク分解: 設定に商品管理を追加(Issue #40)

> Status: **In Progress** / 作成日: 2026-07-29
> 対象: `docs/spec-issue40.md`(Approved) / 計画: `docs/plan-issue40.md`(Approved)
> 実装は 1 タスク = 1 コミット相当で進める。各タスクの Verify を通してから次へ。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase A: 共通フォーム / API

- [x] **I40-T1: `ProductForm` にメモ欄を追加**
  - 内容: `ProductFormValues` に `note?: string` を追加。任意入力のメモ欄を表示。
    初期値は `initial?.note ?? ''`。トリム後に空なら `note: ''` として submit。
    クライアント側で最大 500 文字(ルールと整合)。超過時はエラー表示して submit しない。
    既存の名前必須・カテゴリ必須・M-1 制限は維持。
    `tests/features/products/ProductForm.test.tsx` を更新(メモ付き submit・上限)
  - Acceptance: メモを含めて submit できる。501 文字は拒否。編集時 M-1 が壊れていない
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/products/ProductForm.tsx`,
    `tests/features/products/ProductForm.test.tsx`
  - 依存: なし / 規模: S

- [ ] **I40-T2: `addProduct` / `updateProduct` に `note` を配線**
  - 内容: 両 API の入力型に `note?: string` を追加し、Firestore へ書き込む。
    新規で未指定ならフィールド省略または `''` のいずれか(空文字で統一してよい)。
    更新で `note` を渡したときのみパッチに含める(空文字クリアを含む)。
    RecordPage の `addProduct` 呼び出しが型エラーにならないよう追随
    (フォームから note が来る場合はそのまま渡す)
  - Acceptance: 型と実装が note 対応。既存 Record / ProductForm 系テストがグリーン
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/products/api.ts`,
    必要なら `src/routes/RecordPage.tsx`(型追随のみ)
  - 依存: I40-T1 / 規模: S

### Checkpoint A
- [ ] ProductForm + products API がメモ対応し、記録画面の登録回帰が通る

---

## Phase B: 商品管理画面と導線

- [ ] **I40-T3: `ProductsPage` + ルート + 設定リンク**
  - 内容: `ProductsPage` を新規作成。
    - ヘッダー: 「商品管理」→ 戻る `/settings`
    - 上部: 追加用 `ProductForm`(「登録」)。成功後フォームをリセット
    - 一覧: 商品名 + カテゴリ名(不明時は既存フォールバック)。メモありは要約または表示
    - 行: 「編集」で `ProductForm`(initial +「保存」)、「削除」で confirm 後
      `deleteProductWithRecords`
    - confirm に商品名と配下記録削除の旨を含める
    `App.tsx` に `settings/products` ルート、`SettingsPage` に「商品管理」リンクを追加。
    コンポーネントテストで登録・編集・削除(confirm 同意時のみ API)を検証
  - Acceptance: 設定から商品管理を開き、登録・編集・削除ができる
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/products/ProductsPage.tsx`,
    `tests/features/products/ProductsPage.test.tsx`,
    `src/App.tsx`, `src/routes/SettingsPage.tsx`,
    必要なら Settings 系テスト
  - 依存: I40-T2 / 規模: M

- [ ] **I40-T4: `?edit=` deep-link + 商品詳細からの導線**
  - 内容: `ProductsPage` が `?edit=:productId` を読み、該当商品を初期編集モードにする
    (存在しない ID は無視)。
    `ProductDetailPage` に「商品情報を編集」リンク
    (`/settings/products?edit=${product.id}`)を履歴編集と離して配置。
    テストで導線と `?edit=` 起動を検証。PC 右ペインには編集導線を追加しない
  - Acceptance: 商品詳細から商品管理へ進み、対象が編集モードになる
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/products/ProductsPage.tsx`,
    `src/routes/ProductDetailPage.tsx`,
    `tests/features/products/ProductsPage.test.tsx`,
    `tests/routes/ProductDetailPage.test.tsx`
  - 依存: I40-T3 / 規模: S

### Checkpoint B
- [ ] 設定・商品詳細の両方から商品マスタ編集に到達できる
- [ ] 記録画面のその場登録が健在

---

## Phase C: 仕上げ

- [ ] **I40-T5: 親仕様・Issue #32 整合 + 回帰確認**
  - 内容:
    - `docs/spec.md`: 画面構成「設定」に商品管理を追記。必要なら商品詳細に
      マスタ編集導線の一文を追加
    - `docs/spec-issue32.md`: 「編集・削除は商品詳細」を
      **価格記録の編集・削除**に限定し、商品マスタは設定の商品管理である旨を追記
    - `docs/spec-issue40.md` / `plan` / `tasks` の Status を実装完了に更新
    - Success Criteria を満たすことをテストと目視で確認
  - Acceptance: docs が矛盾しない。`npm run test && npm run lint && npm run build` が通る
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `docs/spec.md`, `docs/spec-issue32.md`, `docs/spec-issue40.md`,
    `docs/plan-issue40.md`, `docs/tasks-issue40.md`
  - 依存: I40-T4 / 規模: S

### Checkpoint: Complete
- [ ] Issue #40 Success Criteria を満たす
- [ ] 既存テスト全通過、レビュー可能な状態

---

## 実装時の注意

- TDD 推奨: 失敗するテスト → 実装 → 緑化の順(特に T1 / T3 / T4)
- 1 タスク完了ごとに Verify を通す。失敗したまま次タスクへ進まない
- コミットはユーザー依頼時のみ(勝手に push / commit しない)
