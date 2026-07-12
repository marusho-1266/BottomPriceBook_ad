import type { BaseUnit } from '../types/models';

/** baseUnit ごとの許容単位と基準単位への換算係数(M-1) */
const UNIT_TABLE: Record<BaseUnit, Record<string, number>> = {
  g: { g: 1, kg: 1000 },
  ml: { ml: 1, L: 1000 },
  個: { 個: 1 },
  枚: { 枚: 1 },
  組: { 組: 1 },
  回分: { 回分: 1 },
};

export function allowedUnits(baseUnit: BaseUnit): string[] {
  return Object.keys(UNIT_TABLE[baseUnit]);
}

/** 入力量を基準単位の量に換算する。許容外の単位ペアは null */
export function toBaseQuantity(quantity: number, unit: string, baseUnit: BaseUnit): number | null {
  const factor = UNIT_TABLE[baseUnit][unit];
  if (factor === undefined) return null;
  return quantity * factor;
}

/** 基準単位あたりの価格(円)。quantity <= 0 や許容外単位は null */
export function calcUnitPrice(
  price: number,
  quantity: number,
  unit: string,
  baseUnit: BaseUnit,
): number | null {
  if (quantity <= 0) return null;
  const baseQuantity = toBaseQuantity(quantity, unit, baseUnit);
  if (baseQuantity === null || baseQuantity <= 0) return null;
  return price / baseQuantity;
}

/** 単価の表示用フォーマット。例: '0.40円/g' '12.3円/個'。null は '—' */
export function formatPricePerBase(unitPrice: number | null, baseUnit: BaseUnit): string {
  if (unitPrice === null) return '—';
  const digits = unitPrice < 1 ? 2 : 1;
  return `${unitPrice.toFixed(digits)}円/${baseUnit}`;
}
