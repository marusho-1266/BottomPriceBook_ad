import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../src/components/AppShell';
import { stubMatchMedia, type MatchMediaController } from '../helpers/matchMedia';

function renderShell(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>home-content</div>} />
          <Route path="record" element={<div>record-content</div>} />
          <Route path="compare" element={<div>compare-content</div>} />
          <Route path="settings" element={<div>settings-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  let media: MatchMediaController;

  afterEach(() => {
    media?.restore();
  });

  describe('モバイル幅(< 768px)', () => {
    it('4 つのタブ(ホーム・記録・比較・設定)を表示する', () => {
      media = stubMatchMedia(false);
      renderShell();
      expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '記録' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '比較' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '設定' })).toBeInTheDocument();
    });

    it('子ルートのコンテンツを表示する', () => {
      media = stubMatchMedia(false);
      renderShell('/compare');
      expect(screen.getByText('compare-content')).toBeInTheDocument();
    });

    it('現在のタブに aria-current が付く', () => {
      media = stubMatchMedia(false);
      renderShell('/settings');
      expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('aria-current', 'page');
    });

    it('ボトムタブを表示し、サイドナビのブランドは出ない', () => {
      media = stubMatchMedia(false);
      renderShell();
      expect(screen.queryByText('そこねこ')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'メインナビゲーション' })).not.toBeInTheDocument();
    });
  });

  describe('デスクトップ幅(≥ 768px)', () => {
    it('サイドナビにホーム・記録・比較・設定を表示する', () => {
      media = stubMatchMedia(true);
      renderShell();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toBeInTheDocument();
      expect(screen.getByText('そこねこ')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '記録' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '比較' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '設定' })).toBeInTheDocument();
    });

    it('子ルートのコンテンツを表示する', () => {
      media = stubMatchMedia(true);
      renderShell('/record');
      expect(screen.getByText('record-content')).toBeInTheDocument();
    });

    it('現在のナビに aria-current が付く', () => {
      media = stubMatchMedia(true);
      renderShell('/compare');
      expect(screen.getByRole('link', { name: '比較' })).toHaveAttribute('aria-current', 'page');
    });
  });
});
