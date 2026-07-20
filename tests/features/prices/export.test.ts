import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { PriceRecord, Product, Store, WithId } from '../../../src/types/models';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../../../src/lib/analytics', () => ({ trackEvent }));

import {
  buildExportFilename,
  buildPriceRecordsCsv,
  downloadPriceRecordsCsv,
} from '../../../src/features/prices/export';

const products: WithId<Product>[] = [{ id: 'p1', name: 'シャンプー', categoryId: 'c1' }];
const stores: WithId<Store>[] = [{ id: 's1', name: 'スーパーA' }];

function record(overrides: Partial<PriceRecord> = {}): WithId<PriceRecord> {
  return {
    id: 'r1',
    productId: 'p1',
    storeId: 's1',
    price: 500,
    quantity: 300,
    unit: 'ml',
    isSale: false,
    recordedAt: Timestamp.fromDate(new Date(2026, 6, 20, 9, 5)),
    ...overrides,
  };
}

describe('buildPriceRecordsCsv', () => {
  it('0件の場合はヘッダーのみ(BOM付き)を返す', () => {
    const csv = buildPriceRecordsCsv([], products, stores);
    expect(csv).toBe('﻿記録日時,商品名,店舗名,価格,内容量,単位,セール,メモ');
  });

  it('各列を仕様通りに導出する', () => {
    const csv = buildPriceRecordsCsv([record()], products, stores);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[1]).toBe('2026-07-20 09:05,シャンプー,スーパーA,500,300,ml,いいえ,');
  });

  it('isSale が true の場合は「はい」になる', () => {
    const csv = buildPriceRecordsCsv([record({ isSale: true })], products, stores);
    expect(csv.split('\r\n')[1]).toContain(',はい,');
  });

  it('note が設定されている場合はそのまま出力される', () => {
    const csv = buildPriceRecordsCsv([record({ note: '特売品' })], products, stores);
    expect(csv.split('\r\n')[1].endsWith(',特売品')).toBe(true);
  });

  it('note が未設定の場合は空文字になる', () => {
    const csv = buildPriceRecordsCsv([record()], products, stores);
    expect(csv.split('\r\n')[1].endsWith(',')).toBe(true);
  });

  it('productId/storeId が解決できない場合は空文字になる', () => {
    const csv = buildPriceRecordsCsv(
      [record({ productId: 'unknown', storeId: 'unknown' })],
      products,
      stores,
    );
    expect(csv.split('\r\n')[1]).toBe('2026-07-20 09:05,,,500,300,ml,いいえ,');
  });

  it('カンマ・ダブルクォート・改行を含む値が正しくエスケープされる', () => {
    const csv = buildPriceRecordsCsv(
      [record({ note: '安い,けど"味"は普通\r\nリピートなし' })],
      products,
      stores,
    );
    const dataLine = csv.replace('﻿', '').split('\r\n').slice(1).join('\r\n');
    expect(dataLine).toBe(
      '2026-07-20 09:05,シャンプー,スーパーA,500,300,ml,いいえ,"安い,けど""味""は普通\r\nリピートなし"',
    );
  });

  it('recordedAt の昇順にソートされる(入力順に依存しない)', () => {
    const older = record({ recordedAt: Timestamp.fromDate(new Date(2026, 0, 1)) });
    const newer = record({ recordedAt: Timestamp.fromDate(new Date(2026, 6, 20)) });
    const csv = buildPriceRecordsCsv([newer, older], products, stores);
    const dataLines = csv.replace('﻿', '').split('\r\n').slice(1);
    expect(dataLines[0].startsWith('2026-01-01')).toBe(true);
    expect(dataLines[1].startsWith('2026-07-20')).toBe(true);
  });

  it('出力の先頭がBOMである', () => {
    const csv = buildPriceRecordsCsv([], products, stores);
    expect(csv.startsWith('﻿')).toBe(true);
  });
});

describe('buildExportFilename', () => {
  it('通常の book 名で正しいファイル名を生成する', () => {
    expect(buildExportFilename('わたしの底値帳', new Date(2026, 6, 20))).toBe(
      '底値記録_わたしの底値帳_20260720.csv',
    );
  });

  it('不正な文字を含む book 名を置換する', () => {
    expect(buildExportFilename('a/b\\c:d*e?f"g<h>i|j', new Date(2026, 6, 20))).toBe(
      '底値記録_a_b_c_d_e_f_g_h_i_j_20260720.csv',
    );
  });

  it('月・日をゼロ埋めする', () => {
    expect(buildExportFilename('book', new Date(2026, 0, 5))).toBe('底値記録_book_20260105.csv');
  });
});

describe('downloadPriceRecordsCsv', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it('Blob生成・ダウンロード・後始末・イベント送信を行う', () => {
    vi.useFakeTimers();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    downloadPriceRecordsCsv([record()], products, stores, 'わたしの底値帳', new Date(2026, 6, 20));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv;charset=utf-8');

    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('底値記録_わたしの底値帳_20260720.csv');
    expect(anchor.href).toBe('blob:mock-url');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    // revoke はダウンロード開始猶予のため即時ではなく遅延実行される
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(trackEvent).toHaveBeenCalledWith('export_data');

    appendChildSpy.mockRestore();
    vi.useRealTimers();
  });
});
