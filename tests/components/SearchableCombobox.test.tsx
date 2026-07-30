import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchableCombobox } from '../../src/components/SearchableCombobox';
import type { ComponentProps } from 'react';

const options = [
  { id: 'p1', label: 'キュキュット 本体 240ml' },
  { id: 'p2', label: 'コシヒカリ 5kg' },
  { id: 'p3', label: 'ジョイ 300ml' },
];

const TRIGGER = '商品: 選択してください';

function renderCombobox(props: Partial<ComponentProps<typeof SearchableCombobox>> = {}) {
  return render(
    <SearchableCombobox
      fieldLabel="商品"
      options={options}
      selectedId={null}
      selectedLabel={null}
      onSelect={() => {}}
      {...props}
    />,
  );
}

describe('SearchableCombobox', () => {
  it('開くと候補一覧を表示し、選択できる', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderCombobox({ onSelect });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    expect(screen.getByRole('listbox', { name: '商品の候補' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'コシヒカリ 5kg' }));
    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  it('検索文字で候補を絞り込む', async () => {
    const user = userEvent.setup();
    renderCombobox({ searchPlaceholder: '商品名で検索...' });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.type(screen.getByRole('combobox', { name: '商品を検索' }), 'ジョイ');
    expect(screen.getByRole('option', { name: 'ジョイ 300ml' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'コシヒカリ 5kg' })).not.toBeInTheDocument();
  });

  it('該当なしのとき空メッセージを出す', async () => {
    const user = userEvent.setup();
    renderCombobox();

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.type(screen.getByRole('combobox', { name: '商品を検索' }), '存在しない');
    expect(screen.getByText('該当する項目がありません')).toBeInTheDocument();
  });

  it('キーボードで候補を選択できる', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderCombobox({ onSelect });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.type(screen.getByRole('combobox', { name: '商品を検索' }), '{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  it('ArrowUp は末尾の候補へ回り込む', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderCombobox({ onSelect });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.type(screen.getByRole('combobox', { name: '商品を検索' }), '{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p3');
  });

  it('閉じているトリガーで ArrowDown を押すと開く', async () => {
    const user = userEvent.setup();
    renderCombobox();

    screen.getByRole('button', { name: TRIGGER }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox', { name: '商品の候補' })).toBeInTheDocument();
  });

  it('閉じると onOpenChange(false) を呼ぶ', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderCombobox({ onOpenChange });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('外側をクリックすると閉じる', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">外側</button>
        <SearchableCombobox
          fieldLabel="商品"
          options={options}
          selectedId={null}
          selectedLabel={null}
          onSelect={() => {}}
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    expect(screen.getByRole('listbox', { name: '商品の候補' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '外側' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // 外側クリックのときはユーザーが移った先のフォーカスを奪わない
    expect(screen.getByRole('button', { name: '外側' })).toHaveFocus();
  });

  it('選択済みの値がトリガーのアクセシブル名に含まれる', () => {
    renderCombobox({ selectedId: 'p3', selectedLabel: 'ジョイ 300ml' });
    expect(screen.getByRole('button', { name: '商品: ジョイ 300ml' })).toBeInTheDocument();
  });

  it('候補を選ぶとトリガーへフォーカスが戻る', async () => {
    const user = userEvent.setup();
    renderCombobox();

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.click(screen.getByRole('option', { name: 'ジョイ 300ml' }));
    expect(screen.getByRole('button', { name: TRIGGER })).toHaveFocus();
  });

  it('Escape で閉じてもトリガーへフォーカスが戻る', async () => {
    const user = userEvent.setup();
    renderCombobox();

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: TRIGGER })).toHaveFocus();
  });

  it('候補ボタンは Tab 順に入らない', async () => {
    const user = userEvent.setup();
    renderCombobox();

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('tabindex', '-1');
    }
  });

  it('hideList のとき候補リストと検索欄を畳んで children だけ出す', async () => {
    const user = userEvent.setup();
    renderCombobox({ hideList: true, children: <p>新規登録フォーム</p> });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    expect(screen.getByText('新規登録フォーム')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('children にフォーカスがあっても Escape で閉じる', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderCombobox({
      onOpenChange,
      hideList: true,
      children: <input aria-label="新しい店舗名" />,
    });

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    await user.click(screen.getByLabelText('新しい店舗名'));
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
