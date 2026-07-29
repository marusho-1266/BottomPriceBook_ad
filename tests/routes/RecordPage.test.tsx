import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useBookMock } = vi.hoisted(() => ({
  useBookMock: vi.fn((): {
    bookId: string;
    book: unknown;
    isOwner?: boolean;
  } => ({ bookId: 'b1', book: null })),
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
const { useProducts, useStores } = vi.hoisted(() => ({
  useProducts: vi.fn(() => ({
    data: [
      { id: 'p1', name: 'キュキュット 本体 240ml', categoryId: 'detergent' },
      { id: 'p2', name: 'コシヒカリ 5kg', categoryId: 'food' },
      { id: 'p3', name: 'ジョイ 300ml', categoryId: 'detergent' },
    ],
    loading: false,
  })),
  useStores: vi.fn(() => ({
    data: [
      { id: 's1', name: 'OKストア' },
      { id: 's2', name: '別店舗' },
    ],
    loading: false,
  })),
}));
vi.mock('../../src/features/products/api', () => ({
  useProducts,
  addProduct: vi.fn().mockResolvedValue('new-product-id'),
}));
vi.mock('../../src/features/stores/api', () => ({
  useStores,
  addStore: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/features/prices/api', () => ({
  addPriceRecord: vi.fn().mockResolvedValue(undefined),
  usePriceRecords: vi.fn(() => ({ data: [], loading: false })),
}));

import { RecordPage } from '../../src/routes/RecordPage';
import { addPriceRecord, usePriceRecords } from '../../src/features/prices/api';
import { addStore } from '../../src/features/stores/api';

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
    useBookMock.mockReturnValue({
      bookId: 'b1',
      book: { ownerLicenseStatus: 'lifetime' },
      isOwner: true,
    });
    useProducts.mockReturnValue({
      data: [
        { id: 'p1', name: 'キュキュット 本体 240ml', categoryId: 'detergent' },
        { id: 'p2', name: 'コシヒカリ 5kg', categoryId: 'food' },
        { id: 'p3', name: 'ジョイ 300ml', categoryId: 'detergent' },
      ],
      loading: false,
    });
    useStores.mockReturnValue({
      data: [
        { id: 's1', name: 'OKストア' },
        { id: 's2', name: '別店舗' },
      ],
      loading: false,
    });
  });

  it('無料枠上限到達時は商品新規登録を隠し既存商品は選べる(Issue #36)', async () => {
    const user = userEvent.setup();
    useBookMock.mockReturnValue({
      bookId: 'b1',
      book: { ownerLicenseStatus: 'free' },
      isOwner: true,
    });
    useProducts.mockReturnValue({
      data: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        name: `商品${i}`,
        categoryId: 'food',
      })),
      loading: false,
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /商品/ }));
    expect(screen.queryByRole('button', { name: '+ 新しい商品を登録' })).not.toBeInTheDocument();
    expect(screen.getByText('商品の上限に達しました。買い切りで無制限になります')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '商品0' })).toBeInTheDocument();
  });

  it('無料枠上限到達時は店舗追加フォームを出さず CTA を出す(Issue #36)', async () => {
    const user = userEvent.setup();
    useBookMock.mockReturnValue({
      bookId: 'b1',
      book: { ownerLicenseStatus: 'free' },
      isOwner: true,
    });
    useStores.mockReturnValue({
      data: [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
        { id: 's3', name: 'C' },
      ],
      loading: false,
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /店舗/ }));
    expect(screen.queryByLabelText('新しい店舗名')).not.toBeInTheDocument();
    expect(screen.getByText('店舗の上限に達しました。買い切りで無制限になります')).toBeInTheDocument();
    expect(addStore).not.toHaveBeenCalled();
  });

  it('usePriceRecords に windowMonths/now を渡す(Issue #17: クエリ絞り込み回帰防止)', () => {
    renderPage();
    expect(usePriceRecords).toHaveBeenCalledWith({
      windowMonths: expect.any(Number),
      now: expect.any(Date),
    });
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
    // 自分が1位なので2位(既存の別店舗記録)を表示
    expect(
      screen.getByText(/2位: キュキュット 本体 240ml \/ 別店舗 \/ 1\.0円\/ml/),
    ).toBeInTheDocument();
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
    // 自分が2位なので1位(既存記録)を表示
    expect(
      screen.getByText(/1位: キュキュット 本体 240ml \/ 別店舗 \/ 1\.0円\/ml/),
    ).toBeInTheDocument();
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
    // 候補なしのため比較行は出さない
    expect(screen.queryByText(/\d位:/)).not.toBeInTheDocument();
  });

  it('暫定順位: 期間外の記録のみなら除外後は 1 位 / 1 件中', async () => {
    useBookMock.mockReturnValue({
      bookId: 'b1',
      book: { bottomWindowMonths: 1, ownerLicenseStatus: 'lifetime' },
      isOwner: true,
    });
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
