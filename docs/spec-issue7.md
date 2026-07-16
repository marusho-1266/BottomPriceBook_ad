# Spec: Issue #7 底値帳の共有機能

> Status: **Implemented(実装済み・2026-07-16。E2E 手動検証とデプロイは未実施)** / 作成: 2026-07-16
> 対象 Issue: [#7 共有機能](https://github.com/marusho-1266/BottomPriceBook_ad/issues/7)
> 親仕様: `docs/spec.md`(共有モデル・将来スコープ「底値帳の共有」を MVP 化する)

## ヒアリング結果(2026-07-16 確定)

1. **招待方法**: 招待コード/リンク方式(サーバー処理なし・Firestore ルールのみで実現。無料枠のまま運用)
2. **権限**: 全メンバーが読み書き可。メンバー管理(招待・削除)のみオーナー限定
3. **book の持ち方**: 自分の book に招待する方式。各自が自分の book を持ちつつ他人の book に参加でき、book 切替 UI を追加。既存データの移行は不要
4. **離脱・削除**: オーナーによるメンバー削除 + メンバー本人による退出の両方に対応。
   招待コードの明示的な無効化・再発行 UI はスコープ外(有効期限による自動失効で代替)

## 前提(仮定 — 誤りがあれば指摘してください)

1. 招待コードの有効期限は **7 日間**。期限切れはルール側で拒否する
2. 招待コードは期限内なら**複数人が使用可**(家族数人にまとめて共有する想定)
3. 参加には**オンライン必須**(オフラインでの参加操作は不可。記録・閲覧は従来どおりオフライン可)
4. メンバー上限は設けない(想定は数人。ルールでの上限強制はしない)
5. 価格記録に「誰が記録したか」(createdBy)は**持たせない**(将来スコープ)
6. メンバー削除・退出後も、その人が記録したデータは book に残る(削除しない)
7. オーナーは自分の book から退出できない(book の削除・譲渡はスコープ外)
8. メンバーの表示名は Firebase Auth の displayName(なければメールアドレス)を参加時に保存する

## Objective

### 何を作るか

家族・知り合いと 1 冊の底値帳を共有し、全員で価格を記録・閲覧できるようにする。

### ユーザーストーリー

- オーナーとして、招待コード(または招待リンク)を発行して家族に渡し、自分の底値帳に招待したい
- 招待された人として、受け取ったコード/リンクから参加し、相手の底値帳を閲覧・記録したい
- メンバーとして、自分の底値帳と参加中の底値帳を切り替えて使いたい
- オーナーとして、メンバー一覧を確認し、不要になったメンバーを削除したい
- メンバーとして、参加中の底値帳から自分の意思で退出したい

## データモデル変更(Ask first 対象 — 本 spec の承認をもって確認とする)

### 追加: トップレベル `invites` コレクション

```
invites/{inviteCode}            // inviteCode = Firestore 自動 ID(20 文字・推測困難な能力トークン)
  bookId: string                // 参加先 book
  bookName: string              // 参加確認画面での表示用スナップショット
  createdBy: string             // 発行者 uid(= book オーナー)
  createdAt: Timestamp
  expiresAt: Timestamp          // createdAt + 7 日
```

- コード文字列そのものが秘密情報(URL トークン方式)。get のみ許可し **list は禁止**
- 招待リンク: `https://<host>/join/{inviteCode}`(SPA ルート。手入力用にコード入力欄も用意)

### 追加: `books/{bookId}/members/{uid}` サブコレクション(メンバープロフィール)

```
books/{bookId}/members/{uid}
  displayName: string           // 参加時の Auth displayName(なければ email)
  joinedAt: Timestamp

books/{bookId}/joinTokens/{uid}
  inviteCode: string            // 参加に使用したコード(ルール検証専用。誰も read 不可)
```

- **メンバーシップの真実のソースは従来どおり `books.memberUids`**。members doc は表示名の保持用
- 招待コードは秘密情報のため、メンバーが読める members doc には置かず
  **read を全面禁止した `joinTokens`** に分離する(メンバーによるコードの再取得・再配布を防ぐ)
- 既存 book にはオーナーの members doc が無いため、ログイン時に自分の doc を
  冪等に補完する(`ensureBook` を拡張)。doc が無いメンバーは「(名前未設定)」表示にフォールバック

### 参加(join)のトランザクション

サーバーなしで「コードを知っている人だけが自分を memberUids に追加できる」ことを
Firestore ルールで強制するため、参加は**1 バッチ書き込み**で行う:

1. `books/{bookId}/members/{uid}` を create(表示名のみ)
2. `books/{bookId}/joinTokens/{uid}` を create(`inviteCode` フィールドにコードを格納)
3. `books/{bookId}` を update(`memberUids` に自分の uid を arrayUnion)

ルール側は book update 時に `getAfter()` で同一バッチ内の joinTokens doc から
コードを読み取り、`get(invites/{code})` で bookId 一致と `request.time < expiresAt` を検証する。

### セキュリティルール変更

- `books` update に「**自分自身の参加**」分岐を追加:
  - 変更キーが `memberUids` のみ(`affectedKeys().hasOnly(['memberUids'])`。
    任意フィールドの同時追加・変更を拒否)
  - memberUids の変更が「自分の uid の追加のみ」であること
  - 上記の招待コード検証(getAfter + get)を通ること
- `books` update に「**自分自身の退出**」分岐を追加:
  - 変更キーが `memberUids` のみ(同上)
  - memberUids の変更が「自分の uid の除去のみ」かつ自分がオーナーでないこと
- オーナーによるメンバー削除は既存ルール(memberUids 変更は owner 可)でカバー済み
- `invites`:
  - create: 対象 book のオーナーのみ。`bookId` `createdBy` `expiresAt` の整合を検証
  - get: 認証済ユーザーなら可(コード自体が秘密のため)。**list: 不可**
  - delete: 発行者(オーナー)のみ可。update: 不可
- `members`:
  - create: 本人のみ(join バッチ内、または既存メンバーの補完)
  - delete: 本人またはオーナー
  - read: book メンバー
- `joinTokens`:
  - create: 本人 + 有効な招待コード + フィールドは `inviteCode` のみ
  - read: **全面禁止**(コードの再取得・再配布の防止)。update: 不可
  - delete: 本人またはオーナー(退出・メンバー削除時の掃除)

## 画面・UI 変更

1. **book 切替**(ホームのヘッダー): 参加中の book(`memberUids array-contains uid` クエリ)を
   ドロップダウンで切替。選択は localStorage に永続化。削除・退出で参照不能になった場合は
   自分の book に自動フォールバック
2. **設定 > 共有**(新設セクション):
   - 自分の book: 招待コード発行(有効期限付き)・リンクのコピー・メンバー一覧・メンバー削除(確認ダイアログ)
   - 参加中の book: メンバー一覧(閲覧)・「この底値帳から退出」(確認ダイアログ)
3. **参加画面** `/join/:inviteCode`(新ルート): book 名と有効期限を表示し、
   「参加する」ボタンで join バッチを実行。無効/期限切れコードはエラー表示。
   未ログインならログイン後に戻す
4. 設定の book 名・底値期間の編集は**自分がオーナーの book のみ**表示(メンバーは閲覧のみ)
   ※ ルール上はメンバーも name 等を更新できる(既存ルール踏襲)が、UI では制限する

## Tech Stack / Commands / Code Style

親仕様 `docs/spec.md` から変更なし。新規依存パッケージの追加もなし。

## Project Structure(追加分)

```
src/features/sharing/         → 共有機能モジュール
  api.ts                      → 招待発行・参加・退出・メンバー削除の Firestore アクセス
  ShareSettings.tsx           → 設定内の共有セクション
  JoinPage.tsx                → /join/:inviteCode 画面(routes から参照)
src/features/books/
  BookProvider.tsx            → currentBookId の切替対応(拡張)
  api.ts                      → ensureBook にオーナー members doc 補完を追加(拡張)
tests/features/sharing/       → 単体・コンポーネントテスト
tests/rules/                  → 招待・参加・退出のルールテスト(既存構造に追加)
```

## Testing Strategy(本 Issue 分)

| レベル | 対象 |
|---|---|
| 単体 | 招待有効期限の判定、join バッチの組み立て、book 切替のフォールバックロジック |
| コンポーネント | 共有設定(発行・一覧・削除)、参加画面(正常・無効コード)、book 切替 |
| セキュリティルール | 下記 Success Criteria のルール項目すべて |

ルールテストが本機能の品質の要。**実装より先にルールテストを書く**(TDD)。

## Boundaries(本 Issue 固有)

- **Always**
  - invites の list を禁止したまま維持する(コード列挙の防止)
  - 参加時の memberUids 変更は「自分の追加のみ」に限定する(他人を追加させない)
  - 招待コードは Firestore 自動 ID(20 文字)を使う(短い自作コードにしない)
- **Ask first**
  - 招待の有効期限・使用回数ポリシーの変更
  - members doc への表示名以外の個人情報の追加
- **Never**
  - 招待コードを Analytics やログに出力しない
  - メンバー削除時に当人の価格記録を削除しない(データは book に帰属)

## Success Criteria

- [ ] オーナーが設定画面から招待コード/リンクを発行できる(有効期限 7 日が表示される)
- [ ] 招待された人がリンクまたはコード入力から book に参加できる
- [ ] 参加後、book 切替 UI で自分の book と参加中の book を切り替えられ、
      参加先で価格記録の追加・編集・底値閲覧ができる
- [ ] 設定にメンバー一覧が表示名付きで表示される
- [ ] オーナーがメンバーを削除でき、削除された側は次回アクセス時に自分の book へフォールバックする
- [ ] メンバーが自分で退出できる。オーナー自身は退出できない
- [ ] 期限切れ・存在しないコードでは参加できず、エラーが表示される
- [ ] ルールテストで検証:
  - [ ] 有効なコードを持つユーザーは自分を memberUids に追加できる
  - [ ] コードなし/期限切れコード/他 book のコードでは参加不可
  - [ ] 参加時に自分以外の uid を追加できない。他フィールドを同時変更できない
  - [ ] メンバー以外は book 配下を読み書きできない(既存テストの回帰)
  - [ ] invites の list 不可。オーナー以外は invite を作成・削除できない
  - [ ] 本人退出は可、オーナーの退出は不可、非メンバーによる memberUids 操作は不可
- [ ] 既存テスト(`npm run test` / `npm run test:rules`)がすべて通る

## 将来スコープ(本 Issue に含めない)

- 招待コードの明示的な無効化・再発行 UI(期限切れによる自動失効で代替)
- 価格記録への記録者(createdBy)表示
- 閲覧のみロール、book の譲渡・削除、複数 book の新規作成
- メール招待(Cloud Functions が必要)

## Open Questions

- 招待コードの有効期限 7 日は妥当か?(短くする/長くする)
- 招待コードを使える人数を制限すべきか?(現案: 期限内なら無制限)
