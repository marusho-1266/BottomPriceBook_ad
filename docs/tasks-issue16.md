# タスク分解: 悪用・スパム対策(Issue #16)

> Status: **Draft(承認待ち)** / 作成日: 2026-07-19
> 対象: `docs/spec-issue16.md` / 計画: `docs/plan-issue16.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: App Check SDK 導入(監視期間を稼ぐ)

- [x] **I16-T1: App Check 初期化コード(no-op ガード付き)**
  - 内容: `firebase/app-check` を使い `src/lib/appCheck.ts` に `initAppCheck()` を実装:
    - `VITE_FIREBASE_APPCHECK_SITE_KEY` 未設定、またはエミュレータ利用時
      (`VITE_FIREBASE_USE_EMULATORS === 'true'`)は **no-op**(初期化しない)
    - 設定時は `initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true })`
    - `main.tsx`(または `src/lib/firebase.ts`)の初期化フローに組み込む
    - functions の `deleteAccount` への `enforceAppCheck: true` は
      **このタスクでは付けない**(監視期間中の正規リクエスト拒否を避けるため
      Phase 4 の I16-T9 で付与する — plan の Open Question を「遅らせる」で確定)
  - Acceptance: 単体テストで「サイトキー未設定でも初期化がクラッシュしない」
    「エミュレータ時は初期化されない」がグリーン。既存テスト全通過
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/lib/appCheck.ts`, `src/main.tsx`(または `src/lib/firebase.ts`),
    `tests/lib/appCheck.test.ts`
  - 依存: なし / 規模: S

- [ ] **I16-T2: 手動セットアップ手順の文書化 + ユーザー作業依頼 + 監視開始**
  - 内容: 手順を docs に記載し、ユーザーに依頼する:
    1. Firebase コンソール → App Check → Web アプリを登録し、
       reCAPTCHA v3 サイトキーを発行(登録画面から作成可能)
    2. `.env.local` に `VITE_FIREBASE_APPCHECK_SITE_KEY` を追記
    3. デプロイ(`npm run deploy`。ユーザー承認のうえ実施)
    4. App Check メトリクスで「検証済みリクエスト」が記録され始めることを確認
    - **enforcement はまだ有効化しない**(Phase 4 まで監視モード)
  - Acceptance: 手順が人間だけで実行できる粒度で書かれており、
    メトリクスに検証済みリクエストが現れている
  - Verify: ドキュメント目視 + Firebase コンソールのメトリクス目視
  - Files: `README.md`(または `docs/` 配下のセットアップ手順)
  - 依存: I16-T1 / 規模: S

### Checkpoint 1(= plan の Phase 1 完了)
- [ ] 本番アプリが App Check トークンを送信し、メトリクスに検証済みリクエストが現れる
- [ ] エミュレータ環境・CI で App Check 関連の失敗が出ない(全テスト + CI グリーン)
- [ ] 以降のフェーズは監視をバックグラウンドに進行(T2 完了を待たず T3 へ進んでよい)

## Phase 2: ルール検証強化

- [x] **I16-T3: 検証ヘルパー + categories / stores / products のルール強化**
  - 内容: rules テストを**先に**書く(TDD):
    - 許可リスト外フィールドの書込拒否(3 コレクション)
    - name の境界値(空文字 NG / 100 文字 OK / 101 文字 NG)
    - categories: baseUnit が `['g','ml','個','枚','組','回分']` 以外は NG、
      sortOrder が int でない・負の値は NG(上限なし。`addCategory` が
      `Date.now()` をソートキーに使うため spec 修正済み)
    - products: categoryId 1〜100 文字、note は「無し or 0〜500 文字」
    - 既存正常系(シード書込・通常 CRUD)の回帰
    実装: `firestore.rules` の books スコープ内に検証ヘルパー
    (`isValidString(value, min, max)` 等)を定義。3 コレクションの
    `allow write` を create / update / delete に分離し、create / update に
    `keys().hasOnly(...)` + 型・長さ・範囲検証を追加(delete は現状維持)
  - Acceptance: 新規 rules テストと既存 rules テストがすべてグリーン
  - Verify: `npm run test:rules && npm run lint`
  - Files: `firestore.rules`, `tests/rules/`(該当テストファイル)
  - 依存: なし(T1 と独立)/ 規模: M

