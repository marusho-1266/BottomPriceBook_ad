/** ローカル日付を YYYY-MM-DD にする(input type="date" 用) */
export function toLocalDateISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * YYYY-MM-DD を正午ローカル時刻の Date にする。
 * 正午に寄せるのは、タイムゾーン差で前日/翌日にずれるのを避けるため
 */
export function fromLocalDateISO(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}
