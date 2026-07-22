import { useEffect, useRef, useState } from 'react';
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
  const { user, refreshUser } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [password, setPassword] = useState('');

  if (!user) return null;
  if (!hasPasswordProvider(user)) return null;

  const alreadyLinked = hasGoogleProvider(user);
  const displayGoogleEmail = alreadyLinked ? googleEmailFromUser(user) : undefined;

  async function performLink(options: { withReauth: boolean }) {
    setSubmitting(true);
    setError(null);
    try {
      if (options.withReauth) {
        await reauthenticate(password);
      }
      await linkGoogleAccount();
      await refreshUser();
      setNeedsReauth(false);
      setConfirming(false);
      setPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '連携に失敗しました';
      setError(message);
      setConfirming(false);
      if (
        !options.withReauth &&
        err instanceof LinkGoogleError &&
        err.code === 'auth/requires-recent-login'
      ) {
        setNeedsReauth(true);
      }
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
        disabled={submitting || needsReauth}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-surface text-sm font-bold disabled:opacity-50"
      >
        Google アカウントを連携
      </button>

      {error && !needsReauth && (
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
          onConfirm={() => void performLink({ withReauth: false })}
        />
      )}

      {needsReauth && (
        <ReauthPasswordDialog
          password={password}
          submitting={submitting}
          error={error}
          onPasswordChange={setPassword}
          onCancel={() => {
            if (submitting) return;
            setNeedsReauth(false);
            setPassword('');
            setError(null);
          }}
          onConfirm={() => void performLink({ withReauth: true })}
        />
      )}
    </div>
  );
}

function ReauthPasswordDialog({
  password,
  submitting,
  error,
  onPasswordChange,
  onCancel,
  onConfirm,
}: {
  password: string;
  submitting: boolean;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  const submittingRef = useRef(submitting);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (submittingRef.current) return;
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panelRef.current?.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md items-center justify-center px-6">
      <div
        aria-hidden="true"
        onClick={() => {
          if (!submitting) onCancel();
        }}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="再認証が必要です"
        className="relative w-full rounded-2xl bg-surface p-5"
      >
        <h3 className="text-base font-extrabold">再認証が必要です</h3>
        <p className="mt-2 text-sm text-ink-sub">
          セキュリティのため、パスワードを入力してから再度 Google 連携を行います。
        </p>
        <label className="mt-4 block text-xs font-bold text-ink-sub" htmlFor="link-google-password">
          パスワード
        </label>
        <input
          id="link-google-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-cream px-3 text-sm font-bold"
        />
        {error && (
          <p role="alert" className="mt-2 text-xs font-bold text-sale">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-cream text-sm font-bold text-ink-sub disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={submitting || password.length === 0}
            onClick={onConfirm}
            className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-40"
          >
            再認証して連携
          </button>
        </div>
      </div>
    </div>
  );
}