- [x] **I16-T4: priceRecords + members / invites のルール強化**
  - 内容: rules テスト先行:
    - priceRecords: `keys().hasOnly(['productId','storeId','price','quantity',
      'unit','isSale','recordedAt','note'])`、productId・storeId 1〜100 文字、
      price は number で 0 < x ≤ 10,000,000、quantity は number で 0 < x ≤ 1,000,000、
      unit 1〜100 文字、isSale は bool、recordedAt は timestamp、
      note は「無し or 0〜500 文字」。境界値(上限ちょうど OK / 超過 NG)を網羅
    - members: displayName 1〜100 文字を create 条件に追加
    - invites: bookName 1〜100 文字を create 条件に追加
    - 既存正常系(記録 CRUD・join バッチ・招待発行)の回帰
  - Acceptance: 新規 + 既存 rules テストがすべてグリーン
  - Verify: `npm run test:rules && npm run lint`
  - Files: `firestore.rules`, `tests/rules/`(該当テストファイル)
  - 依存: I16-T3(同一ファイル・ヘルパー利用)/ 規模: M

- [x] **I16-T5: books 本体の hasOnly + memberUids 上限**
  - 内容: **着手前に現行スキーマの突き合わせを必須で行う**:
    `src/types/models.ts` の Book 型・book 作成/更新コード
    (`features/books/` 等)・firestore.rules 内で参照されるフィールド
    (deleting 含む)を洗い出し、許可リストを確定する。
    その後 rules テスト先行で:
    - create / update に `keys().hasOnly([確定したリスト])` を追加
    - name: string 1〜100 文字 / memberUids: 要素数 1〜20
    - **join / leave / owner 更新・book 作成トランザクション(シード込み)の
      全正常系が回帰しないこと**を既存テストで確認
  - Acceptance: スキーマ突き合わせ結果がタスクコミットのメッセージまたは
    spec に記録され、新規 + 既存 rules テストがすべてグリーン
    - **確定した許可リスト**: `['name', 'ownerUid', 'memberUids',
      'bottomWindowMonths', 'createdAt', 'deleting']`(`src/types/models.ts`
      の Book 型 + `features/books/api.ts` の create/update + rules 内で
      参照される `deleting`(Admin SDK 専用)を突き合わせて確定)
    - memberUids 上限は 20(join は常に 1 人ずつ arrayUnion で追加されるため
      既存フローと非衝突)
  - Verify: `npm run test:rules && npm run test:e2e && npm run lint`
  - Files: `firestore.rules`, `tests/rules/`(該当テストファイル)
  - 依存: I16-T4 / 規模: M

### Checkpoint 2(= plan の Phase 2 完了)
- [x] `npm run test:rules` 全グリーン(新規検証テスト + 既存回帰。133 件)
- [ ] `npm run test:e2e` で記録・共有の主要フローが通る
      — **未達(既知の環境問題・本 Issue と無関係)**: `deleteAccount.*.e2e.test.ts` が
      `auth/email-already-in-use` で失敗。T3 適用前のベースラインでも同一失敗が
      再現することを確認済み(`git stash` で検証)。rules テスト(133 件。
      priceRecords/招待/join/leave の主要フローを含む)と単体テスト(251 件)で
      回帰は無いことを確認済み。e2e 環境の修復は本 Issue のスコープ外として
      別途対応が必要
- [ ] CI グリーン

## Phase 3: 書込レート制限

