# 実装計画: PC用レイアウト(Issue #32)

> Status: **Implemented** / 作成日: 2026-07-23
> 対象仕様: `docs/spec-issue32.md`
> タスク分解: `docs/tasks-issue32.md`

## 方針

- **幅判定を最初に固める**(`useIsDesktopLayout` + matchMedia ヘルパー)。シェルとホームの分岐がすべてこれに依存する
- モバイル UI を壊さないため、現行 `AppShell` のボトムタブを `MobileShell` として温存し、Desktop は別コンポーネントに分離する
- サマリー定義は純粋関数へ切り出してから UI を分岐し、定義回帰を単体テストで防ぐ
- 右ペインは閲覧専用を新規作成し、`ProductDetailPage` の編集 UI を持ち込まない
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| 判定は `useIsDesktopLayout()` = `matchMedia('(min-width: 768px)')` | JS でシェル/ホームを分岐する必要がある。UA は使わない(spec) |
| `AppShell` が Mobile / Desktop を切替。Desktop は `DesktopShell.tsx` | 現行モバイル DOM を壊さず、サイドナビ責務を分離 |
| ルートは変更しない(`App.tsx` の AppShell 配下 7 ルートのまま) | `/pc` 別 URL は作らない(spec) |
| ホームは同一 `HomePage` 内でモバイル / PC を分岐 | データ取得・サマリー定義を1箇所に保つ |
| `computeHomeSummary` でサマリー算出を切り出し | 定義不変を単体テストで担保 |
| 右ペイン選択は `selectedProductId` ローカル state | URL 非同期(spec 確定) |
| `PcProductDetailPane` は閲覧 +「詳細を開く」のみ | 編集・削除は商品詳細ページの責務 |
| `BookSwitcher` に `tone`(`onPrimary` / `onSurface`) | PC クリーム背景でも可読。モバイルは従来どおり白文字 |
| デザインは既存トークンのみ | 別テーマ禁止。モック HTML のダークサイドバー色は導入しない |

## 主要コンポーネントと依存

```
useIsDesktopLayout(+ matchMedia テストヘルパー)
    │
    ├── AppShell ↔ DesktopShell(サイドナビ)
    │
    └── HomePage
            ├── computeHomeSummary(純関数・現行定義)
            ├── PcHomeDashboard(一覧テーブル + 選択)
            └── PcProductDetailPane(閲覧 + 詳細導線)
                    │
                    └── 他画面の幅・余白微調整(シェル完成後)
```

## 実装順序(フェーズ)

### Phase 1: レイアウト基盤
1. I32-T1: `useIsDesktopLayout` + matchMedia テストヘルパー
2. I32-T2: `DesktopShell` + `AppShell` 幅分岐

### Phase 2: ホーム
3. I32-T3: `computeHomeSummary` 純関数切り出し
4. I32-T4: PC ホーム(サマリー + 一覧)
5. I32-T5: PC 右ペイン(閲覧 + 詳細導線)

### Phase 3: 仕上げ
6. I32-T6: 記録・比較・設定・商品詳細の PC 幅微調整
7. I32-T7: 回帰確認 + docs 反映

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `HomePage` 分岐でモバイル回帰 | High | T3 でロジック先行切り出し、既存 HomePage テストを常に維持 |
| jsdom に `matchMedia` が無い | Med | `tests/helpers/matchMedia.ts` で共通スタブ |
| 右ペインが編集 UI をコピーしてしまう | Med | 閲覧専用コンポーネントを新規作成。テストで「無いこと」を明示 |

## Out of Scope

記録/比較の本格 PC 再設計、案B/D、強制モバイルトグル、UA 判定、右ペイン編集、選択状態の URL 同期、新規集計指標、モック HTML の本番取り込み
