import { describe, expect, it } from 'vitest';
import { validatePasswordStrength } from '../../../src/features/auth/password';

describe('validatePasswordStrength', () => {
  it('8文字以上・英字・数字を含む場合は null(問題なし)', () => {
    expect(validatePasswordStrength('abcd1234')).toBeNull();
  });

  it('7文字では拒否される', () => {
    expect(validatePasswordStrength('abcd123')).not.toBeNull();
  });

  it('8文字ちょうどでも英字と数字を含めば通る', () => {
    expect(validatePasswordStrength('a1234567')).toBeNull();
  });

  it('英字のみ(数字なし)は拒否される', () => {
    expect(validatePasswordStrength('abcdefgh')).not.toBeNull();
  });

  it('数字のみ(英字なし)は拒否される', () => {
    expect(validatePasswordStrength('12345678')).not.toBeNull();
  });

  it('記号のみは拒否される', () => {
    expect(validatePasswordStrength('!!!!!!!!')).not.toBeNull();
  });

  it('全角文字混じりは英数字カウントに含まれず拒否される', () => {
    expect(validatePasswordStrength('ａｂｃ1234')).not.toBeNull();
  });

  it('長い文字列でも英字・数字を含めば通る', () => {
    expect(validatePasswordStrength('abcdefgh12345678')).toBeNull();
  });

  it('空文字は拒否される', () => {
    expect(validatePasswordStrength('')).not.toBeNull();
  });
});