- [x] **I16-T6: rateLimits ルール + オフライン挙動検証(fail fast)**
  - 内容: rules テスト先行:
    - `books/{bookId}/rateLimits/{uid}`: create は本人 + メンバー +
      `lastWriteAt == request.time` + `keys().hasOnly(['lastWriteAt'])`。
      update は上記 + `request.time >= resource.data.lastWriteAt + duration.value(1,'s')`。
      read は本人のみ。delete は本人またはオーナー
    - categories / stores / products / priceRecords の create・update に
      `getAfter(...rateLimits/$(request.auth.uid)).data.lastWriteAt == request.time`
      を追加(同一バッチでの rateLimits 更新を強制)
    - テスト: rateLimits 未更新バッチの拒否 / 1 秒未満の連続書込拒否 /
      1 秒経過後の許可 / 単発書込(バッチあり)の許可
    - **オフライン挙動検証**: エミュレータでオフライン書込キューの連続コミットを
      再現し、レート制限違反で拒否されるかを確認。
      **拒否が発生する場合はここで停止し、方針協議**(spec Open Question)に戻る
  - Acceptance: 新規 rules テストがグリーン。既存の正常系テストは
    **この時点では失敗する**(クライアント未改修のため)— 失敗が
    「rateLimits 未更新」由来のみであることを確認して T7 へ進む
    (または既存テストのバッチ化修正を本タスクに含めて全グリーンにする)
    - **実施結果**: rateLimit.rules.test.ts(10 件)グリーン。既存テストは
      19 件が想定通り「rateLimits 未更新」由来で失敗(T7/T8 で解消予定)。
      `ensureBook()`(book 作成トランザクションでの categories シード)は
      同一トランザクション内で rateLimits doc も更新するよう修正が必要と判明
      (categories と同じく `isBookMemberAfterWrite()` ベースの判定が必要
      だったため、rateLimits の create/update も `isBookMember()` から
      `isBookMemberAfterWrite()` に変更)。この修正込みで ensureBook.test.ts
      は全グリーン
    - オフライン挙動検証: spec 記載の制約により rules-unit-testing での
      連続書込検証で代替(1 秒未満は拒否・1 秒以上で許可を確認。テスト内)
  - Verify: `npm run test:rules`(新規分)+ オフライン検証結果の記録
  - Files: `firestore.rules`, `tests/rules/`(該当テストファイル)
  - 依存: I16-T5(同一ファイル)/ 規模: L
  - **注意**: このタスク完了時点では main にマージしない(クライアント改修と
    セットで 1 PR にする。ルールだけデプロイすると本番の書込が全部落ちる)

- [ ] **I16-T7: rateLimit.ts ヘルパー + prices / stores の api.ts バッチ化**
  - 内容:
    - `src/lib/rateLimit.ts`: `withRateLimit(batch, bookId, uid)` 相当の
      共通ヘルパー(バッチに rateLimits doc の
      `{ lastWriteAt: serverTimestamp() }` 更新を積む)+ 単体テスト
    - 改修前に `addDoc` / `setDoc` / `updateDoc` の全呼び出し箇所を grep で
      棚卸しし、対象(コンテンツ 4 コレクションの create / update)を確定
    - `features/prices/api.ts` と `features/stores/api.ts` の create / update を
      `writeBatch`(対象 doc + rateLimits doc)に変更
    - 対応する rules テスト・単体テストをバッチ化に合わせて更新
  - Acceptance: prices / stores の既存単体テスト・rules テストがグリーン
    (バッチ化後の書込がルールを通過する)
  - Verify: `npm run test && npm run test:rules && npm run lint`
  - Files: `src/lib/rateLimit.ts`, `tests/lib/rateLimit.test.ts`,
    `src/features/prices/api.ts`, `src/features/stores/api.ts`
  - 依存: I16-T6(オフライン検証クリアが前提)/ 規模: M

- [ ] **I16-T8: products / categories の api.ts バッチ化 + 掃除経路確認**
  - 内容:
    - `features/products/api.ts` と `features/categories/api.ts`
      (book 作成時のシード書込含む — シードは book 作成トランザクション内のため
      レート制限対象外とするか実装時に確認)を writeBatch 化
    - `deleteAccount` の recursiveDelete で `rateLimits` サブコレクションが
      消えることを functions テストで確認(既存テストへのケース追加)
    - 全 feature のバッチ化完了後、既存テスト全体の回帰確認
  - Acceptance: 全単体テスト・全 rules テスト・functions テストがグリーン
  - Verify: `npm run test && npm run test:rules && npm run test:e2e &&
    cd functions && npm test`
  - Files: `src/features/products/api.ts`, `src/features/categories/api.ts`,
    `functions/src/`(テスト追加)、関連テストファイル
  - 依存: I16-T7 / 規模: M

