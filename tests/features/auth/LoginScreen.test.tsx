import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

// LoginScreen は規約・ポリシーへの <Link> を含むため Router 配下で描画する(Issue #14)
function render(ui: ReactNode) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
}

vi.mock('../../../src/features/auth/api', () => ({
  signInWithGoogle: vi.fn().mockResolvedValue(undefined),
  signInWithEmail: vi.fn().mockResolvedValue(undefined),
  signUpWithEmail: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue(undefined),
}));

import { LoginScreen } from '../../../src/features/auth/LoginScreen';
import { resetPassword, signInWithEmail, signUpWithEmail } from '../../../src/features/auth/api';

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Google ログインボタンとメールフォームを表示する', () => {
    render(<LoginScreen />);
    expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument();
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
  });

  it('メールとパスワードを入力してログインできる', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await user.type(screen.getByLabelText('パスワード'), 'password1');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(signInWithEmail).toHaveBeenCalledWith('a@example.com', 'password1');
  });

  it('新規登録モードに切り替えて登録できる', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: '新規登録はこちら' }));
    await user.type(screen.getByLabelText('メールアドレス'), 'b@example.com');
    await user.type(screen.getByLabelText('パスワード'), 'password2');
    await user.click(screen.getByRole('button', { name: '登録する' }));
    expect(signUpWithEmail).toHaveBeenCalledWith('b@example.com', 'password2');
  });

  it('パスワードリセットモードで再設定メールを送信できる', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: 'パスワードをお忘れですか?' }));
    await user.type(screen.getByLabelText('メールアドレス'), 'c@example.com');
    await user.click(screen.getByRole('button', { name: '再設定メールを送る' }));
    expect(resetPassword).toHaveBeenCalledWith('c@example.com');
    expect(await screen.findByText(/再設定メールを送信しました/)).toBeInTheDocument();
  });

  it('未入力で送信するとバリデーションエラーを表示し API を呼ばない', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(signInWithEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/メールアドレスとパスワードを入力してください/)).toBeInTheDocument();
  });

  it('利用規約・プライバシーポリシー・お問い合わせへのリンクを表示する(Issue #14)', () => {
    render(<LoginScreen />);
    expect(screen.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'プライバシーポリシー' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    const contact = screen.getByRole('link', { name: 'お問い合わせ' });
    expect(contact).toHaveAttribute('target', '_blank');
    expect(contact).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
