import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useBook } from '../books/BookProvider';
import { AccountDeletionError, deleteAccount, reauthenticate } from './api';

/** 退会(アカウント削除)の確認・再認証ダイアログ */
export function DeleteAccountDialog({ onCancel }: { onCancel: () => void }) {
  const { user } = useAuth();
  const { book, isOwner } = useBook();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isEmailProvider = user.providerData[0]?.providerId === 'password';
  const hasOtherMembers = isOwner && (book?.memberUids.length ?? 0) > 1;
  const confirmDisabled = submitting || (isEmailProvider && password.length === 0);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await reauthenticate(isEmailProvider ? password : undefined);
      await deleteAccount(user!.uid);
      // 成功後は Auth の削除でサインアウト状態になり、既存のログインガードで
      // ログイン画面へ遷移する。ここでは何もしない
    } catch (err) {
      setError(err instanceof AccountDeletionError ? err.message : '削除に失敗しました。もう一度お試しください。');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md items-center justify-center px-6">
      <div
        aria-hidden="true"
        onClick={submitting ? undefined : onCancel}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="アカウントを削除"
        className="relative w-full rounded-2xl bg-surface p-5"
      >
        <h3 className="text-base font-extrabold">アカウントを削除</h3>
        <ul className="mt-2 list-disc pl-4 text-sm text-ink-sub">
          <li>あなたの底値帳とすべての記録が削除されます</li>
          <li>発行した招待コードが削除されます</li>
          <li>参加中の底値帳からは退出します(あなたの記録は残ります)</li>
        </ul>

        {hasOtherMembers && (
          <p role="alert" className="mt-3 text-xs font-bold text-sale">
            この底値帳には他のメンバーがいます。削除すると、メンバーもこの底値帳を使えなくなります。
          </p>
        )}

        {isEmailProvider ? (
          <div className="mt-3">
            <label htmlFor="delete-account-password" className="text-xs font-bold text-ink-faint">
              本人確認のためパスワードを入力してください
            </label>
            <input
              id="delete-account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              className="mt-2 h-11 w-full rounded-xl border border-line bg-cream px-3 text-sm outline-none"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-faint">
            本人確認のため、もう一度 Google でログインします。
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-xs font-bold text-sale">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-11 flex-1 rounded-xl bg-cream text-sm font-bold text-ink-sub disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="h-11 flex-1 rounded-xl bg-sale text-sm font-bold text-white disabled:opacity-40"
          >
            {submitting ? '削除しています…' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  );
}
