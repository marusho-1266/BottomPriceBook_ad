import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    data: [
      { id: 's1', name: 'OKストア' },
      { id: 's2', name: '西友' },
    ],
    loading: false,
  })),
}));

const recordedAt = Timestamp.fromDate(new Date('2026-07-10T00:00:00'));

function priceRecord(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    productId: 'p1',
    storeId: 's1',
    price: 158,
    quantity: 240,
    unit: 'ml',
    isSale: false,
    recordedAt,
    ...over,
  };
}

vi.mock('../../src/features/prices/api', () => ({
  usePriceRecords: vi.fn(() => ({ data: [], loading: false })),
}));

import { usePriceRecords } from '../../src/features/prices/api';
import { ComparePage } from '../../src/routes/ComparePage';

function mockRecords(records: ReturnType<typeof priceRecord>[]) {
  vi.mocked(usePriceRecords).mockReturnValue({
    data: records as never,
    loading: false,
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ComparePage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ComparePage(全記録ランキング)', () => {
  it('商品へ集約せず全記録を単価の安い順に表示する(同一商品が複数行)', () => {
    mockRecords([
      priceRecord({ id: 'r1', productId: 'p1', price: 158, quantity: 240 }), // 0.658
      priceRecord({ id: 'r2', productId: 'p1', price: 120, quantity: 240 }), // 0.5
      priceRecord({ id: 'r3', productId: 'p2', price: 298, quantity: 1.2, unit: 'L' }), // 0.248
    ]);
    renderPage();
    const rows = within(screen.getByTestId('ranking')).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('ジョイ 1.2L');
    expect(rows[1]).toHaveTextContent('キュキュット 240ml');
    expect(rows[2]).toHaveTextContent('キュキュット 240ml');
    expect(within(rows[0]).getByText(/1位/)).toBeInTheDocument();
  });

  it('各行に店舗名と記録日を表示する', () => {
    mockRecords([priceRecord({ id: 'r1', storeId: 's2' })]);
    renderPage();
    const row = within(screen.getByTestId('ranking')).getAllByRole('listitem')[0];
    expect(within(row).getByText(/西友/)).toBeInTheDocument();
    expect(within(row).getByText(/7\/10/)).toBeInTheDocument();
  });

  it('参照切れの店舗は「(不明な店舗)」で表示する', () => {
    mockRecords([priceRecord({ id: 'r1', storeId: 's-deleted' })]);
    renderPage();
    expect(screen.getByText(/(不明な店舗)/)).toBeInTheDocument();
  });

  it('特売由来の行に特売バッジを表示する', () => {
    mockRecords([
      priceRecord({ id: 'sale', isSale: true, price: 100 }),
      priceRecord({ id: 'regular', price: 200 }),
    ]);
    renderPage();
    const rows = within(screen.getByTestId('ranking')).getAllByRole('listitem');
    expect(within(rows[0]).getByText('特売')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('特売')).not.toBeInTheDocument();
  });

  it('単価換算できない記録は末尾にバーなしで単価不明として表示する', () => {
    mockRecords([
      priceRecord({ id: 'ok', price: 158 }),
      priceRecord({ id: 'broken', unit: 'g' }), // ml カテゴリに g は換算不能
    ]);
    renderPage();
    const rows = within(screen.getByTestId('ranking')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByText(/単価不明/)).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(rows[0]).getByRole('progressbar')).toBeInTheDocument();
  });

  it('51件以上は上位50件に切り詰め、「他 N 件」の注記を表示する', () => {
    const records = Array.from({ length: 53 }, (_, i) =>
      priceRecord({ id: `r${i}`, price: 100 + i }),
    );
    mockRecords(records);
    renderPage();
    const items = within(screen.getByTestId('ranking')).getAllByRole('listitem');
    // 50 行 + 注記行
    expect(items).toHaveLength(51);
    expect(screen.getByText(/他 3 件/)).toBeInTheDocument();
    expect(screen.getByText(/上位50件を表示中/)).toBeInTheDocument();
  });

  it('50件以下では注記を表示しない', () => {
    mockRecords([priceRecord({ id: 'r1' })]);
    renderPage();
    expect(screen.queryByText(/を表示中/)).not.toBeInTheDocument();
  });

  it('React の key 重複警告を出さない(record.id ベースのキー)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRecords([
      priceRecord({ id: 'r1', productId: 'p1' }),
      priceRecord({ id: 'r2', productId: 'p1' }),
    ]);
    renderPage();
    const keyWarnings = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes('same key'),
    );
    expect(keyWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('記録が0件のカテゴリでは空表示を出す', () => {
    mockRecords([]);
    renderPage();
    expect(screen.getByText('このカテゴリに記録がありません。')).toBeInTheDocument();
  });

  it('カテゴリを切り替えられる', async () => {
    const { useCategories } = await import('../../src/features/categories/api');
    vi.mocked(useCategories).mockReturnValue({
      data: [
        { id: 'detergent', name: '洗剤', baseUnit: 'ml', sortOrder: 0 },
        { id: 'food', name: '食品', baseUnit: 'g', sortOrder: 1 },
      ],
      loading: false,
    } as never);
    mockRecords([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '食品' }));
    expect(screen.getByText(/1gあたりで比較/)).toBeInTheDocument();
  });
});
