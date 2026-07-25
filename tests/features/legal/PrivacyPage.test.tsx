import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { PrivacyPage } from '../../../src/features/legal/PrivacyPage';
import { CONTACT_FORM_URL } from '../../../src/features/legal/contact';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/privacy']}>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPage(Issue #14/#37)', () => {
  it('タイトルと主要な節(収集する情報・利用目的・お問い合わせ)を表示する', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'プライバシーポリシー' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /収集する情報/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /利用目的/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /お問い合わせ/ })).toBeInTheDocument();
  });

  it('収集情報としてメールアドレス・アクセス解析・エラー情報に言及する', () => {
    renderPage();
    expect(screen.getAllByText(/メールアドレス/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Firebase Analytics|アクセス解析/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sentry|エラー/).length).toBeGreaterThan(0);
  });

  it('決済代行 Stripe とカード非保存に言及する(Issue #37)', () => {
    renderPage();
    expect(screen.getAllByText(/Stripe/).length).toBeGreaterThan(0);
    expect(screen.getByText(/クレジットカード番号は保存しません/)).toBeInTheDocument();
  });

  it('問い合わせフォームへ新規タブで安全に遷移するリンクを持つ', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /お問い合わせフォーム/ });
    expect(link).toHaveAttribute('href', CONTACT_FORM_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('制定日・改定日と戻る導線を表示する', () => {
    renderPage();
    expect(screen.getByText(/制定/)).toBeInTheDocument();
    expect(screen.getByText(/改定/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument();
  });
});
