/** 買い切り導線のプレースホルダ。決済接続は #37 */
export function UpgradeCta({
  message,
  /** false のとき購入誘導の副文を出さない（共有ゲスト向け説明など） */
  showPurchaseHint = true,
}: {
  message: string;
  showPurchaseHint?: boolean;
}) {
  return (
    <div className="rounded-xl bg-cream px-3 py-2.5">
      <p className="text-xs font-bold text-ink-sub">{message}</p>
      {showPurchaseHint && (
        <p className="mt-1 text-[11px] font-bold text-ink-faint">
          買い切りで無制限になります（準備中）
        </p>
      )}
    </div>
  );
}
