import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { DesktopLayoutProvider } from '../../src/components/DesktopLayoutContext';

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
const priceRecords = [
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
];

vi.mock('../../src/features/prices/api', () => ({
  usePriceRecords: vi.fn(() => ({
    data: priceRecords,
    loading: false,
  })),
  useProductPriceRecords: vi.fn((productId: string | undefined) => ({
    data: productId ? priceRecords.filter((r) => r.productId === productId) : [],
    loading: false,
  })),
}));

import { HomePage } from '../../src/routes/HomePage';

function renderDesktopHome() {
  return render(
    <DesktopLayoutProvider value={true}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:productId" element={<div>product-detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </DesktopLayoutProvider>,
  );
}

describe('HomePage PC ダッシュボード', () => {
  it('サマリー 3 枚と底値一覧テーブルを表示する', () => {
    renderDesktopHome();
    expect(screen.getByTestId('pc-home-dashboard')).toBeInTheDocument();
    expect(screen.getByText('登録商品')).toBeInTheDocument();
    expect(screen.getByText('今週の記録')).toBeInTheDocument();
    expect(screen.getByText('底値更新')).toBeInTheDocument();
    expect(screen.getByText('カテゴリ別・底値一覧')).toBeInTheDocument();
    expect(screen.getByText('キュキュット 本体 240ml')).toBeInTheDocument();
  });

  it('未選択時は右ペインにプレースホルダを表示する', () => {
    renderDesktopHome();
    expect(screen.getByText('一覧から商品を選択')).toBeInTheDocument();
  });

  it('行選択で右ペインが更新される', async () => {
    const user = userEvent.setup();
    renderDesktopHome();
    await user.click(screen.getByText('キュキュット 本体 240ml'));
    const pane = screen.getByTestId('pc-detail-pane');
    expect(pane).toHaveTextContent('選択中');
    expect(pane).toHaveTextContent('¥158');
    expect(pane).toHaveTextContent('詳細を開く');
  });

  it('「詳細を開く」で /products/:id へ進む', async () => {
    const user = userEvent.setup();
    renderDesktopHome();
    await user.click(screen.getByText('キュキュット 本体 240ml'));
    await user.click(screen.getByRole('link', { name: '詳細を開く' }));
    expect(screen.getByText('product-detail-page')).toBeInTheDocument();
  });

  it('右ペインに編集・削除 UI がない', async () => {
    const user = userEvent.setup();
    renderDesktopHome();
    await user.click(screen.getByText('キュキュット 本体 240ml'));
    const pane = screen.getByTestId('pc-detail-pane');
    expect(pane.querySelector('button[aria-label*="編集"]')).toBeNull();
    expect(pane.querySelector('button[aria-label*="削除"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument();
  });

  it('記録のない商品は一覧に出さない', () => {
    renderDesktopHome();
    expect(screen.queryByText('記録なし商品')).not.toBeInTheDocument();
  });
});
