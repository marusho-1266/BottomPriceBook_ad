import { ChevronRight, FolderTree, StoreIcon } from 'lucide-react';
import { Link } from 'react-router';
import { signOut } from '../features/auth/api';

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
  return (
    <div>
      <header className="px-4 pt-14 pb-3">
        <h2 className="text-lg font-extrabold">設定</h2>
      </header>
      <div className="mx-4 rounded-2xl bg-surface">
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
      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="h-12 w-full rounded-2xl border border-chevron bg-surface text-sm font-bold text-sale"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
