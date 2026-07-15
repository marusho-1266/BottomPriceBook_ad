# Spec: 底値帳 Web アプリ「そこねこ」

> Status: **Approved(承認済み・2026-07-12)** / 最終更新: 2026-07-15
> (2026-07-15: Issue #3 によりカテゴリ baseUnit の事後変更を許可。詳細は `docs/spec-issue3.md`)
>
> このドキュメントは spec-driven development の Phase 1 (Specify) 成果物。
> レビュー記録: `docs/spec-review-2026-07-12.md`
> (初回指摘 12 件 + 再レビュー指摘 M-5, L-5〜L-7 をすべて反映のうえ承認)

## 前提(ヒアリング結果に基づく仮定)

1. Web アプリ(PWA)であり、ネイティブアプリは作らない
2. 利用者は当面「本人+知り合い」。将来サービス化(不特定多数への公開)の可能性あり
3. スマホがメイン利用デバイス(店頭で使う)。モバイルファースト UI
4. オフラインで閲覧・記録ができ、オンライン復帰時に自動同期される
5. データは BaaS(Firebase)に保存。複数端末から同じデータを参照できる
6. 通貨は日本円のみ。多言語対応は不要(日本語 UI のみ)
7. 価格は税込価格のみで記録する(税抜入力は非対応)
8. アプリ名は「そこねこ」(英語識別子: sokoneko)

## Objective

### 何を作るか

スーパー・ドラッグストア等で見かけた商品価格を都度記録し、
「この商品はどの店でいくらが底値か」を一目で確認できる **底値帳 PWA**。

### 誰のためか

- 日常の買い物で「今この価格は買いか?」を判断したい人(まずは開発者本人と知り合い)

### ユーザーストーリー(MVP)

- 買い物客として、店頭で商品の価格をその場で記録したい(オフラインでも)
- 買い物客として、商品ごとの底値と底値の店舗を一覧で確認したい
- 買い物客として、内容量が違う商品同士を「100g あたり」等の単価で比較したい
- 買い物客として、同一商品だけでなく「食器用洗剤」「ティッシュ」等のカテゴリ内で商品横断の単価比較をしたい
- 買い物客として、特売価格と通常価格を区別して記録・確認したい
- 買い物客として、誤って入力した価格記録をあとから修正・削除したい(H-1)

### 共有モデル

- MVP は**個人専用**の底値帳
- ただし将来「知り合いとの共有」「サービス化」を見据え、データは
  `users/{uid}` 直下ではなく **`books/{bookId}`(底値帳単位)+ メンバー配列** で持つ。
  MVP では 1 ユーザー = 1 book を自動作成し、共有 UI は作らない
- **MVP では `bookId = uid` の決定的 ID とする**(H-4)。
  複数端末での同時初回ログインやオフライン起動でも book が二重作成されず、
  自分の book はクエリ不要で直接参照できる。
  将来の複数 book / 共有時は `memberUids array-contains uid` クエリに移行する

## Tech Stack

| 領域 | 技術 | 理由 |
|---|---|---|
| フロントエンド | React 19 + TypeScript + Vite | SPA で十分。SSR 不要(認証必須アプリで SEO 不要) |
| UI | Tailwind CSS v4 | モバイルファーストの実装が速い |
| PWA / オフライン | vite-plugin-pwa (Workbox) + Firestore オフライン永続化 | アプリシェルのキャッシュ + データのオフライン書込→自動同期。永続化は `persistentLocalCache` + `persistentMultipleTabManager`(複数タブ対応)。SW 更新は `registerType: 'prompt'`(更新プロンプト方式。オフライン中の意図しない更新事故を防ぐ)(L-3) |
| 認証 | Firebase Authentication | Google ログイン + メール/パスワード |
| DB | Cloud Firestore | オフライン永続化が標準搭載。無料枠が広い |
| ホスティング | Firebase Hosting | 無料枠。Firebase と一体運用 |
| 状態管理 | Firestore onSnapshot + 自前フック(`useCollection` 等) | リアルタイム購読が主のため TanStack Query は採用しない。キャッシュの真実のソースを Firestore SDK に一本化(M-2)。ローカル UI 状態は React 標準 |
| ルーティング | React Router v7 | SPA 標準 |
| テスト | Vitest + React Testing Library / Firebase Emulator Suite | 単体・コンポーネント / セキュリティルール検証 |
| Lint / Format | ESLint + Prettier | 標準構成 |

## Commands

```
セットアップ:  npm install
開発サーバー:  npm run dev
ビルド:        npm run build
プレビュー:    npm run preview
テスト:        npm run test          (vitest run)
テスト(監視): npm run test:watch
ルールテスト:  npm run test:rules    (Firebase Emulator でセキュリティルール検証)
Lint:          npm run lint
Format:        npm run format
エミュレータ:  npm run emulators     (firebase emulators:start)
デプロイ:      npm run deploy        (build + firebase deploy)
```

## Project Structure

```
docs/               → 仕様書・ADR
src/
  components/       → 汎用 UI コンポーネント
  features/         → 機能単位のモジュール
    auth/           → ログイン・サインアップ
    products/       → 商品(登録・一覧・詳細)
    stores/         → 店舗管理
    categories/     → カテゴリ管理(基準単位を含む)
    prices/         → 価格記録・底値一覧・単価比較
  lib/              → Firebase 初期化・単位換算などの共有ロジック
  routes/           → 画面(ページ)コンポーネント
  types/            → 型定義(Firestore ドキュメント型など)
tests/              → 単体・コンポーネントテスト(src と同構造)
firestore.rules     → Firestore セキュリティルール
firestore.indexes.json
firebase.json
```

## データモデル(Firestore)

```
books/{bookId}
  name: string                  // 例: "うちの底値帳"
  ownerUid: string
  memberUids: string[]          // MVP では owner のみ。将来の共有用
  bottomWindowMonths: number    // 底値の対象期間。0 = 全期間。デフォルト 6
  createdAt: Timestamp

books/{bookId}/categories/{categoryId}
  name: string                  // 例: "食器用洗剤"
  baseUnit: "g" | "ml" | "個" | "枚" | "組" | "回分"
  sortOrder: number

books/{bookId}/stores/{storeId}
  name: string                  // 自由入力。例: "OKストア 〇〇店"

books/{bookId}/products/{productId}
  name: string                  // 例: "キュキュット 本体 240ml"
  categoryId: string
  note: string?

books/{bookId}/priceRecords/{recordId}
  productId: string
  storeId: string
  price: number                 // 税込・円
  quantity: number              // 内容量(数値)。複合内容量は総量で入力。例: 240
  unit: string                  // baseUnit またはその上位単位(→「単位と換算」)。例: "ml", "L"
  isSale: boolean               // 特売フラグ
  recordedAt: Timestamp         // 見かけた/買った日
  note: string?
```

- **底値の算出**: サーバ側で集計せず、クライアントが book 内の priceRecords を購読して
  商品×店舗ごとの最安値・単価(price / quantity)を計算する。
  個人利用のデータ量(数百〜数千レコード)では十分高速。将来スケール時に非正規化を検討
- **底値の定義**: 「直近 N ヶ月の最安値」。デフォルト N=6 で、設定画面から変更可
  (全期間 / 3 / 6 / 12 ヶ月)。期間外の記録も履歴としては保持する
- **底値と特売の関係**(H-3): ホーム等に表示する「底値」は**特売込みの最安値**とする。
  特売記録が底値のときは特売バッジを付けて区別表示し、商品詳細では
  「特売込みの底値」と「通常価格のみの底値」を併記する。
  特売記録しかない商品では通常価格のみの底値は算出不能のため「該当なし(—)」を表示する(L-6)
- **単価比較**: 同一カテゴリ内の商品は baseUnit に揃えて「基準単位あたりの円」を算出し比較
- **初期データ**(M-5): 初回ログイン時に book(`bookId = uid`)を自動作成し、代表的なカテゴリ
  (食品(g)、飲料(ml)、洗剤(ml)、ティッシュ(組) など)をシードする。
  - 初期化処理は **`getDoc` で存在確認し、存在しない場合のみ作成**する
    (初回ログインは必ずオンラインのため確認可能)。
    `setDoc` の無条件実行は、2 台目の端末での初回ログイン時に
    ユーザー変更済みの `name` / `bottomWindowMonths` をデフォルト値で
    上書きしてしまうため行わない
  - 防御として、初期化処理の書き込みは **create 専用**にする
    (トランザクションで存在確認+作成をアトミックに行う)。
    セキュリティルールでは create / update を区別し、update 時は
    `ownerUid` `createdAt` の不変を検証する(設定画面からの
    `name` / `bottomWindowMonths` の正当な更新は許可)
  - シードするカテゴリの ID は `food` `drink` `detergent` `tissue` 等の
    **決定的 ID** とし、途中失敗後の再実行でも重複しないようにする

### 単位と換算(M-1)

- `priceRecords.unit` に許容するのは **カテゴリの baseUnit とその上位単位のみ**:
  - baseUnit `g` → 入力可: `g` / `kg`(×1000)
  - baseUnit `ml` → 入力可: `ml` / `L`(×1000)
  - baseUnit `個` `枚` `組` `回分` → その単位のみ(換算なし)
- 単価計算時は常に baseUnit に換算してから比較する(例: 米 5kg 1,980円 → 0.396円/g)
- 複合内容量(例: ティッシュ 5箱パック × 160組)は**総量を入力**する(→ 800組)。
  入力 UI にその旨のヒントを表示する(L-4)
- **カテゴリの baseUnit 変更**(Issue #3): 作成後も変更可能。
  所属商品が 1 件以上ある場合は確認のうえ、配下 `priceRecords` を
  「旧 baseUnit へ数量正規化 → 新 baseUnit へ unit リラベル」する。
  これは物理換算ではない(詳細: `docs/spec-issue3.md`)
- **商品のカテゴリ変更**: 単位系が同じ(baseUnit が同一)カテゴリへの変更のみ許可。
  単位系が異なるカテゴリへの変更は UI でブロックし、
  「新しい商品として登録し直す」ことを案内する

### 記録の編集・削除と参照整合性(H-1 / H-2)

- **価格記録**: 編集(価格・内容量・特売フラグ・日付・店舗)と削除を MVP に含める。
  商品詳細の履歴一覧から操作する
- **商品の削除**: 確認ダイアログを出したうえで、配下の priceRecords も
  クライアントのバッチ処理でまとめて削除する。
  Firestore の 1 バッチ 500 書き込み上限があるため、記録が多い商品では分割バッチにする(L-5)。
  途中失敗で孤児 priceRecords が残っても、どの画面からも参照されないため実害は小さい
- **店舗・カテゴリの削除**: priceRecords / products から参照されている間は削除禁止
  (UI で件数を提示してブロック)。参照がなくなれば削除可。
  この削除禁止はクライアント(UI)側のみの制御であり、セキュリティルールでは強制しない。
  孤児フォールバック表示があるため MVP では意図的にこの割り切りとする(L-7)
- **孤児レコードの表示フォールバック**: オフライン同期の競合等で参照先が消えた場合に備え、
  表示側は参照切れを「(不明な店舗)」「(未分類)」として表示し、クラッシュさせない

## 画面構成(MVP)

1. **ログイン / サインアップ** — Google ログイン + メール/パスワード。
   パスワードリセット(再設定メール送信)を含む(L-1)
2. **底値一覧(ホーム)** — 商品ごとの底値・店舗・単価をカード表示。検索・カテゴリ絞り込み。
   特売由来の底値には特売バッジを表示
3. **価格を記録** — 商品・店舗を選択(その場で新規追加可)、価格・内容量・特売フラグを入力。
   店頭での最短入力を最優先(目標: 3 タップ + 数値入力で完了)。
   内容量欄には「総量を入力(例: 5箱×160組 → 800組)」のヒントを表示
4. **商品詳細** — その商品の価格記録履歴一覧(グラフは将来)、店舗別の底値、
   特売込み/通常のみの底値の併記。履歴の各記録から編集・削除が可能(H-1)
5. **カテゴリ内比較** — カテゴリを選ぶと、カテゴリ内の全価格記録(商品へ集約しない)を
   「基準単位あたり単価」の昇順でランキング表示。各行に店舗名・記録日・特売バッジを表示。
   底値の対象期間(N ヶ月)設定を適用し、表示は上位50件まで(超過分は「他 N 件」注記)。
   単価換算できない記録は単価不明として末尾に表示
   (詳細: `docs/spec-issue1-category-comparison.md`)
6. **設定** — カテゴリ管理・店舗管理(参照中は削除不可)・底値の対象期間(N ヶ月)・ログアウト

## Code Style

```tsx
// features/prices/unitPrice.ts
/** 基準単位あたりの価格(円)を返す。quantity が 0 以下なら null */
export function calcUnitPrice(price: number, quantity: number): number | null {
  if (quantity <= 0) return null;
  return price / quantity;
}
```

- コンポーネントは関数コンポーネント + named export。ファイル名はコンポーネント名(PascalCase)
- ロジックは hooks / 純粋関数に分離し、UI から独立してテスト可能にする
- Firestore アクセスは `features/*/api.ts` に集約。コンポーネントから直接 SDK を呼ばない
- 命名: 変数・関数 camelCase / 型 PascalCase / 定数 UPPER_SNAKE_CASE
- UI 文言は日本語。コード内の識別子・コメントは英語または日本語コメント可

## Testing Strategy

| レベル | 対象 | ツール |
|---|---|---|
| 単体 | 単価計算・底値算出・単位換算などの純粋ロジック | Vitest |
| コンポーネント | フォームバリデーション・一覧表示 | Vitest + React Testing Library |
| セキュリティルール | 他人の book にアクセスできないこと | Firebase Emulator + @firebase/rules-unit-testing |
| 手動 E2E | オフライン記録→再接続で同期、オフライン閲覧(下記前提)、PWA インストール・更新プロンプト | リリース前チェックリスト |

- テストは `tests/` 配下に src と同じ構造で配置
- カバレッジ目標: `lib/` と `features/*/`(ロジック部分)は 80% 以上。UI は主要フローのみ
- **オフライン閲覧の前提**(M-4): Firestore のオフラインキャッシュは
  「一度オンラインで読んだデータ」のみ保持する。受け入れ条件は
  「オンラインで一度アプリを開いた後であれば、機内モードでも底値一覧・商品詳細が閲覧できる」とする

## Boundaries

- **Always(常にやる)**
  - コミット前に `npm run lint` と `npm run test` を通す
  - Firestore ルールで以下を維持する(M-3):
    - book とその配下は「memberUids に含まれる認証済ユーザーのみ読み書き可」
    - book 作成時は `ownerUid == request.auth.uid` かつ MVP では `bookId == request.auth.uid` を検証
    - `ownerUid` は作成後に変更不可
    - `memberUids` の変更は owner のみ可
    - priceRecords の `price` / `quantity` は正の数であることをルール側でも検証
      (詳細な業務バリデーション(上限値等)はクライアント側の責務)
  - ユーザー入力(価格・数量)のバリデーション(正の数、上限チェック)
- **Ask first(先に確認)**
  - データモデル(Firestore コレクション構造)の変更
  - 依存パッケージの追加
  - Firebase の有料機能・従量課金が発生しうる機能の使用
  - 認証方式の追加・変更
- **Never(やらない)**
  - API キー以外のシークレット(サービスアカウント等)のコミット
  - セキュリティルールを全開放(`allow read, write: if true`)のままデプロイ
  - 失敗しているテストの無断削除・スキップ

## Success Criteria(MVP 完了条件)

- [ ] Google ログインとメール/パスワードでサインイン・サインアウトできる
- [ ] メール/パスワードのパスワードリセット(再設定メール)ができる
- [ ] 商品・店舗・カテゴリを登録でき、価格記録(価格・内容量・特売フラグ)を追加できる
- [ ] 価格記録をあとから編集・削除できる
- [ ] 商品を削除すると配下の価格記録も削除される。参照中の店舗・カテゴリは削除できない
- [ ] ホームで商品ごとの底値・底値店舗・基準単位あたり単価が一覧表示される
- [ ] kg / L で入力した記録が g / ml 基準の単価に換算されて比較される
- [ ] カテゴリを選ぶと商品横断の単価ランキングが表示される
- [ ] 特売価格と通常価格が表示上区別でき、特売由来の底値にはバッジが付く
- [ ] 機内モードで価格を記録 → オンライン復帰後に他端末へ反映される
- [ ] オンラインで一度開いた後なら、機内モードでも底値一覧・商品詳細が閲覧できる
- [ ] スマホのホーム画面に PWA としてインストールできる
- [ ] ルールテストで以下が検証されている: 他ユーザーの book の読み書き不可 /
      `ownerUid` の書き換え不可 / `bookId != uid` での book 作成不可
- [ ] Firebase Hosting の URL でスマホから利用できる

## 将来スコープ(MVP に含めない)

- 価格履歴のグラフ表示
- 底値帳の共有(book への複数メンバー招待)
- 買い物リスト、バーコードスキャン、商品写真
- クラウドソーシング型の価格共有(サービス化)
- 匿名認証 → アカウント連携

## Open Questions

なし

## 解決済み事項(記録)

- 税込/税抜 → 税込のみで記録(2026-07-12 ヒアリング)
- 底値の定義 → 直近 N ヶ月(デフォルト 6、設定で変更可)(2026-07-12 ヒアリング)
- アプリ名 → 「そこねこ」(2026-07-12 ヒアリング)
- 底値に特売を含めるか → 含める。特売由来はバッジ表示、商品詳細で通常のみの底値も併記(レビュー H-3)
- 削除時の参照整合性 → 店舗・カテゴリは参照中削除禁止、商品削除は記録ごと削除、表示はフォールバック(レビュー H-2)
- book の作成方法 → `bookId = uid` の決定的 ID + 冪等な setDoc(レビュー H-4)
- 状態管理 → TanStack Query は不採用、onSnapshot + 自前フックに一本化(レビュー M-2)
- book 初期化の冪等性 → getDoc 存在確認 + create 専用トランザクション + 決定的シード ID(再レビュー M-5)
