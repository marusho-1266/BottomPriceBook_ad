import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { TermsPage } from '../../../src/features/legal/TermsPage';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/terms']}>
      <TermsPage />
    </MemoryRouter>,
  );
}

describe('TermsPage(Issue #14/#37)', () => {
  it('タイトルと主要な節(禁止事項・免責・規約の変更)を表示する', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '利用規約' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /禁止事項/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /免責/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /規約の変更/ })).toBeInTheDocument();
  });

  it('価格情報の正確性を保証しない旨に言及する', () => {
    renderPage();
    expect(screen.getAllByText(/正確性/).length).toBeGreaterThan(0);
  });

  it('無料プランと買い切り・Stripe・返金方針に言及し、無料のみ断定をしない(Issue #37)', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /プラン・料金/ })).toBeInTheDocument();
    expect(screen.getAllByText(/無料プラン/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/買い切り/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stripe/).length).toBeGreaterThan(0);
    expect(screen.getByText(/返品・キャンセルは原則できません/)).toBeInTheDocument();
    expect(screen.queryByText(/無料のサービスです/)).not.toBeInTheDocument();
  });

  it('制定日・改定日と戻る導線を表示する', () => {
    renderPage();
    expect(screen.getByText(/制定/)).toBeInTheDocument();
    expect(screen.getByText(/改定/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument();
  });
});
