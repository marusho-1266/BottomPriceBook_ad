import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../../src/components/AppShell';

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
  it('4 つのタブ(ホーム・記録・比較・設定)を表示する', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '記録' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '比較' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '設定' })).toBeInTheDocument();
  });

  it('子ルートのコンテンツを表示する', () => {
    renderShell('/compare');
    expect(screen.getByText('compare-content')).toBeInTheDocument();
  });

  it('現在のタブに aria-current が付く', () => {
    renderShell('/settings');
    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('aria-current', 'page');
  });
});
