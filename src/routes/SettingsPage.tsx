import { useState } from 'react';
import {
  ChevronRight,
  Download,
  FileText,
  FolderTree,
  HelpCircle,
  Mail,
  ShieldCheck,
  StoreIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { DeleteAccountDialog } from '../features/account/DeleteAccountDialog';
import { CONTACT_FORM_URL } from '../features/legal/contact';
import { signOut } from '../features/auth/api';
import {
  BOTTOM_WINDOW_OPTIONS,
  updateBook,
} from '../features/books/api';
import { useBook } from '../features/books/BookProvider';
import { OnboardingModal } from '../features/onboarding/OnboardingModal';
import { downloadPriceRecordsCsv } from '../features/prices/export';
import { fetchPriceRecords } from '../features/prices/api';
import { fetchProducts } from '../features/products/api';
import { fetchStores } from '../features/stores/api';
import { ShareSettings } from '../features/sharing/ShareSettings';
import { db } from '../lib/firebase';
import { trackEvent } from '../lib/analytics';

function SettingsLink({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-sm font-bold last:border-b-0"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-chevron" />
    </Link>
  );
}

export function SettingsPage() {
  const { bookId, book, isOwner } = useBook();
  const bookName = book?.name ?? '';
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? bookName;
  const windowMonths = book?.bottomWindowMonths ?? 6;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  function handleShowOnboarding() {
    setShowOnboarding(true);
    trackEvent('onboarding_reopened');
  }

  async function handleWindowChange(months: number) {
    await updateBook(db, bookId, { bottomWindowMonths: months });
  }

  async function handleNameSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateBook(db, bookId, { name: trimmed });
    setNameDraft(null);
  }

  /**
   * 設定画面マウント中の常時購読を避けるため、エクスポート時にのみ全期間データを取得する。
   * 3 件を並行取得してから CSV 生成するので、読み込み中の一部データだけで
   * 不完全な CSV が出力されることもない
   */
  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(false);
    try {
      const [records, products, stores] = await Promise.all([
        fetchPriceRecords(bookId),
        fetchProducts(bookId),
        fetchStores(bookId),
      ]);
      downloadPriceRecordsCsv(records, products, stores, book?.name ?? '');
    } catch {
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <header className="px-4 pt-14 pb-3">
        <h2 className="text-lg font-extrabold">設定</h2>
      </header>

      {/* 名前・対象期間の編集はオーナーのみ。参加中の book では閲覧表示(Issue #7) */}
      <section className="mx-4 rounded-2xl bg-surface px-4 py-4">
        <label htmlFor="book-name" className="text-xs font-bold text-ink-faint">
          底値帳の名前
        </label>
        {isOwner ? (
          <div className="mt-2 flex gap-2">
            <input
              id="book-name"
              value={name}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleNameSave}
              className="shrink-0 rounded-xl bg-primary px-4 text-xs font-bold text-white"
            >
              名前を保存
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm font-bold">{bookName}</p>
        )}
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-surface px-4 py-4">
        <div className="text-xs font-bold text-ink-faint">底値の対象期間</div>
        {isOwner ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {BOTTOM_WINDOW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleWindowChange(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                  windowMonths === option.value
                    ? 'bg-primary text-white'
                    : 'bg-cream text-ink-sub'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-bold">
            {BOTTOM_WINDOW_OPTIONS.find((option) => option.value === windowMonths)?.label ??
              `${windowMonths}ヶ月`}
          </p>
        )}
      </section>

      <ShareSettings />

      <div className="mx-4 mt-4 rounded-2xl bg-surface">
        <SettingsLink
          to="/settings/categories"
          label="カテゴリ管理"
          icon={<FolderTree className="size-5" />}
        />
        <SettingsLink
          to="/settings/stores"
          label="店舗管理"
          icon={<StoreIcon className="size-5" />}
        />
      </div>

      {/* 規約・ポリシー・問い合わせ(Issue #14) */}
      <div className="mx-4 mt-4 rounded-2xl bg-surface">
        <SettingsLink to="/terms" label="利用規約" icon={<FileText className="size-5" />} />
        <SettingsLink
          to="/privacy"
          label="プライバシーポリシー"
          icon={<ShieldCheck className="size-5" />}
        />
        <a
          href={CONTACT_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-sm font-bold last:border-b-0"
        >
          <span className="text-primary">
            <Mail className="size-5" />
          </span>
          <span className="flex-1">お問い合わせ</span>
          <ChevronRight className="size-4 text-chevron" />
        </a>
      </div>

      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={handleShowOnboarding}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold"
        >
          <HelpCircle className="size-4" />
          使い方を見る
        </button>
      </div>

      <div className="mx-4 mt-4">
        <button
          type="button"
          disabled={isExporting}
          onClick={handleExport}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold disabled:opacity-50"
        >
          <Download className="size-4" />
          データをエクスポート
        </button>
        {exportError && (
          <p role="alert" className="mt-2 text-xs font-bold text-sale">
            エクスポートに失敗しました。時間をおいて再度お試しください
          </p>
        )}
      </div>

      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="h-12 w-full rounded-2xl border border-chevron bg-surface text-sm font-bold text-sale"
        >
          ログアウト
        </button>
      </div>

      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="h-12 w-full rounded-2xl text-sm font-bold text-sale"
        >
          アカウントを削除(退会)
        </button>
      </div>

      {confirmingDelete && (
        <DeleteAccountDialog onCancel={() => setConfirmingDelete(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal
          onComplete={() => {
            trackEvent('onboarding_completed');
            setShowOnboarding(false);
          }}
          onSkip={() => {
            trackEvent('onboarding_skipped');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
}
