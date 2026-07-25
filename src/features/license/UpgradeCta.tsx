import { useState } from 'react';
import { startCheckout } from './api';
import { LIFETIME_PRICE_CTA_LABEL } from './pricing';

/** 買い切り導線。決済は #37 の createCheckoutSession → Stripe Checkout */
export function UpgradeCta({
  message,
  /** false のとき購入誘導（CTA）を出さない（共有ゲスト向け説明など） */
  showPurchaseHint = true,
}: {
  message: string;
  showPurchaseHint?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    setBusy(true);
    setError(null);
    try {
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : '購入ページを開けませんでした');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-cream px-3 py-2.5">
      <p className="text-xs font-bold text-ink-sub">{message}</p>
      {showPurchaseHint && (
        <div className="mt-2">
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => {
              void handlePurchase();
            }}
          >
            {busy ? '準備中…' : LIFETIME_PRICE_CTA_LABEL}
          </button>
          {error && (
            <p className="mt-1 text-[11px] font-bold text-sale" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
