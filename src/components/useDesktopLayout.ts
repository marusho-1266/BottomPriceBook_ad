import { useContext } from 'react';
import { DesktopLayoutContext } from './desktopLayoutContextValue';

/** AppShell が提供するデスクトップ判定。シェル外では false */
export function useDesktopLayout(): boolean {
  return useContext(DesktopLayoutContext);
}
