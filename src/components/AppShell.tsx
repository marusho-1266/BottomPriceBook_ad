import { NavLink, Outlet } from 'react-router';
import { BarChart3, Home, Plus, SlidersHorizontal } from 'lucide-react';
import { DesktopShell } from './DesktopShell';
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

function MobileShell() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-cream">
      <OfflineBanner />
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
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
    </div>
  );
}

export function AppShell() {
  const isDesktop = useIsDesktopLayout();
  return isDesktop ? <DesktopShell /> : <MobileShell />;
}
