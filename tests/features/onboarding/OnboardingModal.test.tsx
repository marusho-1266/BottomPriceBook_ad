import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingModal } from '../../../src/features/onboarding/OnboardingModal';
import { ONBOARDING_SLIDES } from '../../../src/features/onboarding/content';

describe('OnboardingModal', () => {
  it('初期表示は1枚目のスライドで、戻るボタンは無い', () => {
    render(<OnboardingModal onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText(ONBOARDING_SLIDES[0].title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '戻る' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '次へ' })).toBeInTheDocument();
  });

  it('次へ/戻るでページが移動し、最終ページのみ「はじめる」が表示される', async () => {
    const user = userEvent.setup();
    render(<OnboardingModal onComplete={vi.fn()} onSkip={vi.fn()} />);

    for (let i = 1; i < ONBOARDING_SLIDES.length; i++) {
      await user.click(screen.getByRole('button', { name: '次へ' }));
      expect(screen.getByText(ONBOARDING_SLIDES[i].title)).toBeInTheDocument();
    }

    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'はじめる' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '戻る' }));
    expect(
      screen.getByText(ONBOARDING_SLIDES[ONBOARDING_SLIDES.length - 2].title),
    ).toBeInTheDocument();
  });

  it('最終ページで「はじめる」を押すと onComplete が呼ばれる', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} onSkip={vi.fn()} />);

    for (let i = 1; i < ONBOARDING_SLIDES.length; i++) {
      await user.click(screen.getByRole('button', { name: '次へ' }));
    }
    await user.click(screen.getByRole('button', { name: 'はじめる' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('任意のページで「スキップ」を押すと onSkip が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<OnboardingModal onComplete={vi.fn()} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: 'スキップ' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('Escape キーでは閉じない(誤操作防止)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    render(<OnboardingModal onComplete={onComplete} onSkip={onSkip} />);

    await user.keyboard('{Escape}');

    expect(onComplete).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('背景(オーバーレイ)タップでは閉じない(誤操作防止)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    render(<OnboardingModal onComplete={onComplete} onSkip={onSkip} />);

    await user.click(screen.getByTestId('onboarding-backdrop'));

    expect(onComplete).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });
});
