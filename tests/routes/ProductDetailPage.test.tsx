import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

vi.mock('../../src/features/books/BookProvider', () => ({
  useBook: () => ({
    bookId: 'b1',
    book: { id: 'b1', name: 'テスト', ownerUid: 'u1', memberUids: ['u1'], bottomWindowMonths: 6 },
  }),
}));
vi.mock('../../src/features/categories/api', () => ({
  useCategories: vi.fn(() => ({
    data: [{ id: 'detergent', name: '洗剤', baseUnit: 'ml', sortOrder: 0 }],
    loading: false,
  })),
}));
vi.mock('../../src/features/products/api', () => ({
  useProducts: vi.fn(() => ({
    data: [{ id: 'p1', name: 'キュキュット 本体 240ml', categoryId: 'detergent' }],
    loading: false,
  })),
  updateProduct: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/features/products/deleteProduct', () => ({
  deleteProductWithRecords: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/features/stores/api', () => ({
  useStores: vi.fn(() => ({
    data: [
      { id: 's1', name: 'OKストア' },
      { id: 's2', name: '西友' },
    ],
    loading: false,
  })),
}));

const now = Timestamp.now();

vi.mock('../../src/features/prices/api', () => ({
  usePriceRecords: vi.fn(() => ({
    data: [
      {
        id: 'r-sale',
        productId: 'p1',
        storeId: 's1',
        price: 158,
        quantity: 240,
        unit: 'ml',
        isSale: true,
        recordedAt: now,
      },
      {
        id: 'r-regular',
        productId: 'p1',
        storeId: 's2',
        price: 208,
        quantity: 240,
        unit: 'ml',
        isSale: false,
        recordedAt: now,
      },
    ],
    loading: false,
  })),
  updatePriceRecord: vi.fn().mockResolvedValue(undefined),
  deletePriceRecord: vi.fn().mockResolvedValue(undefined),
}));

import { ProductDetailPage } from '../../src/routes/ProductDetailPage';
import { deletePriceRecord, updatePriceRecord } from '../../src/features/prices/api';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/products/p1']}>
      <Routes>
        <Route path="/products/:productId" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('特売込みの底値をヒーロー表示する', () => {
    renderPage();
    const hero = screen.getByTestId('bottom-hero');
    expect(within(hero).getByText('¥158')).toBeInTheDocument();
    expect(within(hero).getByText('特売')).toBeInTheDocument();
    expect(within(hero).getByText(/OKストア/)).toBeInTheDocument();
  });

  it('通常のみの底値を併記する(H-3)', () => {
    renderPage();
    const regular = screen.getByTestId('regular-bottom');
    expect(within(regular).getByText(/¥208/)).toBeInTheDocument();
  });

  it('店舗別底値を表示する', () => {
    renderPage();
    const byStore = screen.getByTestId('by-store');
    expect(within(byStore).getByText('OKストア')).toBeInTheDocument();
    expect(within(byStore).getByText('西友')).toBeInTheDocument();
  });

  it('履歴から記録を削除できる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    const history = screen.getByTestId('history');
    await user.click(within(history).getAllByRole('button', { name: '記録を削除' })[0]);
    expect(deletePriceRecord).toHaveBeenCalledWith('b1', expect.any(String));
  });

  it('履歴から記録を編集できる', async () => {
    const user = userEvent.setup();
    renderPage();
    const history = screen.getByTestId('history');
    await user.click(within(history).getAllByRole('button', { name: '記録を編集' })[0]);
    const price = screen.getByLabelText('価格(税込)');
    await user.clear(price);
    await user.type(price, '148');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(updatePriceRecord).toHaveBeenCalledWith(
      'b1',
      expect.any(String),
      expect.objectContaining({ price: 148 }),
    );
  });
});

describe('ProductDetailPage(特売記録のみ)', () => {
  it('通常のみの底値は「—」を表示する(L-6)', async () => {
    const { usePriceRecords } = await import('../../src/features/prices/api');
    vi.mocked(usePriceRecords).mockReturnValue({
      data: [
        {
          id: 'r-sale',
          productId: 'p1',
          storeId: 's1',
          price: 158,
          quantity: 240,
          unit: 'ml',
          isSale: true,
          recordedAt: now,
        },
      ] as never,
      loading: false,
    });
    renderPage();
    const regular = screen.getByTestId('regular-bottom');
    expect(within(regular).getByText('—')).toBeInTheDocument();
  });
});
