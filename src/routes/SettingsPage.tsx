import { signOut } from '../features/auth/api';

export function SettingsPage() {
  return (
    <div className="p-5 pt-16">
      <h2 className="text-lg font-extrabold">設定</h2>
      <button
        type="button"
        onClick={() => signOut()}
        className="mt-6 h-12 w-full rounded-2xl border border-chevron bg-surface text-sm font-bold text-sale"
      >
        ログアウト
      </button>
    </div>
  );
}
