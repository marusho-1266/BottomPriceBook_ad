import { useId, useMemo, useState, type FormEvent } from 'react';
import { fromLocalDateISO, toLocalDateISO } from '../../lib/date';
import { allowedUnits } from '../../lib/units';
import type { BaseUnit, PriceRecord, Store, WithId } from '../../types/models';
import { MAX_PRICE, MAX_QUANTITY } from './limits';

export type PriceRecordEditPatch = {
  price: number;
  quantity: number;
  unit: string;
  isSale: boolean;
  storeId: string;
  recordedAt: Date;
};

/** 価格記録のインライン編集。価格・内容量・単位・特売・日付・店舗 */
export function PriceRecordEditForm({
  record,
  stores,
  baseUnit,
  onSave,
  onCancel,
}: {
  record: WithId<PriceRecord>;
  stores: WithId<Store>[];
  baseUnit: BaseUnit;
  onSave: (patch: PriceRecordEditPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const units = useMemo(() => allowedUnits(baseUnit), [baseUnit]);
  // カテゴリの baseUnit 変更後などで record.unit が候補外になった記録は先頭単位に寄せる
  const initialUnit = units.includes(record.unit) ? record.unit : (units[0] ?? '');

  const [priceText, setPriceText] = useState(String(record.price));
  const [quantityText, setQuantityText] = useState(String(record.quantity));
  const [unit, setUnit] = useState(initialUnit);
  const [isSale, setIsSale] = useState(record.isSale);
  const [date, setDate] = useState(toLocalDateISO(record.recordedAt.toDate()));
  const [storeId, setStoreId] = useState(record.storeId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fieldId = useId();
  const priceId = `${fieldId}-price`;
  const quantityId = `${fieldId}-quantity`;
  const unitId = `${fieldId}-unit`;
  const saleId = `${fieldId}-sale`;
  const dateId = `${fieldId}-date`;
  const storeIdField = `${fieldId}-store`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const price = Number(priceText);
    if (!Number.isFinite(price) || price <= 0) {
      setError('価格を正しく入力してください');
      return;
    }
    if (price > MAX_PRICE) {
      setError(`価格は${MAX_PRICE.toLocaleString()}円以下で入力してください`);
      return;
    }
    const quantity = Number(quantityText);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('内容量を正しく入力してください');
      return;
    }
    if (quantity > MAX_QUANTITY) {
      setError(`内容量は${MAX_QUANTITY.toLocaleString()}以下で入力してください`);
      return;
    }
    if (!storeId) {
      setError('店舗を選択してください');
      return;
    }
    // 現行の BaseUnit はいずれも候補を 1 つ以上持つため通常は到達しない防御。
    // 単位なしの記録は単価計算が破綻するため念のため止める
    if (!unit) {
      setError('単位を選択してください');
      return;
    }
    if (!date) {
      setError('日付を入力してください');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        price,
        quantity,
        unit,
        isSale,
        storeId,
        recordedAt: fromLocalDateISO(date),
      });
    } catch {
      setError('保存に失敗しました。もう一度お試しください');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 py-1">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={priceId} className="mb-0.5 block text-[10px] font-bold text-ink-faint">
            価格(税込)
          </label>
          <input
            id={priceId}
            type="number"
            inputMode="numeric"
            // 値の妥当性は handleSubmit に一本化する。min/max を付けるとネイティブの
            // 制約検証が submit を止めてしまい、自前の日本語エラーを出せなくなる
            step="any"
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value);
              setError(null);
            }}
            className="h-9 w-full rounded-lg border border-line bg-cream px-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={quantityId} className="mb-0.5 block text-[10px] font-bold text-ink-faint">
            内容量
          </label>
          <input
            id={quantityId}
            type="number"
            inputMode="decimal"
            // 記録画面と同じく内容量は小数可(例: 1.5L)。既定の step=1 のままだと
            // ブラウザの制約検証(stepMismatch)で submit 自体が止まる
            step="any"
            value={quantityText}
            onChange={(e) => {
              setQuantityText(e.target.value);
              setError(null);
            }}
            className="h-9 w-full rounded-lg border border-line bg-cream px-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={unitId} className="mb-0.5 block text-[10px] font-bold text-ink-faint">
            単位
          </label>
          <select
            id={unitId}
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setError(null);
            }}
            disabled={units.length === 0}
            className="h-9 w-full rounded-lg border border-line bg-cream px-2 text-sm"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label
            htmlFor={saleId}
            className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border ${
              isSale ? 'border-sale bg-sale-bg' : 'border-line bg-cream'
            }`}
          >
            <input
              id={saleId}
              type="checkbox"
              checked={isSale}
              onChange={(e) => setIsSale(e.target.checked)}
              className="size-3.5"
            />
            <span className={`text-xs font-extrabold ${isSale ? 'text-sale' : 'text-ink-faint'}`}>
              特売
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={dateId} className="mb-0.5 block text-[10px] font-bold text-ink-faint">
            日付
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
            className="h-9 w-full rounded-lg border border-line bg-cream px-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={storeIdField} className="mb-0.5 block text-[10px] font-bold text-ink-faint">
            店舗
          </label>
          <select
            id={storeIdField}
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setError(null);
            }}
            className="h-9 w-full rounded-lg border border-line bg-cream px-2 text-sm"
          >
            <option value="">選択してください</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-bold text-sale">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="text-xs font-bold text-ink-sub">
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          className="text-xs font-bold text-primary disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </form>
  );
}
