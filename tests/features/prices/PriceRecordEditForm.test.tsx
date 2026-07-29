import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PRICE, MAX_QUANTITY } from '../../../src/features/prices/limits';
import { PriceRecordEditForm } from '../../../src/features/prices/PriceRecordEditForm';
import type { PriceRecord, Store, WithId } from '../../../src/types/models';

const stores: WithId<Store>[] = [
  { id: 's1', name: 'OKストア' },
  { id: 's2', name: '西友' },
];

const record: WithId<PriceRecord> = {
  id: 'r1',
  productId: 'p1',
  storeId: 's1',
  price: 158,
  quantity: 240,
  unit: 'ml',
  isSale: true,
  recordedAt: Timestamp.fromDate(new Date('2026-03-15T12:00:00')),
};

const onSave = vi.fn().mockResolvedValue(undefined);
const onCancel = vi.fn();

describe('PriceRecordEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初期値が表示される', () => {
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText('価格(税込)')).toHaveValue(158);
    expect(screen.getByLabelText('内容量')).toHaveValue(240);
    expect(screen.getByLabelText('単位')).toHaveValue('ml');
    expect(screen.getByLabelText('特売')).toBeChecked();
    expect(screen.getByLabelText('日付')).toHaveValue('2026-03-15');
    expect(screen.getByLabelText('店舗')).toHaveValue('s1');
  });

  it('全項目を変更して保存すると期待 patch が onSave に渡る', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    await user.clear(screen.getByLabelText('価格(税込)'));
    await user.type(screen.getByLabelText('価格(税込)'), '200');
    await user.clear(screen.getByLabelText('内容量'));
    await user.type(screen.getByLabelText('内容量'), '1');
    await user.selectOptions(screen.getByLabelText('単位'), 'L');
    await user.click(screen.getByLabelText('特売'));
    fireEvent.change(screen.getByLabelText('日付'), { target: { value: '2026-04-01' } });
    await user.selectOptions(screen.getByLabelText('店舗'), 's2');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onSave).toHaveBeenCalledWith({
      price: 200,
      quantity: 1,
      unit: 'L',
      isSale: false,
      storeId: 's2',
      recordedAt: new Date('2026-04-01T12:00:00'),
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('不正な価格では onSave を呼ばずエラーを表示する', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.clear(screen.getByLabelText('価格(税込)'));
    await user.type(screen.getByLabelText('価格(税込)'), '0');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/価格を正しく入力/)).toBeInTheDocument();
  });

  it('不正な内容量では onSave を呼ばずエラーを表示する', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.clear(screen.getByLabelText('内容量'));
    await user.type(screen.getByLabelText('内容量'), '-1');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/内容量を正しく入力/)).toBeInTheDocument();
  });

  it('上限を超える価格・内容量では onSave を呼ばずエラーを表示する', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    await user.clear(screen.getByLabelText('価格(税込)'));
    await user.type(screen.getByLabelText('価格(税込)'), String(MAX_PRICE + 1));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/価格は.*以下/);

    await user.clear(screen.getByLabelText('価格(税込)'));
    await user.type(screen.getByLabelText('価格(税込)'), String(MAX_PRICE));
    await user.clear(screen.getByLabelText('内容量'));
    await user.type(screen.getByLabelText('内容量'), String(MAX_QUANTITY + 1));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/内容量は.*以下/);
  });

  it('内容量に小数を入力してもブラウザの制約検証で弾かれない', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    const quantity = screen.getByLabelText<HTMLInputElement>('内容量');
    await user.clear(quantity);
    await user.type(quantity, '1.5');
    // step 既定値(=1)のままだと stepMismatch で submit 自体が止まる
    expect(quantity.validity.stepMismatch).toBe(false);
    expect(quantity.checkValidity()).toBe(true);

    await user.selectOptions(screen.getByLabelText('単位'), 'L');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1.5, unit: 'L' }));
  });

  it('入力を直すとエラー表示が消える', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    await user.clear(screen.getByLabelText('価格(税込)'));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText('価格(税込)'), '198');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('店舗未選択では onSave を呼ばずエラーを表示する', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={{ ...record, storeId: '' }}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/店舗を選択/)).toBeInTheDocument();
  });

  it('保存に失敗するとエラーを表示し編集内容を保持したまま再試行できる', async () => {
    const user = userEvent.setup();
    // ルール違反・レート制限・オフライン等で updatePriceRecord が reject するケース
    const failingSave = vi.fn().mockRejectedValue(new Error('permission-denied'));
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={failingSave}
        onCancel={onCancel}
      />,
    );

    await user.clear(screen.getByLabelText('価格(税込)'));
    await user.type(screen.getByLabelText('価格(税込)'), '200');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/保存に失敗しました/);
    // 入力値が失われず、保存ボタンも再度押せる状態に戻ること
    expect(screen.getByLabelText('価格(税込)')).toHaveValue(200);
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(failingSave).toHaveBeenCalledTimes(2);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('キャンセルで onCancel が呼ばれ onSave は呼ばれない', async () => {
    const user = userEvent.setup();
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('単位選択肢が baseUnit に制限される', () => {
    render(
      <PriceRecordEditForm
        record={record}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    const options = withinSelectOptions(screen.getByLabelText('単位'));
    expect(options).toEqual(['ml', 'L']);
  });

  it('単位が候補外なら先頭単位にフォールバックする', () => {
    render(
      <PriceRecordEditForm
        record={{ ...record, unit: '個' }}
        stores={stores}
        baseUnit="ml"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText('単位')).toHaveValue('ml');
  });
});

function withinSelectOptions(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map((o) => o.value);
}
