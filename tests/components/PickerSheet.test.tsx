import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PickerSheet } from '../../src/components/PickerSheet';

describe('PickerSheet', () => {
  it('オーバーレイは画面全幅を覆い、シート幅だけ制限する(PCでの帯状暗転防止)', () => {
    render(
      <PickerSheet title="底値帳を切り替え" onClose={vi.fn()}>
        <p>候補</p>
      </PickerSheet>,
    );

    const backdrop = screen.getByTestId('picker-sheet-backdrop');
    const shell = backdrop.parentElement;
    expect(shell?.className.split(/\s+/)).toEqual(expect.arrayContaining(['fixed', 'inset-0']));
    expect(shell?.className.split(/\s+/)).not.toContain('max-w-md');

    const panel = screen.getByRole('heading', { name: '底値帳を切り替え' }).parentElement
      ?.parentElement;
    expect(panel?.className.split(/\s+/)).toContain('max-w-md');
  });

  it('背景タップで onClose を呼ぶ', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PickerSheet title="選択" onClose={onClose}>
        <p>候補</p>
      </PickerSheet>,
    );

    await user.click(screen.getByTestId('picker-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
