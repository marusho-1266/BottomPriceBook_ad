import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchableCombobox } from '../../src/components/SearchableCombobox';

const options = [
  { id: 'p1', label: 'キュキュット 本体 240ml' },
  { id: 'p2', label: 'コシヒカリ 5kg' },
  { id: 'p3', label: 'ジョイ 300ml' },
];

describe('SearchableCombobox', () => {
  it('開くと候補一覧を表示し、選択できる', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchableCombobox
        fieldLabel="商品"
        options={options}
        selectedId={null}
        selectedLabel={null}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: '商品を選択' }));
    expect(screen.getByRole('listbox', { name: '商品の候補' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'コシヒカリ 5kg' }));
    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  it('検索文字で候補を絞り込む', async () => {
    const user = userEvent.setup();
    render(
      <SearchableCombobox
        fieldLabel="商品"
        options={options}
        selectedId={null}
        selectedLabel={null}
        onSelect={() => {}}
        searchPlaceholder="商品名で検索..."
      />,
    );

    await user.click(screen.getByRole('button', { name: '商品を選択' }));
    await user.type(screen.getByRole('combobox', { name: '商品を検索' }), 'ジョイ');
    expect(screen.getByRole('option', { name: 'ジョイ 300ml' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'コシヒカリ 5kg' })).not.toBeInTheDocument();
  });

  it('該当なしのとき空メッセージを出す', async () => {
    const user = userEvent.setup();
    render(
      <SearchableCombobox
        fieldLabel="商品"
        options={options}
        selectedId={null}
        selectedLabel={null}
        onSelect={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: '商品を選択' }));
    await user.type(screen.getByRole('combobox', { name: '商品を検索' }), '存在しない');
    expect(screen.getByText('該当する項目がありません')).toBeInTheDocument();
  });

  it('キーボードで候補を選択できる', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchableCombobox
        fieldLabel="商品"
        options={options}
        selectedId={null}
        selectedLabel={null}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: '商品を選択' }));
    const input = screen.getByRole('combobox', { name: '商品を検索' });
    await user.type(input, '{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  it('閉じると onOpenChange(false) を呼ぶ', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchableCombobox
        fieldLabel="商品"
        options={options}
        selectedId={null}
        selectedLabel={null}
        onSelect={() => {}}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '商品を選択' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
