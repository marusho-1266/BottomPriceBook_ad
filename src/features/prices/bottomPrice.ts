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

export interface RankedProduct<P extends { id: string }, R extends PriceRecordInput> {
  product: P;
  best: BottomResult<R>;
}

export type DraftRankResult =
  | { kind: 'ranked'; rank: number; total: number }
  | { kind: 'noCandidates' };

/**
 * 入力中のドラフト価格が、カテゴリ内の商品横断単価比較で何位相当かを返す。
 * 対象商品はドラフト単価、他商品は既存の底値で比較する。
 * 底値の単価が算出不能な商品は比較対象・母数から除外する。
 * ドラフト値が無効(price / quantity が 0 以下、単位不整合)の間は null。
 */
export function rankDraftInCategory<P extends { id: string }, R extends PriceRecordInput>(
  products: P[],
  records: R[],
  targetProductId: string,
  draft: { price: number; quantity: number; unit: string },
  baseUnit: BaseUnit,
  options: BottomPriceOptions,
): DraftRankResult | null {
  if (draft.price <= 0) return null;
  const draftUnitPrice = calcUnitPrice(draft.price, draft.quantity, draft.unit, baseUnit);
  if (draftUnitPrice === null) return null;

  const candidateUnitPrices: number[] = [];
  for (const product of products) {
    if (product.id === targetProductId) continue;
    const best = bottomPrice(
      records.filter((r) => r.productId === product.id),
      baseUnit,
      options,
    );
    if (best === null || best.unitPrice === null) continue;
    candidateUnitPrices.push(best.unitPrice);
  }
  if (candidateUnitPrices.length === 0) return { kind: 'noCandidates' };

  // 同額は同順位(上に寄せる): 厳密に安い比較対象の数 + 1
  const cheaperCount = candidateUnitPrices.filter((p) => p < draftUnitPrice).length;
  return { kind: 'ranked', rank: cheaperCount + 1, total: candidateUnitPrices.length + 1 };
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
