import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { useBook } from '../books/BookProvider';
import { fetchInvite, isInviteValid, joinBook } from './api';
import type { Invite, WithId } from '../../types/models';

/** ブラウザのオンライン状態(OfflineBanner と同じ検知方法) */
function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

type InviteState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'fetchError' }
  | { status: 'loaded'; invite: WithId<Invite> };

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user } = useAuth();
  const { books, setCurrentBookId } = useBook();
  const navigate = useNavigate();
  const online = useOnline();
  const [state, setState] = useState<InviteState>({ status: 'loading' });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    fetchInvite(db, inviteCode)
      .then((invite) => {
        if (cancelled) return;
        setState(invite ? { status: 'loaded', invite } : { status: 'notFound' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'fetchError' });
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const openBook = (bookId: string) => {
    setCurrentBookId(bookId);
    navigate('/');
  };

  const handleJoin = async (invite: WithId<Invite>) => {
    if (!user) return;
    setJoining(true);
    setJoinError(false);
    try {
      await joinBook(db, {
        bookId: invite.bookId,
        inviteCode: invite.id,
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? '',
      });
      openBook(invite.bookId);
    } catch {
      setJoinError(true);
      setJoining(false);
    }
  };

  return (
    <div className="min-h-dvh bg-cream">
      <header className="px-4 pt-14 pb-3">
        <h2 className="text-lg font-extrabold">底値帳への招待</h2>
      </header>
      <section className="mx-4 rounded-2xl bg-surface px-4 py-5">
        {state.status === 'loading' && (
          <p className="text-sm font-bold text-ink-faint">招待を確認中…</p>
        )}
        {state.status === 'notFound' && (
          <p className="text-sm font-bold text-ink-sub">
            招待が見つかりません。リンクが正しいか、発行者に確認してください。
          </p>
        )}
        {state.status === 'fetchError' && (
          <p className="text-sm font-bold text-ink-sub">
            招待を確認できませんでした。通信状態を確認して開き直してください。
          </p>
        )}
        {state.status === 'loaded' && (
          <InviteBody
            invite={state.invite}
            alreadyJoined={books.some((book) => book.id === state.invite.bookId)}
            online={online}
            joining={joining}
            joinError={joinError}
            onJoin={() => handleJoin(state.invite)}
            onOpen={() => openBook(state.invite.bookId)}
          />
        )}
      </section>
      <p className="px-6 py-4 text-center">
        <Link to="/" className="text-sm font-bold text-primary">
          ホームへ戻る
        </Link>
      </p>
    </div>
  );
}

function InviteBody({
  invite,
  alreadyJoined,
  online,
  joining,
  joinError,
  onJoin,
  onOpen,
}: {
  invite: WithId<Invite>;
  alreadyJoined: boolean;
  online: boolean;
  joining: boolean;
  joinError: boolean;
  onJoin: () => void;
  onOpen: () => void;
}) {
  if (!isInviteValid(invite)) {
    return (
      <p className="text-sm font-bold text-ink-sub">
        この招待は有効期限が切れています。発行者に新しい招待を依頼してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold text-ink-faint">招待された底値帳</p>
        <p className="text-xl font-extrabold">{invite.bookName}</p>
        <p className="mt-1 text-xs text-ink-faint">
          有効期限: {invite.expiresAt.toDate().toLocaleDateString('ja-JP')}
        </p>
      </div>
      {alreadyJoined ? (
        <>
          <p className="text-sm font-bold text-ink-sub">この底値帳には参加済みです。</p>
          <button
            onClick={onOpen}
            className="rounded-full bg-primary px-6 py-3 text-sm font-extrabold text-white"
          >
            この底値帳を開く
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onJoin}
            disabled={!online || joining}
            className="rounded-full bg-primary px-6 py-3 text-sm font-extrabold text-white disabled:opacity-40"
          >
            参加する
          </button>
          {!online && (
            <p className="text-xs font-bold text-ink-sub">
              オフラインのため参加できません。オンラインで参加してください。
            </p>
          )}
          {joinError && (
            <p className="text-xs font-bold text-sale">
              参加できませんでした。招待の期限切れか、通信エラーの可能性があります。
            </p>
          )}
        </>
      )}
    </div>
  );
}
