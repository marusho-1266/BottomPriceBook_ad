import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';

function renderDialog(onConfirm = vi.fn(), onCancel = vi.fn()) {
  return render(
    <ConfirmDialog
      title="削除の確認"
      description="この操作は取り消せません"
      confirmLabel="削除する"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
}

describe('ConfirmDialog', () => {
  it('開くとダイアログ内の先頭ボタンにフォーカスが移る', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toHaveFocus();
  });

  it('Escape キーで onCancel を呼ぶ', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog(vi.fn(), onCancel);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Tab はダイアログ内をループする', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.tab();
    expect(screen.getByRole('button', { name: '削除する' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: '削除する' })).toHaveFocus();
  });

  it('閉じると開いた時の要素にフォーカスを戻す', async () => {
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            開く
          </button>
          {open && (
            <ConfirmDialog
              title="削除の確認"
              description="この操作は取り消せません"
              confirmLabel="削除する"
              onConfirm={() => {}}
              onCancel={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Wrapper />);
    const opener = screen.getByRole('button', { name: '開く' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});
