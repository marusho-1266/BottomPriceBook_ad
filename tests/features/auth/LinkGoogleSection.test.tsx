import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  linkGoogleAccount: vi.fn(),
  reauthenticate: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('../../../src/features/auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/auth/api')>()),
  linkGoogleAccount: mocks.linkGoogleAccount,
}));

vi.mock('../../../src/features/account/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/account/api')>()),
  reauthenticate: mocks.reauthenticate,
}));

const { LinkGoogleSection } = await import('../../../src/features/auth/LinkGoogleSection');
const { LinkGoogleError } = await import('../../../src/features/auth/api');

function setupUser(providerData: { providerId: string; email?: string }[]) {
  mocks.useAuth.mockReturnValue({
    user: { uid: 'u1', email: 'mail@example.com', providerData },
    loading: false,
    refreshUser: mocks.refreshUser,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshUser.mockResolvedValue(undefined);
  setupUser([{ providerId: 'password', email: 'mail@example.com' }]);
});

describe('LinkGoogleSection', () => {
  it('password のみのとき連携ボタンを表示する', () => {
    render(<LinkGoogleSection />);
    expect(screen.getByRole('button', { name: 'Google アカウントを連携' })).toBeInTheDocument();
  });

  it('Google のみのユーザーにはセクションを出さない', () => {
    setupUser([{ providerId: 'google.com', email: 'g@example.com' }]);
    const { container } = render(<LinkGoogleSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('既に Google 連携済みなら連携済み表示のみ', () => {
    setupUser([
      { providerId: 'password', email: 'mail@example.com' },
      { providerId: 'google.com', email: 'g@example.com' },
    ]);
    render(<LinkGoogleSection />);
    expect(screen.getByText(/Google 連携済み/)).toBeInTheDocument();
    expect(screen.getByText('g@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Google アカウントを連携' })).not.toBeInTheDocument();
  });

  it('確認キャンセルでは linkGoogleAccount を呼ばない', async () => {
    const user = userEvent.setup();
    render(<LinkGoogleSection />);

    await user.click(screen.getByRole('button', { name: 'Google アカウントを連携' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(mocks.linkGoogleAccount).not.toHaveBeenCalled();
  });

  it('確認後に連携成功すると refreshUser 後に連携済み表示になる', async () => {
    const user = userEvent.setup();
    mocks.linkGoogleAccount.mockResolvedValue('linked@gmail.com');
    mocks.refreshUser.mockImplementation(async () => {
      setupUser([
        { providerId: 'password', email: 'mail@example.com' },
        { providerId: 'google.com', email: 'linked@gmail.com' },
      ]);
    });
    render(<LinkGoogleSection />);

    await user.click(screen.getByRole('button', { name: 'Google アカウントを連携' }));
    await user.click(screen.getByRole('button', { name: '連携する' }));

    expect(mocks.linkGoogleAccount).toHaveBeenCalledTimes(1);
    expect(mocks.refreshUser).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Google 連携済み/)).toBeInTheDocument();
    expect(screen.getByText('linked@gmail.com')).toBeInTheDocument();
  });

  it('衝突エラーでは確認ダイアログを閉じ、アラートを表示する', async () => {
    const user = userEvent.setup();
    mocks.linkGoogleAccount.mockRejectedValue(
      new LinkGoogleError(
        'この Google アカウントは既に別のユーザーで使われています。そのアカウントでログインするか、別の Google を選んでください',
        'auth/credential-already-in-use',
      ),
    );
    render(<LinkGoogleSection />);

    await user.click(screen.getByRole('button', { name: 'Google アカウントを連携' }));
    await user.click(screen.getByRole('button', { name: '連携する' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'この Google アカウントは既に別のユーザーで使われています',
    );
  });

  it('requires-recent-login 時は再認証ダイアログを出し、メインボタンを無効化する', async () => {
    const user = userEvent.setup();
    mocks.linkGoogleAccount
      .mockRejectedValueOnce(
        new LinkGoogleError(
          'セキュリティのため再認証が必要です。パスワードを入力してから再度お試しください',
          'auth/requires-recent-login',
        ),
      )
      .mockResolvedValueOnce('linked@gmail.com');
    mocks.reauthenticate.mockResolvedValue(undefined);
    mocks.refreshUser.mockImplementation(async () => {
      setupUser([
        { providerId: 'password', email: 'mail@example.com' },
        { providerId: 'google.com', email: 'linked@gmail.com' },
      ]);
    });

    render(<LinkGoogleSection />);

    await user.click(screen.getByRole('button', { name: 'Google アカウントを連携' }));
    await user.click(screen.getByRole('button', { name: '連携する' }));

    expect(screen.getByRole('alertdialog', { name: '再認証が必要です' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google アカウントを連携' })).toBeDisabled();

    await user.type(screen.getByLabelText(/パスワード/), 'secret123');
    await user.click(screen.getByRole('button', { name: '再認証して連携' }));

    expect(mocks.reauthenticate).toHaveBeenCalledWith('secret123');
    expect(mocks.linkGoogleAccount).toHaveBeenCalledTimes(2);
    expect(mocks.refreshUser).toHaveBeenCalledTimes(1);
    expect(screen.getByText('linked@gmail.com')).toBeInTheDocument();
  });
});
