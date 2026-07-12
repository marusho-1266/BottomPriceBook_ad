import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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
    data: [
      { id: 'p1', name: 'キュキュット 240ml', categoryId: 'detergent' },
      { id: 'p2', name: 'ジョイ 1.2L', categoryId: 'detergent' },
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
        isSale: false,
        recordedAt: now,
      },
      {
        id: 'r2',
        productId: 'p2',
        storeId: 's1',
        price: 298,
        quantity: 1.2,
        unit: 'L',
        isSale: false,
        recordedAt: now,
      },
    ],
    loading: false,
  })),
}));

import { ComparePage } from '../../src/routes/ComparePage';

describe('ComparePage', () => {
  it('カテゴリ内の単価ランキングを安い順に表示する', () => {
    render(
      <MemoryRouter>
        <ComparePage />
      </MemoryRouter>,
    );
    const ranking = screen.getByTestId('ranking');
    const rows = within(ranking).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('ジョイ 1.2L');
    expect(rows[1]).toHaveTextContent('キュキュット 240ml');
    expect(within(rows[0]).getByText(/1位/)).toBeInTheDocument();
  });

  it('基準単位あたりの単価バーを表示する', () => {
    render(
      <MemoryRouter>
        <ComparePage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ranking')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('カテゴリを切り替えられる', async () => {
    const { useCategories } = await import('../../src/features/categories/api');
    vi.mocked(useCategories).mockReturnValue({
      data: [
        { id: 'detergent', name: '洗剤', baseUnit: 'ml', sortOrder: 0 },
        { id: 'food', name: '食品', baseUnit: 'g', sortOrder: 1 },
      ],
      loading: false,
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ComparePage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: '食品' }));
    expect(screen.getByText(/1gあたりで比較/)).toBeInTheDocument();
  });
});
