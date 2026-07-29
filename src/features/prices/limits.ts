/**
 * 価格記録の値域。firestore.rules の priceRecords 検証(isValidRecord)と同じ値で、
 * クライアント側でも同じ境界で弾いてルール違反による permission-denied を防ぐ。
 * ルールを変えるときは必ず両方を揃えること
 */
export const MAX_PRICE = 10_000_000;
export const MAX_QUANTITY = 1_000_000;

/** 未指定(パッチで触らない)は許容し、指定されていれば 0 < value <= max を要求する */
export function outOfRange(value: number | undefined, max: number): boolean {
  return value !== undefined && !(value > 0 && value <= max);
}