### Checkpoint 3(= plan の Phase 3 完了)
- [ ] 全テスト(test / test:rules / test:e2e / functions)+ lint + CI グリーン
- [ ] 手動: エミュレータでアプリを操作し、通常速度の入力(連続フォーム送信含む)が
      一切阻害されないことを確認
- [ ] ルール + クライアントを **同一 PR / 同一デプロイ**で出すことを確認
      (ルール先行デプロイ禁止)

## Phase 4: enforcement 有効化・本番検証

- [ ] **I16-T9: enforceAppCheck 付与 + デプロイ + enforcement 段階有効化(ユーザー依頼)**
  - 内容:
    - functions の `deleteAccount` に `enforceAppCheck: true` を追加し、
      functions テストを更新
    - ルール・クライアント・functions をデプロイ(ユーザー承認のうえ実施)
    - App Check メトリクスで未検証リクエスト比率がほぼ 0 であることを確認
    - **Firestore → Functions → Auth の順に enforcement を有効化**(ユーザー作業)。
      Auth は Identity Platform アップグレードの要否をここで最終判断
      (見送る場合は Auth のみ監視モード継続と spec に記録)
    - 各有効化の**直後**に本番アプリで主要フロー(記録・編集・共有・退出)を手動確認。
      問題があれば即コンソールで enforcement を解除(ロールバック)
  - Acceptance: Firestore / Functions の enforcement が有効で、
    本番アプリの全機能が正常動作する(Auth は判断結果に従う)
  - Verify: 本番手動確認チェックリスト + `cd functions && npm test`
  - Files: `functions/src/index.ts`(または deleteAccount 定義箇所)、
    `functions/src/` テスト、手順 docs
  - 依存: Checkpoint 1〜3 完了 / 規模: M

- [ ] **I16-T10: 直接アクセス拒否確認 + 親仕様更新**
  - 内容:
    - Firestore REST API への直接アクセス(有効な ID トークンのみ・App Check
      トークン無し)が 403 で拒否されることを確認
    - 巨大ドキュメント・許可リスト外フィールドの書込が本番でも拒否されることを
      1 ケース確認(ルールデプロイの実効性確認)
    - `docs/spec.md` に Issue #16 を反映(セキュリティ節・Tech Stack)。
      spec / plan / tasks の Status を更新し、`docs/spec-issue16.md` の
      Success Criteria にチェックを記入(未達があれば修正タスクを起票)
  - Acceptance: Success Criteria の全項目にチェックが付く
  - Verify: 手動検証チェックリストの完了 + `npm run test && npm run lint`
  - Files: `docs/spec.md`, `docs/spec-issue16.md`, `docs/plan-issue16.md`,
    `docs/tasks-issue16.md`(Status 更新)
  - 依存: I16-T9 / 規模: S

### Checkpoint: 完了
- [ ] Success Criteria 全項目チェック済み・全 Verify グリーン
- [ ] デプロイ・enforcement 有効化は**人間の承認後**に実施

---

## 依存関係まとめ

```
T1 ──→ T2(手動・監視開始)─────────────────────────┐
 │      (T2 完了を待たず T3 へ進んでよい)          │(監視期間)
 └──→ T3 ──→ T4 ──→ T5 ─(Checkpoint 2)              │
              (firestore.rules を触るため直列)      │
             T5 ──→ T6 ──→ T7 ──→ T8 ─(Checkpoint 3)┤
              (T6 のオフライン検証 NG なら停止・協議)│
                                                    ▼
                                          T9(enforce)──→ T10(完了)
```

- T3〜T6 は firestore.rules を共有するため直列。T7 / T8 は feature 単位で
  独立だが単独セッションでは直列に進める
- T6 完了時点のルールはクライアント未改修と非互換のため、
  **T6〜T8 は同一 PR にまとめて main へマージ・デプロイする**
- T9 / T10 はユーザーの手動作業(コンソール操作・本番確認)を含む
