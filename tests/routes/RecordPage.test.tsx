import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useBookMock } = vi.hoisted(() => ({
  useBookMock: vi.fn(() => ({ bookId: 'b1', book: null as unknown })),
}));
vi.mock('../../src/features/books/BookProvider', () => ({
  useBook: useBookMock,
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
      { id: 'p3', name: 'ジョイ 300ml', categoryId: 'detergent' },
    ],
    loading: false,
  })),
  addProduct: vi.fn().mockResolvedValue('new-product-id'),
}));
vi.mock('../../src/features/stores/api', () => ({
  useStores: vi.fn(() => ({
    data: [
      { id: 's1', name: 'OKストア' },
      { id: 's2', name: '別店舗' },
    ],
    loading: false,
  })),
  addStore: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/features/prices/api', () => ({
  addPriceRecord: vi.fn().mockResolvedValue(undefined),
  usePriceRecords: vi.fn(() => ({ data: [], loading: false })),
}));

import { RecordPage } from '../../src/routes/RecordPage';
import { addPriceRecord, usePriceRecords } from '../../src/features/prices/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <RecordPage />
    </MemoryRouter>,
  );
}

async function selectProduct(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /商品/ }));
  await user.click(screen.getByRole('button', { name }));
}

async function selectStore(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /店舗/ }));
  await user.click(screen.getByRole('button', { name }));
}

