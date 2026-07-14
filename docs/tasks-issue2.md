# タスク分解: 記録時の暫定順位表示(Issue #2)

> Status: **I2-T1 完了(2026-07-14)** / 最終更新: 2026-07-14
> 対象: `docs/spec-issue2.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

- [x] **I2-T1: 順位計算ロジック `rankDraftInCategory`**
  - 内容: `src/features/prices/bottomPrice.ts` に `DraftRankResult` 型と
    `rankDraftInCategory` を追加。仕様どおり、対象商品はドラフト単価・
    他商品は既存底値で比較し、`{ kind: 'ranked', rank, total }` /
    `{ kind: 'noCandidates' }` / `null`(ドラフト無効)を返す。
    順位は「厳密に安い比較対象の数 + 1」(同額は同順位)、
    `unitPrice: null` の底値フォールバック商品は母数から除外
  - 受け入れ: `docs/spec-issue2.md` Testing Strategy の単体テスト 9 項目が全てグリーン
  - Verify: `npm run test && npm run lint && npm run build`
  - 依存: なし / 規模: S

- [ ] **I2-T2: RecordPage への暫定順位表示の統合**
  - 内容: `src/routes/RecordPage.tsx` で入力値から `rankDraftInCategory` を
    `useMemo` で算出し、「このカテゴリで暫定 {rank} 位 / {total} 商品中」
    または「比較対象なし」の表示を追加。底値設定は
    `book.bottomWindowMonths ?? DEFAULT_BOTTOM_WINDOW_MONTHS` を使用。
    店舗未選択でも表示する
  - 受け入れ: spec の Success Criteria の UI 項目
    (リアルタイム表示・即時更新・比較対象なし表示・入力不足時は非表示)を満たす
  - Verify: `npm run test && npm run lint && npm run build` + dev サーバーで手動確認
  - 依存: I2-T1 / 規模: S
