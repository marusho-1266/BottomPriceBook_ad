import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resendVerificationEmail, refreshEmailVerification, signOut } = vi.hoisted(() => ({
  resendVerificationEmail: vi.fn(),
  refreshEmailVerification: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../../src/features/auth/api', () => ({
  resendVerificationEmail,
  refreshEmailVerification,
  signOut,
}));

import { VerifyEmailScreen } from '../../../src/features/auth/VerifyEmailScreen';

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('送信先メールアドレスを表示する', () => {
    render(<VerifyEmailScreen email="a@example.com" onVerified={vi.fn()} />);
    expect(screen.getByText(/a@example.com/)).toBeInTheDocument();
  });

  it('確認済みなら「確認しました」ボタンで onVerified を呼ぶ', async () => {
    const onVerified = vi.fn();
    refreshEmailVerification.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<VerifyEmailScreen email="a@example.com" onVerified={onVerified} />);

    await user.click(screen.getByRole('button', { name: '確認しました' }));

    expect(refreshEmailVerification).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('未確認なら「まだ確認できていません」を表示し onVerified を呼ばない', async () => {
    const onVerified = vi.fn();
    refreshEmailVerification.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<VerifyEmailScreen email="a@example.com" onVerified={onVerified} />);

    await user.click(screen.getByRole('button', { name: '確認しました' }));

    expect(await screen.findByText(/まだ確認できていません/)).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('再送ボタンでメールを再送し、60秒間は無効化される', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resendVerificationEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<VerifyEmailScreen email="a@example.com" onVerified={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /再送/ }));

    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /再送/ })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole('button', { name: /再送/ })).toBeEnabled();
  });

  it('再送が too-many-requests エラーの場合、日本語メッセージを表示する', async () => {
    resendVerificationEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
    const user = userEvent.setup();
    render(<VerifyEmailScreen email="a@example.com" onVerified={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /再送/ }));

    expect(await screen.findByText(/しばらく時間をおいて/)).toBeInTheDocument();
  });

  it('ログアウトボタンで signOut を呼ぶ', async () => {
    signOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<VerifyEmailScreen email="a@example.com" onVerified={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'ログアウト' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
