import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpgradeCta } from '../../../src/features/license/UpgradeCta';
import { LIFETIME_PRICE_CTA_LABEL } from '../../../src/features/license/pricing';

const { startCheckout } = vi.hoisted(() => ({
  startCheckout: vi.fn(),
}));

vi.mock('../../../src/features/license/api', () => ({
  startCheckout,
}));

describe('UpgradeCta', () => {
  beforeEach(() => {
    startCheckout.mockReset();
    startCheckout.mockResolvedValue(undefined);
  });

  it('購入 CTA に税込 ¥480 を表示し、クリックで Checkout を開始する', async () => {
    const user = userEvent.setup();
    render(<UpgradeCta message="買い切りで無制限になります" />);

    const button = screen.getByRole('button', { name: LIFETIME_PRICE_CTA_LABEL });
    await user.click(button);

    expect(startCheckout).toHaveBeenCalledTimes(1);
  });

  it('showPurchaseHint=false のときは購入 CTA を出さない（ゲスト向け）', () => {
    render(<UpgradeCta message="ゲスト向け説明" showPurchaseHint={false} />);

    expect(screen.getByText('ゲスト向け説明')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LIFETIME_PRICE_CTA_LABEL })).not.toBeInTheDocument();
  });
});
