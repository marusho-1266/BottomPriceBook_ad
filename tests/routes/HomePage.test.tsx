import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { stubMatchMedia, type MatchMediaController } from '../helpers/matchMedia';

vi.mock('../../src/features/books/BookProvider', () => ({
  useBook: () => ({
    bookId: 'b1',
    book: { id: 'b1', name: 'テスト', ownerUid: 'u1', memberUids: ['u1'], bottomWindowMonths: 6 },
    books: [
      { id: 'b1', name: 'テスト', ownerUid: 'u1', memberUids: ['u1'], bottomWindowMonths: 6 },
    ],
    isOwner: true,
    setCurrentBookId: () => {},
  }),
}));
vi.mock('../../src/features/categories/api', () => ({
  useCategories: vi.fn(() => ({
    data: [
      { id: 'detergent', name: '洗剤', baseUnit: 'ml', sortOrder: 0 },
      { id: 'food', name: '食品', baseUnit: 'g', sortOrder: 1 },
    ],
    loading: false,
  })),
}));
vi.mock('../../src/features/products/api', () => ({
  useProducts: vi.fn(() => ({
    data: [
      { id: 'p1', name: 'キュキュット 本体 240ml', categoryId: 'detergent' },
      { id: 'p2', name: 'コシヒカリ 5kg', categoryId: 'food' },
      { id: 'p3', name: '記録なし商品', categoryId: 'food' },
    ],
    loading: false,
  })),
}));
vi.mock('../../src/features/stores/api', () => ({
  useStores: vi.fn(() => ({
    data: [{ id: 's1', name: 'OKストア' }],
    loading: false,
  })),
}));

const now = Timestamp.now();

vi.mock('../../src/features/prices/api', () => ({
  usePriceRecords: vi.fn(() => ({
    data: [
      {
        id: 'r1',
        productId: 'p1',
        storeId: 's1',
        price: 158,
        quantity: 240,
        unit: 'ml',
        isSale: true,
        recordedAt: now,
      },
      {
        id: 'r2',
        productId: 'p1',
        storeId: 's1',
        price: 208,
        quantity: 240,
        unit: 'ml',
        isSale: false,
        recordedAt: now,
      },
      {
        id: 'r3',
        productId: 'p2',
        storeId: 'missing-store',
        price: 1980,
        quantity: 5,
        unit: 'kg',
        isSale: false,
        recordedAt: now,
      },
    ],
    loading: false,
  })),
  useProductPriceRecords: vi.fn(() => ({ data: [], loading: false })),
}));

import { HomePage } from '../../src/routes/HomePage';
import { usePriceRecords } from '../../src/features/prices/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage(底値一覧)', () => {
  let media: MatchMediaController;

  beforeEach(() => {
    media = stubMatchMedia(false);
  });

  afterEach(() => {
    media.restore();
  });

  it('usePriceRecords に windowMonths/now を渡す(Issue #17: クエリ絞り込み回帰防止)', () => {
    renderPage();
    expect(usePriceRecords).toHaveBeenCalledWith({
      windowMonths: expect.any(Number),
      now: expect.any(Date),
    });
  });

  it('商品ごとの底値と店舗・単価を表示する', () => {
    renderPage();
    expect(screen.getByText('¥158')).toBeInTheDocument();
    expect(screen.getByText(/OKストア/)).toBeInTheDocument();
    expect(screen.getByText(/0\.66円\/ml/)).toBeInTheDocument();
  });

  it('特売由来の底値には特売バッジが付く(H-3)', () => {
    renderPage();
    expect(screen.getByText('特売')).toBeInTheDocument();
  });

  it('kg 記録は g 基準の単価で表示される', () => {
    renderPage();
    expect(screen.getByText(/0\.40円\/g/)).toBeInTheDocument();
  });

  it('カテゴリ見出しと基準単位の説明を表示する', () => {
    renderPage();
    expect(screen.getByText('洗剤')).toBeInTheDocument();
    expect(screen.getByText('1mlあたりで比較')).toBeInTheDocument();
    expect(screen.getByText('1gあたりで比較')).toBeInTheDocument();
  });

  it('参照切れの店舗は「(不明な店舗)」と表示する(H-2)', () => {
    renderPage();
    expect(screen.getByText(/(不明な店舗)/)).toBeInTheDocument();
  });

  it('記録のない商品は一覧に表示しない', () => {
    renderPage();
    expect(screen.queryByText('記録なし商品')).not.toBeInTheDocument();
  });

  it('検索で商品を絞り込める', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '検索' }));
    await user.type(screen.getByPlaceholderText('商品名で検索'), 'コシヒカリ');
    expect(screen.getByText('コシヒカリ 5kg')).toBeInTheDocument();
    expect(screen.queryByText('キュキュット 本体 240ml')).not.toBeInTheDocument();
  });

  it('統計サマリー(登録商品・今週の記録・底値更新)を表示する', () => {
    renderPage();
    expect(screen.getByText('登録商品')).toBeInTheDocument();
    expect(screen.getByText('今週の記録')).toBeInTheDocument();
    expect(screen.getByText('底値更新')).toBeInTheDocument();
    // 登録商品 3 品
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('モバイルでは PC ダッシュボードを出さない', () => {
    renderPage();
    expect(screen.queryByTestId('pc-home-dashboard')).not.toBeInTheDocument();
  });
});
