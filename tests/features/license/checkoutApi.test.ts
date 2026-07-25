import { beforeEach, describe, expect, it, vi } from 'vitest';

const { httpsCallable, functions } = vi.hoisted(() => ({
  httpsCallable: vi.fn(),
  functions: {},
}));

vi.mock('firebase/functions', () => ({ httpsCallable }));
vi.mock('../../../src/lib/firebase', () => ({
  db: {},
  functions,
}));

import { CheckoutError, startCheckout } from '../../../src/features/license/api';

describe('startCheckout', () => {
  beforeEach(() => {
    httpsCallable.mockReset();
  });

  it('Callable の URL へ遷移する', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/c/pay/cs_test' },
    });
    httpsCallable.mockReturnValue(callable);
    const assign = vi.fn();

    await startCheckout(assign);

    expect(httpsCallable).toHaveBeenCalledWith(functions, 'createCheckoutSession');
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test');
  });

  it('lifetime 済みは専用メッセージ', async () => {
    const callable = vi.fn().mockRejectedValue({ code: 'functions/failed-precondition' });
    httpsCallable.mockReturnValue(callable);

    await expect(startCheckout(vi.fn())).rejects.toSatisfy(
      (error: unknown) => error instanceof CheckoutError && error.message === 'すでに買い切り済みです',
    );
  });
});
