import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { useBook } from '../books/BookProvider';
import {
  INVITE_TTL_DAYS,
  buildInviteUrl,
  createInvite,
  leaveBook,
  removeMember,
  useMembers,
} from './api';

const UNNAMED = '(名前未設定)';

/** 設定画面の「共有」セクション */
export function ShareSettings() {
  const { bookId, book, isOwner } = useBook();
  const { user } = useAuth();
  const { data: members } = useMembers(bookId);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ uid: string; name: string } | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  if (!book) return null;

  // メンバーシップの真実のソース memberUids を基準に、members doc の表示名を突合する
  const rows = book.memberUids.map((uid) => ({
    uid,
    name: members.find((member) => member.id === uid)?.displayName || UNNAMED,
    isBookOwner: uid === book.ownerUid,
  }));

  async function handleIssue() {
    if (!book) return;
    setIssuing(true);
    try {
      const code = await createInvite(db, { id: book.id, name: book.name, ownerUid: book.ownerUid });
      setInviteUrl(buildInviteUrl(code));
      setCopied(false);
    } finally {
      setIssuing(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  async function handleRemove() {
    if (!removeTarget) return;
    await removeMember(db, bookId, removeTarget.uid);
    setRemoveTarget(null);
  }

  async function handleLeave() {
    if (!user) return;
    // 退出後は BookProvider のリストクエリから消え、自分の book に自動フォールバックする
    await leaveBook(db, bookId, user.uid);
    setConfirmingLeave(false);
  }

  return (
    <section className="mx-4 mt-4 rounded-2xl bg-surface px-4 py-4">
      <div className="text-xs font-bold text-ink-faint">共有</div>

      <ul className="mt-2">
        {rows.map((row) => (
          <li
            key={row.uid}
            className="flex items-center gap-2 border-b border-line py-2.5 last:border-b-0"
          >
            <span className="flex-1 text-sm font-bold">{row.name}</span>
            {row.isBookOwner && (
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold text-ink-sub">
                オーナー
              </span>
            )}
            {isOwner && !row.isBookOwner && (
              <button
                type="button"
                onClick={() => setRemoveTarget({ uid: row.uid, name: row.name })}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-sale"
              >
                {row.name} を削除
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="h-11 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-40"
          >
            招待リンクを発行
          </button>
          {inviteUrl && (
            <div className="rounded-xl bg-cream p-3">
              <p className="text-xs break-all">{inviteUrl}</p>
              <p className="mt-1 text-[11px] text-ink-faint">
                このリンクは {INVITE_TTL_DAYS} 日間有効です。参加してほしい人に送ってください。
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 h-9 w-full rounded-lg border border-chevron bg-surface text-xs font-bold text-primary-deep"
              >
                {copied ? 'コピーしました' : 'リンクをコピー'}
              </button>
            </div>
          )}
        </div>
      )}

      {!isOwner && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setConfirmingLeave(true)}
            className="h-11 w-full rounded-xl border border-chevron bg-surface text-sm font-bold text-sale"
          >
            この底値帳から退出
          </button>
        </div>
      )}

      <p className="mt-3 text-center">
        <Link to="/join" className="text-xs font-bold text-primary">
          招待コードを入力して参加
        </Link>
      </p>

      {removeTarget && (
        <ConfirmDialog
          title="メンバーを削除"
          description={`${removeTarget.name} をこの底値帳から削除します。削除しても、これまでの価格記録は残ります。`}
          confirmLabel="削除する"
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {confirmingLeave && (
        <ConfirmDialog
          title="底値帳から退出"
          description={`「${book.name}」から退出します。退出しても、これまでの価格記録は残ります。再参加には新しい招待が必要です。`}
          confirmLabel="退出する"
          onConfirm={handleLeave}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
    </section>
  );
}
