/** Сегодняшняя дата "YYYY-MM-DD" по локальному времени (не UTC — иначе ночью выйдет вчера). */
export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
