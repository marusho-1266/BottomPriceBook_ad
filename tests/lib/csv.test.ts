import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvField } from '../../src/lib/csv';

describe('escapeCsvField', () => {
  it('特殊文字を含まない場合はそのまま返す', () => {
    expect(escapeCsvField('シャンプー')).toBe('シャンプー');
  });

  it('空文字列はそのまま返す', () => {
    expect(escapeCsvField('')).toBe('');
  });

  it('カンマを含む場合はクォートする', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('ダブルクォートを含む場合はクォートし二重化する', () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });

  it('改行(\\n)を含む場合はクォートする', () => {
    expect(escapeCsvField('a\nb')).toBe('"a\nb"');
  });

  it('CRLF(\\r\\n)を含む場合はクォートする', () => {
    expect(escapeCsvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('単独の\\rを含む場合もクォートする', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });
});

describe('buildCsv', () => {
  it('単一行を出力する', () => {
    expect(buildCsv([['a', 'b', 'c']])).toBe('a,b,c');
  });

  it('複数行を\\r\\nで連結し末尾に余分な区切りを付けない', () => {
    expect(
      buildCsv([
        ['h1', 'h2'],
        ['v1', 'v2'],
      ]),
    ).toBe('h1,h2\r\nv1,v2');
  });

  it('各フィールドが個別にエスケープされる', () => {
    expect(buildCsv([['a,b', 'c"d', 'e']])).toBe('"a,b","c""d",e');
  });

  it('空配列は空文字列を返す', () => {
    expect(buildCsv([])).toBe('');
  });
});
