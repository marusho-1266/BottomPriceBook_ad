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

/** 招待コード。ドキュメント ID(自動 ID)自体が秘密トークン */
export interface Invite {
  bookId: string;
  /** 参加確認画面での表示用スナップショット */
  bookName: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

/** メンバープロフィール。メンバーシップの真実のソースは Book.memberUids */
export interface Member {
  displayName: string;
  /** 参加に使用したコード(ルール検証用)。オーナー補完時は無し */
  inviteCode?: string;
  joinedAt: Timestamp;
}

export type WithId<T> = T & { id: string };
