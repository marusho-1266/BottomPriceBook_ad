import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { reauthenticate } from '../account/api';
import { useAuth } from './AuthProvider';
import {
  hasGoogleProvider,
  hasPasswordProvider,
  linkGoogleAccount,
  LinkGoogleError,
} from './api';

function googleEmailFromUser(user: {
  providerData: { providerId: string; email?: string | null }[];
}): string | undefined {
  return user.providerData.find((p) => p.providerId === 'google.com')?.email ?? undefined;
}

/** 設定画面用: メール登録ユーザーが Google を同一アカウントに連携するセクション */
export function LinkGoogleSection() {
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [password, setPassword] = useState('');
  const [linkedEmail, setLinkedEmail] = useState<string | undefined>(undefined);
  const [locallyLinked, setLocallyLinked] = useState(false);

  if (!user) return null;
  if (!hasPasswordProvider(user)) return null;

  const alreadyLinked = locallyLinked || hasGoogleProvider(user);
  const displayGoogleEmail =
    linkedEmail ?? (hasGoogleProvider(user) ? googleEmailFromUser(user) : undefined);

  async function runLink() {
    setSubmitting(true);
    setError(null);
    try {
      const email = await linkGoogleAccount();
      setLinkedEmail(email);
      setLocallyLinked(true);
      setNeedsReauth(false);
      setConfirming(false);
      setPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '連携に失敗しました';
      setError(message);
      if (err instanceof LinkGoogleError && err.code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
        setConfirming(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReauthAndLink() {
    setSubmitting(true);
    setError(null);
    try {
      await reauthenticate(password);
      const email = await linkGoogleAccount();
      setLinkedEmail(email);
      setLocallyLinked(true);
      setNeedsReauth(false);
      setPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '連携に失敗しました';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyLinked) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-line bg-surface px-4 py-3.5">
        <p className="text-sm font-bold">Google 連携済み</p>
        {displayGoogleEmail && (
          <p className="mt-1 text-xs font-bold text-ink-sub">{displayGoogleEmail}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4">
      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-surface text-sm font-bold disabled:opacity-50"
      >
        Google アカウントを連携
      </button>

      {needsReauth && (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <label className="block text-xs font-bold text-ink-sub" htmlFor="link-google-password">
            パスワード
          </label>
          <input
            id="link-google-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-line bg-cream px-3 text-sm font-bold"
          />
          <button
            type="button"
            disabled={submitting || password.length === 0}
            onClick={() => void handleReauthAndLink()}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50"
          >
            再認証して連携
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-sale">
          {error}
        </p>
      )}

      {confirming && (
        <ConfirmDialog
          title="Google アカウントを連携"
          description="ログイン中のメールと異なる Google アカウントでも連携できます。連携後は Google ログインでも同じ底値帳を使えます。"
          confirmLabel="連携する"
          confirmDisabled={submitting}
          onCancel={() => {
            if (submitting) return;
            setConfirming(false);
          }}
          onConfirm={() => void runLink()}
        />
      )}
    </div>
  );
}
