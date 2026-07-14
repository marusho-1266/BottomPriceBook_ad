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

export type DraftRankResult = { kind: 'ranked'; rank: number; total: number };

/**
 * 入力中のドラフト価格が、カテゴリ内の価格記録と比べ何位相当かを返す。
 * 同一商品×同一店舗の既存記録は上書き扱いとして母数から除外する。
 * 単価換算不能な記録は比較対象・母数から除外する。
 * ドラフト値が無効(price / quantity が 0 以下、単位不整合)の間は null。
 */
export function rankDraftInCategory<P extends { id: string }, R extends PriceRecordInput>(
  productsInCategory: P[],
  records: R[],
  targetProductId: string,
  targetStoreId: string,
  draft: { price: number; quantity: number; unit: string },
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): DraftRankResult | null {
  if (draft.price <= 0) return null;
  const draftUnitPrice = calcUnitPrice(draft.price, draft.quantity, draft.unit, baseUnit);
  if (draftUnitPrice === null) return null;

  const productIds = new Set(productsInCategory.map((p) => p.id));
  const candidateUnitPrices: number[] = [];
  for (const record of filterRecords(records, options)) {
    if (!productIds.has(record.productId)) continue;
    if (record.productId === targetProductId && record.storeId === targetStoreId) continue;
    const unitPrice = calcUnitPrice(record.price, record.quantity, record.unit, baseUnit);
    if (unitPrice === null) continue;
    candidateUnitPrices.push(unitPrice);
  }

  // 同額は同順位(上に寄せる): 厳密に安い比較対象の数 + 1
  const cheaperCount = candidateUnitPrices.filter((p) => p < draftUnitPrice).length;
  return {
    kind: 'ranked',
    rank: cheaperCount + 1,
    total: candidateUnitPrices.length + 1,
  };
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
