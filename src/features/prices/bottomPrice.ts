import { calcUnitPrice } from '../../lib/units';
import type { BaseUnit } from '../../types/models';

/** Firestore の Timestamp と Date の両方を受け付ける */
type DateLike = Date | { toDate(): Date };

export interface PriceRecordInput {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  quantity: number;
  unit: string;
  isSale: boolean;
  recordedAt: DateLike;
}

export interface BottomPriceOptions {
  /** 底値の対象期間(ヶ月)。0 = 全期間 */
  windowMonths: number;
  now: Date;
  /** true なら特売記録を除外した「通常のみの底値」を求める */
  excludeSale?: boolean;
}

export interface BottomResult<R extends PriceRecordInput = PriceRecordInput> {
  record: R;
  /** 基準単位あたりの円。単位不整合時は null */
  unitPrice: number | null;
}

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : value.toDate();
}

function windowStart(now: Date, months: number): Date | null {
  if (months <= 0) return null;
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  return start;
}

function filterRecords<R extends PriceRecordInput>(records: R[], options: BottomPriceOptions): R[] {
  const start = windowStart(options.now, options.windowMonths);
  return records.filter((record) => {
    if (options.excludeSale && record.isSale) return false;
    if (start && toDate(record.recordedAt) < start) return false;
    return true;
  });
}

function pickBottom<R extends PriceRecordInput>(
  records: R[],
  baseUnit: BaseUnit,
): BottomResult<R> | null {
  let best: BottomResult<R> | null = null;
  for (const record of records) {
    const unitPrice = calcUnitPrice(record.price, record.quantity, record.unit, baseUnit);
    if (unitPrice === null) continue;
    if (best === null || best.unitPrice === null || unitPrice < best.unitPrice) {
      best = { record, unitPrice };
    }
  }
  // 全記録の単位が不整合だった場合は総額最安にフォールバック(孤児データ対策)
  if (best === null && records.length > 0) {
    const cheapest = records.reduce((a, b) => (b.price < a.price ? b : a));
    best = { record: cheapest, unitPrice: null };
  }
  return best;
}

/** 1 商品の記録から底値(基準単位あたり単価が最安の記録)を求める */
export function bottomPrice<R extends PriceRecordInput>(
  records: R[],
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): BottomResult<R> | null {
  return pickBottom(filterRecords(records, options), baseUnit);
}

/** 1 商品の記録から店舗ごとの底値を求める */
export function bottomPricesByStore<R extends PriceRecordInput>(
  records: R[],
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): Map<string, BottomResult<R>> {
  const filtered = filterRecords(records, options);
  const byStore = new Map<string, R[]>();
  for (const record of filtered) {
    const list = byStore.get(record.storeId) ?? [];
    list.push(record);
    byStore.set(record.storeId, list);
  }
  const result = new Map<string, BottomResult<R>>();
  for (const [storeId, storeRecords] of byStore) {
    const best = pickBottom(storeRecords, baseUnit);
    if (best) result.set(storeId, best);
  }
  return result;
}

export interface RankedRecord<P extends { id: string }, R extends PriceRecordInput> {
  product: P;
  record: R;
  /** 基準単位あたりの円。単位不整合時は null */
  unitPrice: number | null;
}

/**
 * カテゴリ内の全価格記録を、対象期間でフィルタしたうえで
 * 基準単位あたり単価の昇順に並べて返す(商品への集約は行わない)。
 * 単価が null の行は末尾。同一単価は記録日の新しい順。
 */
export function rankAllRecordsByUnitPrice<P extends { id: string }, R extends PriceRecordInput>(
  productsInCategory: P[],
  records: R[],
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): RankedRecord<P, R>[] {
  const productById = new Map(productsInCategory.map((p) => [p.id, p]));
  const ranked: RankedRecord<P, R>[] = [];
  for (const record of filterRecords(records, options)) {
    const product = productById.get(record.productId);
    if (!product) continue;
    const unitPrice = calcUnitPrice(record.price, record.quantity, record.unit, baseUnit);
    ranked.push({ product, record, unitPrice });
  }
  const recordedTime = (row: RankedRecord<P, R>) => toDate(row.record.recordedAt).getTime();
  ranked.sort((a, b) => {
    if (a.unitPrice === null && b.unitPrice === null) return recordedTime(b) - recordedTime(a);
    if (a.unitPrice === null) return 1;
    if (b.unitPrice === null) return -1;
    if (a.unitPrice !== b.unitPrice) return a.unitPrice - b.unitPrice;
    return recordedTime(b) - recordedTime(a);
  });
  return ranked;
}

export interface RankedProduct<P extends { id: string }, R extends PriceRecordInput> {
  product: P;
  best: BottomResult<R>;
}

/** カテゴリ内の商品を基準単位あたり単価の安い順に並べる(記録のない商品は除外) */
export function rankByUnitPrice<P extends { id: string }, R extends PriceRecordInput>(
  products: P[],
  records: R[],
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): RankedProduct<P, R>[] {
  const ranked: RankedProduct<P, R>[] = [];
  for (const product of products) {
    const best = bottomPrice(
      records.filter((r) => r.productId === product.id),
      baseUnit,
      options,
    );
    if (best) ranked.push({ product, best });
  }
  ranked.sort((a, b) => {
    if (a.best.unitPrice === null) return 1;
    if (b.best.unitPrice === null) return -1;
    return a.best.unitPrice - b.best.unitPrice;
  });
  return ranked;
}
