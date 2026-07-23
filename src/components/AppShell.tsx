import { NavLink, Outlet } from 'react-router';
import { BarChart3, Home, Plus, SlidersHorizontal } from 'lucide-react';
import { DesktopLayoutProvider } from './DesktopLayoutContext';
import { DesktopSideNav } from './DesktopShell';
import { OfflineBanner } from './OfflineBanner';
import { useIsDesktopLayout } from './useIsDesktopLayout';

function Tab({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-w-16 flex-col items-center gap-0.5 pt-1 text-[10px] ${
          isActive ? 'font-bold text-primary' : 'font-medium text-ink-faint'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-start justify-around border-t border-line-strong bg-surface-alt px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
      <Tab to="/" label="ホーム" icon={<Home className="size-6" strokeWidth={2} />} />
      <NavLink to="/record" className="-mt-5 flex min-w-16 flex-col items-center gap-0.5">
        {({ isActive }) => (
          <>
            <span
              className={`flex size-13 items-center justify-center rounded-full shadow-lg shadow-primary/40 ${
                isActive ? 'bg-primary-deep' : 'bg-primary'
              }`}
            >
              <Plus className="size-6 text-white" strokeWidth={2.6} />
            </span>
            <span className="text-[10px] font-bold text-primary-deep">記録</span>
          </>
        )}
      </NavLink>
      <Tab to="/compare" label="比較" icon={<BarChart3 className="size-6" strokeWidth={2} />} />
      <Tab
        to="/settings"
        label="設定"
        icon={<SlidersHorizontal className="size-6" strokeWidth={2} />}
      />
    </nav>
  );
}

/**
 * 認証後シェル。Outlet のツリー位置を固定し、リサイズで Mobile/Desktop の
 * クロムだけ切り替えてルート配下の状態(記録フォーム等)を保持する。
 */
export function AppShell() {
  const isDesktop = useIsDesktopLayout();

  return (
    <DesktopLayoutProvider value={isDesktop}>
      <div
        className={`flex min-h-dvh flex-col bg-cream ${isDesktop ? '' : 'mx-auto max-w-md'}`}
      >
        <OfflineBanner />
        <div className={`flex min-h-0 flex-1 ${isDesktop ? 'flex-row' : 'flex-col'}`}>
          {isDesktop ? <DesktopSideNav /> : null}
          <div className={`min-w-0 flex-1 ${isDesktop ? '' : 'pb-24'}`}>
            <div className={isDesktop ? 'mx-auto w-full max-w-6xl px-2' : undefined}>
              <Outlet />
            </div>
          </div>
          {isDesktop ? null : <MobileBottomNav />}
        </div>
      </div>
    </DesktopLayoutProvider>
  );
}
