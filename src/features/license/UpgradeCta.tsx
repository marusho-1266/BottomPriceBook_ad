/** 買い切り導線のプレースホルダ。決済接続は #37 */
export function UpgradeCta({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-cream px-3 py-2.5">
      <p className="text-xs font-bold text-ink-sub">{message}</p>
      <p className="mt-1 text-[11px] font-bold text-ink-faint">
        買い切りで無制限になります（準備中）
      </p>
    </div>
  );
}
