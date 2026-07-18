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

describe('TermsPage(Issue #14)', () => {
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

  it('制定日と戻る導線を表示する', () => {
    renderPage();
    expect(screen.getByText(/制定/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument();
  });
});
