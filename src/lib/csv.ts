/** RFC 4180 に準拠し、カンマ・ダブルクォート・改行を含む場合のみクォートしてエスケープする */
export function escapeCsvField(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** 各行を CSV 1 行に変換し、`\r\n` で連結する(末尾に余分な区切りは付けない) */
export function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}
