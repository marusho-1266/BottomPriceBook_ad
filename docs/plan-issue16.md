# 実装計画: 悪用・スパム対策(Issue #16)

> Status: **Draft(承認待ち)** / 作成日: 2026-07-19
> 対象仕様: `docs/spec-issue16.md`
> タスク分解: `docs/tasks-issue16.md`(次フェーズで作成)

## 方針

- **App Check の SDK 導入を最初に行う** — enforcement の前提となる「メトリクス監視期間」を
  最大限稼ぐため。SDK をデプロイして監視を開始した後、その裏でルール強化を進める
  (enforcement 有効化は全フェーズ完了後の Phase 4)
- ルール変更は**必ず rules テストを先に書く**(TDD。既存 test:rules の方針踏襲)。
  特に「既存の正常系が通り続けること」を各タスクの回帰条件にする
- 高リスク要素は 2 つ:
  ① **books の hasOnly 固定** — 既存ドキュメントのフィールドを許可リストから漏らすと
  join / leave / owner 更新が全滅する。実装前に現行スキーマの突き合わせを必須にする
  ② **レート制限とオフライン書込キューの衝突** — 再接続時の連続コミットが 1 秒間隔に
  違反して書込が消える可能性。クライアント改修**前**にルールだけで実挙動を検証し、
  問題があれば方針協議(spec の Open Question)に戻る(fail fast)
- クライアント改修(writeBatch 化)は feature 単位で分割し、1 タスク 5 ファイル以内に収める
- 各タスク終了時に `npm run test && npm run test:rules && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| App Check 初期化は `src/lib/appCheck.ts` に分離し、サイトキー未設定時は no-op | Sentry と同じ「未設定でも壊れない」方針。エミュレータ・CI・テスト環境で追加設定不要 |
| enforcement はコード完了後にコンソールで有効化(コードと分離) | ロールバックがコンソール操作のみで即時可能。誤ブロック時にデプロイ不要で戻せる |
| ルールの検証ヘルパー関数(`isValidString` 等)を books スコープ内に共通定義 | 8 コレクション分の重複を排除。既存の isBookMember 等と同じ配置 |
| stores / products / categories の `allow write` を create / update / delete に分離 | create/update のみ検証を付け、delete は現状維持(検証不能・不要)のため |
| rateLimits は「コンテンツ側ルールが getAfter で同一バッチ更新を強制」+「rateLimits 側ルールが 1 秒間隔を強制」の 2 段構え | 検証責務を rateLimits doc に集約し、コンテンツ 4 コレクション側の追加条件を 1 行に保つ |
| クライアントのバッチ化は `src/lib/rateLimit.ts` の共通ヘルパー経由のみ | serverTimestamp の書き方・doc パスを 1 箇所に集約。api.ts からは 1 行呼ぶだけ |
| レート制限のオフライン実挙動検証を独立タスクとして先行実施 | 結果次第で間隔・方式の再協議が必要になるため、api.ts 改修に着手する前に確定させる |

## 主要コンポーネントと依存

```
Phase 1: App Check(監視開始を最速で)
  src/lib/appCheck.ts(init + ガード)──▶ main.tsx 組込 + functions enforceAppCheck
        └──▶ [手動] reCAPTCHA キー発行・登録 → デプロイ → メトリクス監視開始
                                        │(監視期間はバックグラウンドで進行)
Phase 2: ルール検証強化                  │
  検証ヘルパー ──▶ categories/stores/products ──▶ priceRecords ──▶ members/invites/books
                                        │
