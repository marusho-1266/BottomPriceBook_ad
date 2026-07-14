# タスク分解: 記録時暫定順位の比較対象見直し(Issue #8)

> Status: **I8-T1〜T2 完了(2026-07-15)** / 最終更新: 2026-07-15
> 対象: `docs/spec-issue8.md`
> 実装は 1 タスク = 1 コミット想定。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

- [x] **I8-T1: 順位計算ロジック `rankDraftInCategory` の改訂**
  - 内容: 記録単位比較・同一商品×同一店舗除外・`noCandidates` 廃止・`targetStoreId` 追加
  - 受け入れ: `docs/spec-issue8.md` Testing Strategy の単体テスト項目が全てグリーン
  - Verify: `npm run test -- tests/features/prices/bottomPrice.test.ts && npm run lint`
  - 依存: なし / 規模: S

- [x] **I8-T2: RecordPage への暫定順位表示の接続**
  - 内容: 店舗必須・文言を `件中` に変更・`noCandidates` UI 削除
  - 受け入れ: spec の Success Criteria の UI 項目を満たす
  - Verify: `npm run test && npm run lint && npm run build`
  - 依存: I8-T1 / 規模: S
