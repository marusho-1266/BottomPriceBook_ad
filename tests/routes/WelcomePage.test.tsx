import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { WelcomePage } from '../../src/routes/WelcomePage';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/welcome']}>
      <WelcomePage />
    </MemoryRouter>,
  );
}

describe('WelcomePage(Issue #31)', () => {
  it('ヒーローにブランドと見出しを表示する', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'そこねこ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '店頭で、その場で底値がわかる' })).toBeInTheDocument();
  });

  it('できること 3 点を表示する', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '価格を記録' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '底値を確認' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '単価で比較' })).toBeInTheDocument();
  });

  it('利用イメージを表示する', () => {
    renderPage();
    expect(screen.getByText(/買い物中にスマホでサッと記録/)).toBeInTheDocument();
  });

  it('メイン CTA がログイン画面へリンクする', () => {
    renderPage();
    const ctas = screen.getAllByRole('link', { name: '無料で始める' });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    expect(ctas[0]).toHaveAttribute('href', '/');
  });

  it('フッターから利用規約とプライバシーポリシーへリンクする', () => {
    renderPage();
    expect(screen.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'プライバシーポリシー' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