Phase 3: レート制限                      │
  rateLimits ルール ──▶ オフライン挙動検証(fail fast)──▶ rateLimit.ts ──▶ features/*/api.ts バッチ化
                                        │
                                        ▼
Phase 4: enforcement 有効化(Firestore → Functions → Auth)+ 本番検証 + 親仕様更新
```

- Phase 2 と Phase 3 はルール上は独立だが、firestore.rules を両方が触るため直列で進める
- Phase 1 のコード(Task 1)完了後、手動作業(Task 2)は以降のフェーズをブロックしない

## 実装順序(フェーズ)

### Phase 1: App Check SDK 導入(監視期間を稼ぐ)

1. **Task 1: App Check 初期化コード + Functions 側 enforce 準備** —
   `src/lib/appCheck.ts` に `initializeAppCheck`(ReCaptchaV3Provider、
   `VITE_FIREBASE_APPCHECK_SITE_KEY` 未設定 or エミュレータ時は no-op)。
   `main.tsx`(または firebase.ts)から呼び出し。functions の `deleteAccount` に
   `enforceAppCheck: true` を追加(App Check 未強制の間もトークン無しリクエストは
   Functions 側で拒否される点に注意 — 監視期間中は付けず Phase 4 で付ける選択も実装時に確認)。
   「サイトキー未設定でも全テストが通る」ことを単体テストで担保
2. **Task 2: 手動セットアップ(ユーザー依頼)+ デプロイ・監視開始** —
   Firebase コンソールで App Check にアプリ登録 + reCAPTCHA v3 キー発行、
   `.env.local` に `VITE_FIREBASE_APPCHECK_SITE_KEY` 設定、デプロイ。
   コンソールのメトリクスで「検証済みリクエスト」が記録され始めることを確認。
   手順は docs に記載

#### Checkpoint 1
- 本番アプリが App Check トークンを送信し、メトリクスに検証済みリクエストが現れる
- エミュレータ環境・CI で App Check 関連の失敗が出ない(全テストグリーン)

### Phase 2: ルール検証強化

3. **Task 3: 検証ヘルパー + categories / stores / products** —
   rules テストを先に書く(許可リスト外フィールド拒否・文字列長境界値・baseUnit 列挙・
   sortOrder 範囲・既存正常系の回帰)。`isValidString` 等のヘルパーを定義し、
   `allow write` を create / update / delete に分離して検証を実装
4. **Task 4: priceRecords + members / invites 強化** —
   priceRecords の hasOnly + 型・上限検証(price / quantity / unit / isSale /
   recordedAt / note)、members.displayName・invites.bookName の長さ検証。
   境界値の rules テスト先行
5. **Task 5: books 本体の hasOnly + memberUids 上限** —
   **着手前に現行スキーマの突き合わせ**(src/types/models.ts の Book 型・
   book 作成/更新コード・本番データのフィールド構成を確認)。
   join / leave / owner 更新・作成トランザクションの全正常系が通ることを
   既存 rules テストの回帰で確認

#### Checkpoint 2
- `npm run test:rules` 全グリーン(新規検証テスト + 既存回帰)
- `npm run test:e2e` で記録・共有の主要フローが通る

### Phase 3: 書込レート制限

6. **Task 6: rateLimits ルール + オフライン挙動検証(fail fast)** —
   `rateLimits/{uid}` のルールとコンテンツ 4 コレクションへの getAfter 条件を実装し、
   rules テスト(未更新バッチ拒否 / 1 秒未満拒否 / 1 秒経過後許可)。
   あわせてオフライン書込キューの連続コミット挙動をエミュレータで検証し、
   **拒否が発生する場合はここで停止して方針協議**(spec Open Question)
7. **Task 7: rateLimit.ts ヘルパー + prices / stores の api.ts バッチ化** —
   `src/lib/rateLimit.ts`(バッチに rateLimits 更新を積む共通ヘルパー)+ 単体テスト。
   priceRecords(最頻の書込)と stores の create / update を writeBatch 化
8. **Task 8: products / categories の api.ts バッチ化 + 掃除経路確認** —
   残りの feature をバッチ化。`deleteAccount` の recursiveDelete で rateLimits
   サブコレクションが消えることを functions テストで確認

#### Checkpoint 3
- 全テスト(test / test:rules / test:e2e / functions)+ lint + CI グリーン
- 手動: エミュレータでアプリを操作し、通常速度の入力が一切阻害されないことを確認

### Phase 4: enforcement 有効化・本番検証(ユーザー作業を含む)

9. **Task 9: デプロイ + enforcement 段階有効化(ユーザー依頼)** —
   ルール・クライアントをデプロイ後、メトリクスで未検証リクエスト比率を確認し、
   **Firestore → Functions → Auth の順に enforcement を有効化**
   (Auth は Identity Platform アップグレードの要否をここで最終判断 — spec Open Question)。
   各有効化の直後に本番アプリで主要フロー(記録・編集・共有・退出)を手動確認
10. **Task 10: 本番の直接アクセス拒否確認 + 親仕様更新** —
    REST での直接アクセスが 403 になることを確認。`docs/spec.md` に Issue #16 の反映
    (セキュリティ節・Tech Stack)、`docs/spec-issue16.md` の Status を Implemented へ更新

#### Checkpoint: 完了
- `docs/spec-issue16.md` の Success Criteria が全項目チェック済み

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| books の hasOnly が既存フィールドを漏らし join/leave/更新が全滅 | 高 | Task 5 冒頭でスキーマ突き合わせを必須化。既存 rules テストの回帰を通過条件に |
| オフライン書込キューがレート制限に違反しサイレントにデータ消失 | 高 | Task 6 でクライアント改修前に実挙動検証。拒否発生時は停止して方針協議(fail fast) |
| enforcement 有効化で正規ユーザーを誤ブロック | 高 | 監視期間を Phase 1 から確保し未検証比率を確認してから有効化。段階有効化 + 直後の手動確認。ロールバックはコンソールで即時 |
| `enforceAppCheck: true` が監視期間中の正規リクエストを拒否 | 中 | Task 1 で付与タイミングを確認(監視期間中は外し Phase 4 で付ける選択肢を実装時判断) |
| ルール肥大による評価コスト・可読性低下 | 低 | 検証ヘルパー共通化。既存コメント様式(意図 + Issue 番号)で意図を明記 |
| writeBatch 化の改修漏れ(直書きが残りレート制限で拒否される) | 中 | `addDoc` / `setDoc` / `updateDoc` の全呼び出し箇所を grep で棚卸ししてから着手。e2e で主要フロー確認 |
| reCAPTCHA v3 無料枠(月 1 万評価)超過 | 低 | 少人数利用で到達しない想定。メトリクスで監視 |

## 並列化の余地

- Phase 1 の手動作業(Task 2)完了を待たずに Phase 2 以降へ進める(監視はバックグラウンド)
- Task 3 / Task 4 は同一ファイル(firestore.rules)を触るため直列
- Task 7 / Task 8 は feature 単位で独立しており並行可能(単独セッションでは直列)

## Open Questions(plan 時点)

- `enforceAppCheck: true` の付与タイミング(Task 1 で実装するか Phase 4 まで遅らせるか。
  監視期間中の deleteAccount 呼び出しが拒否されないことを優先して実装時に判断)
- Auth の enforcement(Identity Platform アップグレード)実施可否 — Task 9 で最終判断
- オフライン書込の実挙動 — Task 6 の検証結果次第で間隔(1 秒)や方式を再協議
