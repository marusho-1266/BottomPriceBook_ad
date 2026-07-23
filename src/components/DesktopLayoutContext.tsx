import { DesktopLayoutContext } from './desktopLayoutContextValue';

/** AppShell 配下で共有する「md 以上か」の単一情報源 */
export function DesktopLayoutProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <DesktopLayoutContext.Provider value={value}>{children}</DesktopLayoutContext.Provider>
  );
}
