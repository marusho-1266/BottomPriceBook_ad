import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { refreshEmailVerification, resendVerificationEmail, signOut } from './api';

const RESEND_COOLDOWN_SECONDS = 60;

const ERROR_MESSAGES: Record<string, string> = {
  'auth/too-many-requests': 'リクエストが多すぎます。しばらく時間をおいてお試しください',
};

function toMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  return ERROR_MESSAGES[code] ?? 'エラーが発生しました。時間をおいて再度お試しください';
}

interface Props {
  email: string;
  onVerified: () => void;
}

export function VerifyEmailScreen({ email, onVerified }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const verified = await refreshEmailVerification();
      if (verified) {
        onVerified();
      } else {
        setMessage({
          kind: 'error',
          text: 'まだ確認できていません。メール内のリンクを開いてから再度お試しください',
        });
      }
    } catch (error) {
      setMessage({ kind: 'error', text: toMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await resendVerificationEmail();
      setMessage({ kind: 'info', text: '確認メールを再送しました。受信箱をご確認ください' });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage({ kind: 'error', text: toMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-cream p-6 text-center">
      <Mail aria-hidden className="size-12 text-primary" strokeWidth={1.8} />
      <div>
        <h1 className="text-lg font-extrabold text-ink">メールアドレスの確認</h1>
        <p className="mt-2 text-sm font-bold text-ink-sub">
          <span className="break-all">{email}</span> 宛のメールアドレス確認が必要です。
        </p>
        <p className="mt-1 text-xs font-bold text-ink-faint">
          メール内のリンクを開いてから「確認しました」を押してください。
          <br />
          届いていない場合は迷惑メールフォルダをご確認のうえ、再送してください。
        </p>
      </div>

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`text-xs font-bold ${message.kind === 'error' ? 'text-sale' : 'text-primary-deep'}`}
        >
          {message.text}
        </p>
      )}

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={handleCheck}
          disabled={busy}
          className="h-12 rounded-2xl bg-primary text-sm font-extrabold text-white active:bg-primary-deep disabled:opacity-45"
        >
          確認しました
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={busy || cooldown > 0}
          className="h-12 rounded-2xl border border-chevron bg-surface text-sm font-bold text-ink disabled:opacity-45"
        >
          {cooldown > 0 ? `確認メールを再送(${cooldown}秒後に再試行可)` : '確認メールを再送'}
        </button>
        <button type="button" onClick={handleSignOut} className="text-xs font-bold text-ink-faint">
          ログアウト
        </button>
      </div>
    </div>
  );
}
