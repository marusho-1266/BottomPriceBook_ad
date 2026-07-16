import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, Member, WithId } from '../../../src/types/models';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CHARLIE = 'charlie-uid';
const CODE = 'new-invite-code-123456';

const mocks = vi.hoisted(() => ({
  createInvite: vi.fn(),
  removeMember: vi.fn(),
  leaveBook: vi.fn(),
  useMembers: vi.fn(),
  useBook: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../../src/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/sharing/api')>()),
  createInvite: mocks.createInvite,
  removeMember: mocks.removeMember,
  leaveBook: mocks.leaveBook,
  useMembers: mocks.useMembers,
}));

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: mocks.useBook,
}));

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: mocks.useAuth,
}));

const { ShareSettings } = await import('../../../src/features/sharing/ShareSettings');

function makeBook(memberUids: string[]): WithId<Book> {
  return {
    id: ALICE,
    name: 'アリスの底値帳',
    ownerUid: ALICE,
    memberUids,
    bottomWindowMonths: 6,
    createdAt: Timestamp.now(),
  };
}

function member(id: string, displayName: string): WithId<Member> {
  return { id, displayName, joinedAt: Timestamp.now() };
}

function setBook(
  memberUids: string[],
  members: WithId<Member>[],
  isOwner = true,
  currentUid = isOwner ? ALICE : CHARLIE,
) {
  const book = makeBook(memberUids);
  mocks.useBook.mockReturnValue({
    bookId: book.id,
    book,
    books: [book],
    isOwner,
    setCurrentBookId: vi.fn(),
  });
  mocks.useMembers.mockReturnValue({ data: members, loading: false });
  mocks.useAuth.mockReturnValue({ user: { uid: currentUid }, loading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  setBook([ALICE, BOB], [member(ALICE, 'アリス'), member(BOB, 'ボブ')]);
});

describe('ShareSettings(オーナー)', () => {
  it('招待リンクを発行すると URL と有効期限が表示される', async () => {
    const user = userEvent.setup();
    mocks.createInvite.mockResolvedValue(CODE);
    render(<ShareSettings />);

    await user.click(screen.getByRole('button', { name: '招待リンクを発行' }));

    expect(mocks.createInvite).toHaveBeenCalled();
    expect(await screen.findByText(new RegExp(`/join/${CODE}`))).toBeInTheDocument();
    expect(screen.getByText(/7 ?日間有効/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
  });

  it('メンバー一覧が表示名付きで表示され、オーナーにはバッジが付く', () => {
    render(<ShareSettings />);

    expect(screen.getByText('アリス')).toBeInTheDocument();
    expect(screen.getByText('ボブ')).toBeInTheDocument();
    expect(screen.getByText('オーナー')).toBeInTheDocument();
  });

  it('members doc が無いメンバーは「(名前未設定)」と表示される', () => {
    setBook([ALICE, BOB], [member(ALICE, 'アリス')]);
    render(<ShareSettings />);

    expect(screen.getByText('(名前未設定)')).toBeInTheDocument();
  });

  it('オーナー自身の行には削除ボタンが無い', () => {
    render(<ShareSettings />);

    // 削除ボタンはボブの行の 1 つだけ
    expect(screen.getAllByRole('button', { name: /を削除/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'ボブ を削除' })).toBeInTheDocument();
  });

  it('メンバー削除は確認ダイアログを経て removeMember を呼ぶ', async () => {
    const user = userEvent.setup();
    mocks.removeMember.mockResolvedValue(undefined);
    render(<ShareSettings />);

    await user.click(screen.getByRole('button', { name: 'ボブ を削除' }));
    // 確認ダイアログ
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(mocks.removeMember).toHaveBeenCalledWith(expect.anything(), ALICE, BOB);
  });

  it('確認ダイアログでキャンセルすると削除しない', async () => {
    const user = userEvent.setup();
    render(<ShareSettings />);

    await user.click(screen.getByRole('button', { name: 'ボブ を削除' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(mocks.removeMember).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('非オーナーには招待発行・削除ボタンが表示されない', () => {
    setBook([ALICE, BOB, CHARLIE], [member(ALICE, 'アリス'), member(BOB, 'ボブ')], false);
    render(<ShareSettings />);

    expect(screen.queryByRole('button', { name: '招待リンクを発行' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /を削除/ })).not.toBeInTheDocument();
    // 一覧は閲覧できる
    expect(screen.getByText('ボブ')).toBeInTheDocument();
  });
});

describe('ShareSettings(参加中の book からの退出)', () => {
  it('非オーナーは確認ダイアログを経て退出できる', async () => {
    const user = userEvent.setup();
    setBook([ALICE, BOB, CHARLIE], [member(ALICE, 'アリス')], false);
    mocks.leaveBook.mockResolvedValue(undefined);
    render(<ShareSettings />);

    await user.click(screen.getByRole('button', { name: 'この底値帳から退出' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '退出する' }));

    expect(mocks.leaveBook).toHaveBeenCalledWith(expect.anything(), ALICE, CHARLIE);
  });

  it('退出をキャンセルすると leaveBook を呼ばない', async () => {
    const user = userEvent.setup();
    setBook([ALICE, BOB, CHARLIE], [member(ALICE, 'アリス')], false);
    render(<ShareSettings />);

    await user.click(screen.getByRole('button', { name: 'この底値帳から退出' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(mocks.leaveBook).not.toHaveBeenCalled();
  });

  it('オーナーには退出ボタンが表示されない', () => {
    render(<ShareSettings />);

    expect(screen.queryByRole('button', { name: 'この底値帳から退出' })).not.toBeInTheDocument();
  });
});
