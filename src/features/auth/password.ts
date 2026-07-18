const HAS_LETTER = /[a-zA-Z]/;
const HAS_DIGIT = /[0-9]/;
const MIN_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_LENGTH || !HAS_LETTER.test(password) || !HAS_DIGIT.test(password)) {
    return '8 文字以上・英字と数字を含めてください';
  }
  return null;
}
