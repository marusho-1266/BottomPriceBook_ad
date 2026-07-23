import { NavLink } from 'react-router';
import { BarChart3, Home, Plus, SlidersHorizontal } from 'lucide-react';

function SideNavLink({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
          isActive
            ? 'bg-primary/15 text-primary-deep'
            : 'text-ink-sub hover:bg-line/80 hover:text-ink'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

/** PC シェル左サイドナビ(Outlet は AppShell 側で共有) */
export function DesktopSideNav() {
  return (
    <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-line-strong bg-surface-alt px-3 py-5">
      <div className="mb-5 flex items-center gap-2.5 px-3">
        <img
          src="/pwa-192x192.png"
          alt=""
          className="size-8 rounded-lg object-cover"
        />
        <span className="text-lg font-extrabold text-ink">そこねこ</span>
      </div>
      <nav className="flex flex-col gap-1" aria-label="メインナビゲーション">
        <SideNavLink to="/" end label="ホーム" icon={<Home className="size-5" strokeWidth={2} />} />
        <SideNavLink to="/record" label="記録" icon={<Plus className="size-5" strokeWidth={2} />} />
        <SideNavLink
          to="/compare"
          label="比較"
          icon={<BarChart3 className="size-5" strokeWidth={2} />}
        />
        <SideNavLink
          to="/settings"
          label="設定"
          icon={<SlidersHorizontal className="size-5" strokeWidth={2} />}
        />
      </nav>
    </aside>
  );
}
