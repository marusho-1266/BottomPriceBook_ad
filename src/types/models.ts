import type { Timestamp } from 'firebase/firestore';

/** カテゴリの基準単位。単価は常にこの単位あたりで比較する */
export type BaseUnit = 'g' | 'ml' | '個' | '枚' | '組' | '回分';

export interface Book {
  name: string;
  ownerUid: string;
  memberUids: string[];
  /** 底値の対象期間(ヶ月)。0 = 全期間 */
  bottomWindowMonths: number;
  createdAt: Timestamp;
}

export interface Category {
  name: string;
  baseUnit: BaseUnit;
  sortOrder: number;
}

export interface Store {
  name: string;
}

export interface Product {
  name: string;
  categoryId: string;
  note?: string;
}

export interface PriceRecord {
  productId: string;
  storeId: string;
  /** 税込・円 */
  price: number;
  /** 内容量(総量)。例: 240 */
  quantity: number;
  /** baseUnit またはその上位単位(kg / L) */
  unit: string;
  isSale: boolean;
  recordedAt: Timestamp;
  note?: string;
}

export type WithId<T> = T & { id: string };