describe('RecordPage(電卓ファースト)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks は mockReturnValue を解除しないため、既定値を毎回設定し直す
    vi.mocked(usePriceRecords).mockReturnValue({ data: [], loading: false } as unknown as ReturnType<typeof usePriceRecords>);
    useBookMock.mockReturnValue({ bookId: 'b1', book: null });
  });

  it('テンキーで価格を入力できる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByText('¥158')).toBeInTheDocument();
  });

  it('バックスペースで 1 桁消せる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: '1文字削除' }));
    expect(screen.getByText('¥1')).toBeInTheDocument();
  });

  it('商品・店舗・価格・内容量・特売を入力して記録できる', async () => {
    const user = userEvent.setup();
    renderPage();

    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');

    // 価格 158
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: '8' }));

    // 内容量へ切替 → 240
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: '0' }));

    await user.click(screen.getByLabelText('特売'));
    await user.click(screen.getByRole('button', { name: '記録する' }));

    expect(addPriceRecord).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        productId: 'p1',
        storeId: 's1',
        price: 158,
        quantity: 240,
        unit: 'ml',
        isSale: true,
      }),
    );
  });

  it('商品のカテゴリに応じた単位が選べる(g カテゴリなら g / kg)', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'コシヒカリ 5kg');
    const unitSelect = screen.getByLabelText('単位');
    expect(unitSelect).toHaveValue('g');
    expect(screen.getByRole('option', { name: 'kg' })).toBeInTheDocument();
  });

  it('未選択・未入力で記録するとエラーを表示し保存しない', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '記録する' }));
    expect(addPriceRecord).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('総量入力のヒントを表示する(L-4)', () => {
    renderPage();
    expect(screen.getByText(/総量を入力/)).toBeInTheDocument();
  });

  it('暫定順位: 入力途中(内容量未入力)は順位を表示しない', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');
    await user.click(screen.getByRole('button', { name: '1' }));
    expect(screen.queryByText(/暫定/)).not.toBeInTheDocument();
    expect(screen.queryByText(/比較できる記録がありません/)).not.toBeInTheDocument();
  });

  it('暫定順位: 店舗未選択の間は価格・内容量が揃っても順位を表示しない', async () => {
    vi.mocked(usePriceRecords).mockReturnValue({
      data: [
        {
          id: 'r1',
          productId: 'p1',
          storeId: 's2',
          price: 300,
          quantity: 300,
          unit: 'ml',
          isSale: false,
          recordedAt: new Date(),
        },
      ],
      loading: false,
    } as unknown as ReturnType<typeof usePriceRecords>);

    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));

    expect(screen.queryByText(/暫定/)).not.toBeInTheDocument();
    expect(screen.queryByText(/比較できる記録がありません/)).not.toBeInTheDocument();
  });

  it('暫定順位: 同一商品・別店舗の既存記録があれば順位を表示する(Issue #8)', async () => {
    // 同一商品 p1 の別店舗 s2 に 1.0 円/ml の記録
    vi.mocked(usePriceRecords).mockReturnValue({
      data: [
        {
          id: 'r1',
          productId: 'p1',
          storeId: 's2',
          price: 300,
          quantity: 300,
          unit: 'ml',
          isSale: false,
          recordedAt: new Date(),
        },
      ],
      loading: false,
    } as unknown as ReturnType<typeof usePriceRecords>);

    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');
    // 価格 100 / 内容量 200ml → 0.5 円/ml < 1.0 → 暫定 1 位 / 2 件中
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));

    expect(screen.getByText(/このカテゴリで暫定 1 位 \/ 2 件中/)).toBeInTheDocument();
  });

  it('暫定順位: 入力値を変えると順位表示が即座に更新される', async () => {
    vi.mocked(usePriceRecords).mockReturnValue({
      data: [
        {
          id: 'r1',
          productId: 'p1',
          storeId: 's2',
          price: 300,
          quantity: 300,
          unit: 'ml',
          isSale: false,
          recordedAt: new Date(),
        },
      ],
      loading: false,
    } as unknown as ReturnType<typeof usePriceRecords>);

    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    expect(screen.getByText(/暫定 1 位/)).toBeInTheDocument();

    // 価格を 1000 に変更 → 5.0 円/ml > 1.0 → 2 位
    await user.click(screen.getByRole('button', { name: /価格/ }));
    await user.click(screen.getByRole('button', { name: '0' }));
    expect(screen.getByText(/暫定 2 位/)).toBeInTheDocument();
  });

  it('暫定順位: 同一商品・同一店舗のみ既存なら除外して 1 位 / 1 件中', async () => {
    vi.mocked(usePriceRecords).mockReturnValue({
      data: [
        {
          id: 'r1',
          productId: 'p1',
          storeId: 's1',
          price: 300,
          quantity: 300,
          unit: 'ml',
          isSale: false,
          recordedAt: new Date(),
        },
      ],
      loading: false,
    } as unknown as ReturnType<typeof usePriceRecords>);

    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByText(/このカテゴリで暫定 1 位 \/ 1 件中/)).toBeInTheDocument();
    expect(screen.queryByText(/比較できる記録がありません/)).not.toBeInTheDocument();
  });

  it('暫定順位: 期間外の記録のみなら除外後は 1 位 / 1 件中', async () => {
    useBookMock.mockReturnValue({ bookId: 'b1', book: { bottomWindowMonths: 1 } });
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    vi.mocked(usePriceRecords).mockReturnValue({
      data: [
        {
          id: 'r1',
          productId: 'p1',
          storeId: 's2',
          price: 300,
          quantity: 300,
          unit: 'ml',
          isSale: false,
          recordedAt: threeMonthsAgo,
        },
      ],
      loading: false,
    } as unknown as ReturnType<typeof usePriceRecords>);

    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByText(/このカテゴリで暫定 1 位 \/ 1 件中/)).toBeInTheDocument();
    expect(screen.queryByText(/比較できる記録がありません/)).not.toBeInTheDocument();
  });

  it('記録後は価格がリセットされ、商品・店舗は保持される', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectProduct(user, 'キュキュット 本体 240ml');
    await selectStore(user, 'OKストア');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /内容量/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '記録する' }));

    expect(await screen.findByText('記録しました')).toBeInTheDocument();
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.getByText('キュキュット 本体 240ml')).toBeInTheDocument();
  });
});
