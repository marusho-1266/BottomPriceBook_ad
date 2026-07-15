import { describe, expect, it } from 'vitest';
import {
  allowedUnits,
  calcUnitPrice,
  formatPricePerBase,
  relabelRecordToBaseUnit,
  toBaseQuantity,
} from '../../src/lib/units';

describe('allowedUnits', () => {
  it('g カテゴリは g と kg を許容する', () => {
    expect(allowedUnits('g')).toEqual(['g', 'kg']);
  });

  it('ml カテゴリは ml と L を許容する', () => {
    expect(allowedUnits('ml')).toEqual(['ml', 'L']);
  });

  it('個・枚・組・回分は換算なしでその単位のみ', () => {
    expect(allowedUnits('個')).toEqual(['個']);
    expect(allowedUnits('枚')).toEqual(['枚']);
    expect(allowedUnits('組')).toEqual(['組']);
    expect(allowedUnits('回分')).toEqual(['回分']);
  });
});

describe('toBaseQuantity', () => {
  it('kg を g に換算する(5kg → 5000g)', () => {
    expect(toBaseQuantity(5, 'kg', 'g')).toBe(5000);
  });

  it('L を ml に換算する(1.2L → 1200ml)', () => {
    expect(toBaseQuantity(1.2, 'L', 'ml')).toBe(1200);
  });

  it('基準単位そのままなら変換しない', () => {
    expect(toBaseQuantity(240, 'ml', 'ml')).toBe(240);
    expect(toBaseQuantity(800, '組', '組')).toBe(800);
  });

  it('許容外の単位ペアは null(g カテゴリに ml など)', () => {
    expect(toBaseQuantity(100, 'ml', 'g')).toBeNull();
    expect(toBaseQuantity(100, 'kg', 'ml')).toBeNull();
    expect(toBaseQuantity(100, 'L', '個')).toBeNull();
  });
});

describe('calcUnitPrice(基準単位あたりの円)', () => {
  it('米 5kg 1,980 円 → 0.396 円/g', () => {
    expect(calcUnitPrice(1980, 5, 'kg', 'g')).toBeCloseTo(0.396, 5);
  });

  it('洗剤 240ml 158 円 → 約 0.658 円/ml', () => {
    expect(calcUnitPrice(158, 240, 'ml', 'ml')).toBeCloseTo(158 / 240, 5);
  });

  it('quantity が 0 以下なら null', () => {
    expect(calcUnitPrice(100, 0, 'g', 'g')).toBeNull();
    expect(calcUnitPrice(100, -5, 'g', 'g')).toBeNull();
  });

  it('許容外の単位ペアなら null', () => {
    expect(calcUnitPrice(100, 100, 'ml', 'g')).toBeNull();
  });
});

describe('formatPricePerBase', () => {
  it('1 円以上は小数 1 桁で表示する', () => {
    expect(formatPricePerBase(12.34, '個')).toBe('12.3円/個');
  });

  it('1 円未満は小数 2 桁で表示する', () => {
    expect(formatPricePerBase(0.396, 'g')).toBe('0.40円/g');
  });

  it('null は「—」を返す', () => {
    expect(formatPricePerBase(null, 'g')).toBe('—');
  });
});

describe('relabelRecordToBaseUnit', () => {
  it('2kg(from g) → to ml は正規化後リラベル(2000 ml)', () => {
    expect(relabelRecordToBaseUnit({ quantity: 2, unit: 'kg' }, 'g', 'ml')).toEqual({
      quantity: 2000,
      unit: 'ml',
    });
  });

  it('1.5L(from ml) → to 個 は正規化後リラベル(1500 個)', () => {
    expect(relabelRecordToBaseUnit({ quantity: 1.5, unit: 'L' }, 'ml', '個')).toEqual({
      quantity: 1500,
      unit: '個',
    });
  });

  it('3個(from 個) → to 枚 は数量そのままリラベル', () => {
    expect(relabelRecordToBaseUnit({ quantity: 3, unit: '個' }, '個', '枚')).toEqual({
      quantity: 3,
      unit: '枚',
    });
  });

  it('現行 baseUnit と不整合な unit は quantity そのまま・unit のみ付け替え', () => {
    expect(relabelRecordToBaseUnit({ quantity: 100, unit: '個' }, 'g', 'ml')).toEqual({
      quantity: 100,
      unit: 'ml',
    });
  });
});
