# Spec: Issue #16 悪用・スパム対策

> Status: **Draft(ヒアリング確定・実装前)** / 作成: 2026-07-19
> 対象 Issue: [#16 悪用・スパム対策](https://github.com/marusho-1266/BottomPriceBook_ad/issues/16)
> 親仕様: `docs/spec.md` / 関連: `firestore.rules` 全体、`docs/spec-issue7.md`(招待・共有)、`docs/spec-issue13.md`(Cloud Functions 基盤)

## ヒアリング結果(2026-07-19 確定)

1. **App Check**: 導入し、Firestore / Auth / Cloud Functions で **強制(enforce)まで有効化**する。
   プロバイダは reCAPTCHA v3。ローカル開発・CI はエミュレータ(App Check 検証なし)で回避する
2. **フィールド検証の上限値**: 以下の提案値で確定
   - 文字列(name / unit): 100 文字以内
   - note: 500 文字以内
   - price: 0 < price ≤ 10,000,000(円)
   - quantity: 0 < quantity ≤ 1,000,000
   - 全コレクションに `keys().hasOnly(...)` でフィールド許可リスト
   - sortOrder: 0 ≤ sortOrder ≤ 10,000 の整数
3. **書込レート制限**: Firestore ルールでの簡易制限を採用。ユーザーごとの最終書込時刻ドキュメントを
   使い「直前の書込から一定間隔(1 秒)以上」をルールで強制する。Cloud Functions 経由化は行わない

## 前提(仮定 — 誤りがあれば指摘してください)

1. **App Check の Firebase コンソール作業は手動**で行う(ユーザー本人):
   reCAPTCHA v3 サイトキーの発行(App Check のアプリ登録画面から作成可能)、
   Web アプリの App Check 登録、Firestore / Auth / Functions の enforcement 有効化
2. **Auth の App Check 強制には Identity Platform へのアップグレードが必要**
   (無料枠内で利用可能だが、コンソールでのアップグレード操作が必要)。
   アップグレードを見送る場合、Auth のみ「監視モード」に留め、Firestore / Functions は強制する
3. reCAPTCHA v3 のサイトキーは公開情報(HTML に埋め込まれる)のため、
   `VITE_FIREBASE_APPCHECK_SITE_KEY` として `.env.local` で管理し、ビルドに埋め込んでよい
   (既存の Firebase 設定と同様の扱い。リポジトリにはコミットしない)
4. エミュレータ環境(`VITE_FIREBASE_USE_EMULATORS=true`)では App Check を初期化しない。
   エミュレータは App Check トークンを検証しないため、既存の `test:rules` / `test:e2e` /
   ローカル開発はそのまま動作する
5. 本番ビルドをローカルで検証する必要が生じた場合はデバッグトークン
   (`self.FIREBASE_APPCHECK_DEBUG_TOKEN`)を使う。デバッグトークンはコンソールで発行し、
   コミットしない
6. レート制限の間隔は **1 秒**とする。通常の手入力操作(フォーム送信)では 1 秒未満の連続書込は
   起きない想定。招待制の少人数利用のため、これで悪用コスト(無制限の自動書込)は十分上がる
7. レート制限の対象は **メンバーが書けるコンテンツ系コレクション**
   (categories / stores / products / priceRecords の create・update)とする。
   join / leave / 招待発行は既存ルールで構造が厳しく縛られており対象外
8. ルール変更に伴い、**クライアントの書込処理はレート制限ドキュメントとのバッチ書込に変更**が必要
   (`features/*/api.ts` の改修)。オフライン永続化(M-4)のオフライン書込キューが再接続時に
   連続コミットされると 1 秒間隔に違反して拒否されるリスクがある(下記「リスク」参照)

## Objective

### 何を作るか

Firebase API キーは公開情報であるため、現状ではアプリ外から Firestore / Auth を直接叩ける。
また、招待で参加したメンバーは任意フィールド・巨大ドキュメントを無制限に書き込める。
本 Issue では以下の 3 層で悪用・スパムのコストを引き上げる:

1. **App Check(enforce)** — 正規のアプリ(reCAPTCHA v3 で検証されたブラウザ)以外からの
   Firestore / Auth / Cloud Functions アクセスを遮断する
2. **ルールのフィールド検証強化** — 全コレクションにフィールド許可リスト
   (`keys().hasOnly`)と型・文字列長・数値上限の検証を追加し、巨大ドキュメントや
   任意フィールドの書込を防ぐ
3. **書込レート制限** — メンバーの書込を「1 秒に 1 回」にルールで制限し、
   自動化された大量書込(ストレージ・課金の膨張)を防ぐ

### ユーザーストーリー

- 開発者として、API キーが漏れても(公開されていても)アプリ外から DB を直接操作されたくない
- 開発者として、招待したメンバーの端末が悪意あるスクリプトに乗っ取られても、
  書き込めるデータの形・サイズ・頻度を制限して被害を限定したい
- 利用者として、これらの対策で通常の操作(記録・編集・共有)が一切阻害されないでほしい

## 実装内容

### 1. App Check(reCAPTCHA v3・enforce)

| 対象 | 内容 |
|---|---|
| SDK 導入 | `firebase/app-check` の `initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true })` を `src/lib/firebase.ts`(または分離した `src/lib/appCheck.ts`)で実行 |
| 環境分離 | `VITE_FIREBASE_USE_EMULATORS=true` のときは初期化しない。サイトキーは `VITE_FIREBASE_APPCHECK_SITE_KEY`(`.env.local`) |
| デバッグ | サイトキー未設定時は初期化スキップ(DSN 未設定でも動く Sentry と同じ方針)。必要時のみデバッグトークンで本番ビルドをローカル検証 |
| Functions | `deleteAccount`(callable v2)に `enforceAppCheck: true` を追加 |
| コンソール作業(手動) | ① reCAPTCHA v3 キー発行 + App Check アプリ登録 ② メトリクスで「検証済みリクエスト」比率を確認 ③ Firestore → Functions → Auth の順に enforcement 有効化(Auth は Identity Platform アップグレード後) |

導入手順は「SDK 導入 → 監視(メトリクス確認)→ 強制有効化」の段階を踏む。
コード変更は SDK 導入までで完結し、強制の ON はコンソール操作のみ(ロールバックもコンソールで即時可能)。

### 2. ルールのフィールド検証強化(firestore.rules)

各コレクションの create / update に以下を追加する(delete は現状維持)。
`allow write` でまとめている stores / products / categories は create / update / delete に分離する。

| コレクション | 許可フィールド(hasOnly) | 検証 |
|---|---|---|
| categories | name, baseUnit, sortOrder | name: string 1〜100 文字 / baseUnit: `['g','ml','個','枚','組','回分']` のいずれか / sortOrder: int 0〜10,000 |
| stores | name | name: string 1〜100 文字 |
| products | name, categoryId, note | name: string 1〜100 文字 / categoryId: string 1〜100 文字 / note: string 0〜500 文字(任意) |
| priceRecords | productId, storeId, price, quantity, unit, isSale, recordedAt, note | productId・storeId: string 1〜100 文字 / price: number 0 < x ≤ 10,000,000 / quantity: number 0 < x ≤ 1,000,000 / unit: string 1〜100 文字 / isSale: bool / recordedAt: timestamp / note: string 0〜500 文字(任意) |
| members(追加強化) | 既存 hasOnly あり | displayName: string 1〜100 文字(現状長さ検証なしのため追加) |
| invites(追加強化) | 既存 hasOnly あり | bookName: string 1〜100 文字(現状検証なしのため追加) |
| books(追加強化) | name, ownerUid, memberUids, createdAt, deleting を hasOnly で固定 | name: string 1〜100 文字 / memberUids: 要素数上限(例 20)を追加 |

- 共通の検証ヘルパー関数(`isValidString(value, min, max)` 等)をルール内に定義して重複を避ける
- 任意フィールド(note)は「存在しない or 検証を満たす」の形で書く
- クライアント側バリデーション(`features/*/api.ts`・フォーム)は現状のまま。
  ルールは最終防衛線であり、UX 上のエラーメッセージはクライアント責務(既存方針を踏襲)

> **注意(books の hasOnly)**: books 本体のフィールド構成は実装時に既存ドキュメントと
> 突き合わせて確定する。既存データに存在するフィールドを許可リストから漏らすと
> 正規の更新が全部落ちるため、実装タスクで現行スキーマの確認を必須とする。

### 3. 書込レート制限(ルール + クライアントのバッチ書込)

**データモデル**: `books/{bookId}/rateLimits/{uid}` — フィールドは `lastWriteAt: timestamp` のみ。

**ルール**:

- `rateLimits/{uid}`:
  - create: 本人(`uid == request.auth.uid`)かつメンバー、`lastWriteAt == request.time`、`keys().hasOnly(['lastWriteAt'])`
  - update: 上記に加え `request.time >= resource.data.lastWriteAt + duration.value(1, 's')`
  - read: 本人のみ / delete: 本人またはオーナー(退会・削除時の掃除経路)
- categories / stores / products / priceRecords の create・update に条件を追加:
  `getAfter(/databases/$(db)/documents/books/$(bookId)/rateLimits/$(request.auth.uid)).data.lastWriteAt == request.time`
  (同一バッチで rateLimits doc を serverTimestamp で更新していることを強制。
  rateLimits 側のルールが「前回から 1 秒以上」を保証する)

**クライアント**: `features/categories|stores|products|prices` の各 `api.ts` の
create / update を `writeBatch`(対象 doc + rateLimits doc の 2 書込)に変更する。
共通ヘルパー `src/lib/rateLimit.ts`(バッチに rateLimits 更新を積む関数)を作り重複を避ける。

**リスク と対応**:

| リスク | 対応 |
|---|---|
| オフライン書込キューの再接続時連続コミットが 1 秒間隔に違反 → 後続書込が拒否されサイレントにデータ消失 | 実装時に rules テストで挙動を確認。拒否が確認された場合は Open Question として対応方針(間隔短縮・オフライン時の書込抑止 UI 等)を協議してから実装を確定する |
| 書込ごとに 1 ドキュメント書込が追加(書込コスト 2 倍) | 少人数利用のため無料枠内。許容する |
| recursiveDelete(退会)で rateLimits サブコレクションも消す必要 | `deleteAccount` は book 配下を recursiveDelete するため自動で消える(確認をタスクに含める) |

## Tech Stack(追加分)

| 領域 | 技術 | 理由 |
|---|---|---|
| 不正クライアント遮断 | Firebase App Check + reCAPTCHA v3 | Firebase 公式の標準対策。無料(reCAPTCHA v3 は月 1 万評価まで無料枠) |
| 検証・レート制限 | Firestore Security Rules | 追加インフラ不要。既存の test:rules で検証可能 |

## Commands(追加分)

```
既存: npm run test:rules   → ルール変更の検証(今回のメイン)
既存: npm run test         → api.ts のバッチ書込化の単体テスト
既存: npm run test:e2e     → 主要フロー(記録・共有)が壊れていないことの確認
```

## Project Structure(追加分)

```
firestore.rules            → 検証強化 + rateLimits ルール追加(既存ファイル修正)
src/lib/rateLimit.ts       → バッチに rateLimits 更新を積む共通ヘルパー(新規)
src/lib/firebase.ts        → App Check 初期化を追加(既存ファイル修正)
src/features/*/api.ts      → create/update を writeBatch 化(既存ファイル修正)
tests/rules/               → 検証・レート制限の rules テスト追加(既存ディレクトリ)
```

## Code Style

親仕様 `docs/spec.md` から変更なし。ルール内コメントは既存の firestore.rules の書き方
(日本語コメントで意図と Issue 番号を記す)を踏襲する。

## Testing Strategy(本 Issue 分)

| レベル | 対象 |
|---|---|
| rules テスト(test:rules) | ① 許可リスト外フィールドの書込拒否(全コレクション) ② 文字列長・数値上限の境界値(上限ちょうど OK / 超過 NG) ③ レート制限: rateLimits 未更新バッチの拒否、1 秒未満の連続書込拒否、1 秒経過後の許可 ④ 既存の正常系テストが全部通る(regression) |
| 単体(test) | `rateLimit.ts` ヘルパー / 各 api.ts のバッチ化後も既存テストが通る |
| e2e(test:e2e) | 記録追加 → 編集の主要フローが通る(エミュレータは App Check 検証なしのため App Check の e2e は対象外) |
| 手動(本番) | App Check: enforcement 有効化後、本番アプリで通常操作が全部通ること + curl 等の直接 REST アクセスが 403 になることを確認 |

**注意**: エミュレータは App Check を検証しないため、App Check の自動テストは不可。
enforcement は「メトリクス確認 → 有効化 → 手動確認」の運用手順でカバーする。

## Boundaries(本 Issue 固有)

- **Always**
  - ルール変更は必ず rules テストを先に書いてから行う(既存 test:rules の方針踏襲)
  - 既存の正常系(記録・編集・共有・退出・退会)を壊さないことを test:rules / test:e2e で確認する
  - reCAPTCHA サイトキー等の設定値は `.env.local` 管理でコミットしない
- **Ask first**
  - Firebase コンソールでの enforcement 有効化(Firestore / Functions / Auth それぞれ)の実施タイミング
  - Identity Platform へのアップグレード(Auth の enforce に必要)
  - レート制限間隔(1 秒)の変更、オフライン書込リスクへの対応方針の変更
- **Never**
  - App Check のデバッグトークンをコミット・共有しない
  - enforcement を検証(メトリクス確認)なしで有効化しない(正規ユーザーの誤ブロック防止)
  - 既存の rules テストを弱める方向に書き換えない

## Success Criteria

- [ ] App Check SDK が本番ビルドで初期化され、コンソールのメトリクスで検証済みリクエストが確認できる
- [ ] Firestore / Cloud Functions(deleteAccount)/ Auth の enforcement が有効化され、アプリ外からの直接アクセス(REST)が拒否される
- [ ] enforcement 有効化後も、正規アプリの全機能(記録・編集・共有・退出・退会)が正常に動作する
- [ ] 全コレクションで許可リスト外フィールド・上限超過の書込がルールで拒否される(rules テストで検証)
- [ ] 1 秒未満の連続書込がルールで拒否され、通常操作は阻害されない(rules テスト + e2e で検証)
- [ ] 既存テスト(`test` / `test:rules` / `test:e2e` / functions の `npm test`)がすべて通る

## 将来スコープ(本 Issue に含めない)

- Cloud Functions 経由の書込への全面移行(サーバーサイドの厳密なレート制限)
- 1 ユーザーあたりのドキュメント総数上限(ストレージクォータ)
- 通報・モデレーション機能
- App Check の reCAPTCHA Enterprise への移行(トラフィック増加時)

## Open Questions

- Auth の enforce に必要な Identity Platform アップグレードを行うか
  (見送る場合、Auth のみ監視モード継続。前提 2 参照)
- オフライン書込キューの連続コミットがレート制限に違反した場合の対応方針
  (実装時の rules テストで実挙動を確認してから協議。実装内容 3 のリスク表参照)
