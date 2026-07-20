import { buildCsv } from '../../lib/csv';
import { trackEvent } from '../../lib/analytics';
import type { PriceRecord, Product, Store, WithId } from '../../types/models';

const HEADER = ['記録日時', '商品名', '店舗名', '価格', '内容量', '単位', 'セール', 'メモ'];

const ILLEGAL_FILENAME_CHARS = /[/\\:*?"<>|]/g;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatRecordedAt(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** 価格記録を CSV 文字列(UTF-8 BOM 付き)に変換する。ID→名前解決に失敗した場合は空文字にする */
export function buildPriceRecordsCsv(
  records: WithId<PriceRecord>[],
  products: WithId<Product>[],
  stores: WithId<Store>[],
): string {
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const storeNames = new Map(stores.map((s) => [s.id, s.name]));
  const sortedRecords = [...records].sort(
    (a, b) => a.recordedAt.toMillis() - b.recordedAt.toMillis(),
  );
  const rows = [
    HEADER,
    ...sortedRecords.map((r) => [
      formatRecordedAt(r.recordedAt.toDate()),
      productNames.get(r.productId) ?? '',
      storeNames.get(r.storeId) ?? '',
      String(r.price),
      String(r.quantity),
      r.unit,
      r.isSale ? 'はい' : 'いいえ',
      r.note ?? '',
    ]),
  ];
  return '﻿' + buildCsv(rows);
}

/** ダウンロードファイル名を生成する。book 名に含まれるファイル名として不正な文字は `_` に置換する */
export function buildExportFilename(bookName: string, now: Date): string {
  const safeName = bookName.replace(ILLEGAL_FILENAME_CHARS, '_');
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  return `底値記録_${safeName}_${yyyy}${mm}${dd}.csv`;
}

/** CSV を生成しブラウザでダウンロードさせる(クライアント完結・サーバー送信なし) */
export function downloadPriceRecordsCsv(
  records: WithId<PriceRecord>[],
  products: WithId<Product>[],
  stores: WithId<Store>[],
  bookName: string,
  now: Date = new Date(),
): void {
  const csv = buildPriceRecordsCsv(records, products, stores);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildExportFilename(bookName, now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // click() 直後の revoke は一部ブラウザ(Safari 系)でダウンロードが始まる前に
  // Blob URL が失効し得るため、少し遅らせて解放する
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  void trackEvent('export_data');
}
