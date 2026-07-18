import { useState, type FormEvent } from 'react';
import { Cat } from 'lucide-react';
import { Link } from 'react-router';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from './api';
import { CONTACT_FORM_URL } from '../legal/contact';

type Mode = 'login' | 'signup' | 'reset';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
  'auth/user-not-found': 'このメールアドレスは登録されていません',
  'auth/wrong-password': 'パスワードが正しくありません',
  'auth/email-already-in-use': 'このメールアドレスは既に登録されています',
  'auth/weak-password': 'パスワードは 6 文字以上にしてください',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
};

function toMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  return AUTH_ERROR_MESSAGES[code] ?? 'エラーが発生しました。時間をおいて再度お試しください';
}

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (mode === 'reset') {
      if (!email) {
        setMessage({ kind: 'error', text: 'メールアドレスを入力してください' });
        return;
      }
      setBusy(true);
      try {
        await resetPassword(email);
        setMessage({ kind: 'info', text: '再設定メールを送信しました。受信箱をご確認ください' });
      } catch (error) {
        setMessage({ kind: 'error', text: toMessage(error) });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email || !password) {
      setMessage({ kind: 'error', text: 'メールアドレスとパスワードを入力してください' });
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (error) {
      setMessage({ kind: 'error', text: toMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage({ kind: 'error', text: toMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <div className="flex flex-col items-center gap-2 rounded-b-[28px] bg-primary px-5 pt-20 pb-10">
        <Cat aria-hidden className="size-12 text-white" strokeWidth={1.8} />
        <h1 className="text-2xl font-extrabold tracking-wider text-white">そこねこ</h1>
        <p className="text-xs font-bold text-white/75">あなたの底値帳</p>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 p-6">
        {mode !== 'reset' && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-chevron bg-surface text-sm font-bold text-ink disabled:opacity-45"
            >
              Google でログイン
            </button>
            <div className="flex items-center gap-3 text-[11px] font-bold text-ink-faint">
              <span className="h-px flex-1 bg-line-strong" />
              または
              <span className="h-px flex-1 bg-line-strong" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-bold text-ink-sub">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-2xl border border-chevron bg-surface px-4 text-sm outline-none focus:border-primary"
            />
          </div>
          {mode !== 'reset' && (
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-bold text-ink-sub">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-chevron bg-surface px-4 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          {message && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={`text-xs font-bold ${message.kind === 'error' ? 'text-sale' : 'text-primary-deep'}`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-2xl bg-primary text-sm font-extrabold text-white active:bg-primary-deep disabled:opacity-45"
          >
            {mode === 'login' ? 'ログイン' : mode === 'signup' ? '登録する' : '再設定メールを送る'}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 pt-2 text-xs font-bold">
          {mode === 'login' && (
            <>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-primary-deep"
              >
                新規登録はこちら
              </button>
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-ink-faint"
              >
                パスワードをお忘れですか?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button type="button" onClick={() => switchMode('login')} className="text-primary-deep">
              ログインに戻る
            </button>
          )}
        </div>

        {/* 登録前に規約・ポリシーを確認できるようにする(Issue #14) */}
        <div className="mt-auto flex items-center justify-center gap-4 pt-6 pb-2 text-[11px] font-bold text-ink-faint">
          <Link to="/terms" className="underline">
            利用規約
          </Link>
          <Link to="/privacy" className="underline">
            プライバシーポリシー
          </Link>
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            お問い合わせ
          </a>
        </div>
      </div>
    </div>
  );
}
