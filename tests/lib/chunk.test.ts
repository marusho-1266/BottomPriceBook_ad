import { describe, expect, it } from 'vitest';
import { chunk } from '../../src/lib/chunk';

describe('chunk', () => {
  it('配列を指定サイズごとに分割する', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('サイズ以下の配列は 1 チャンクになる', () => {
    expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
  });

  it('空配列は空を返す', () => {
    expect(chunk([], 500)).toEqual([]);
  });

  it('501 要素は 2 チャンクに分かれる(バッチ上限対応)', () => {
    const items = Array.from({ length: 501 }, (_, i) => i);
    const chunks = chunk(items, 500);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(1);
  });

  it('サイズ 0 以下はエラー', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
