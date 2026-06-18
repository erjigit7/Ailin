/**
 * Каноничная раскладка зала №1 по ТЗ.
 *
 * Зал асимметричный: проход посередине делит каждый ряд на левый блок (места 1–4)
 * и правый блок. В рядах 1–5 правый блок — 5–8, в ряду 6 правый блок — 5–9.
 * Итого 49 мест.
 *
 * Раскладка хранится явно (а не вычисляется формулой), чтобы поддержать залы
 * с другой конфигурацией во второй очереди.
 */

export interface SeatLayout {
  /** Номер места в ряду (как видит гость): 1..N */
  number: number;
  /** К какому блоку относится место — для отрисовки прохода */
  block: 'left' | 'right';
}

export interface RowLayout {
  /** Номер ряда: 1..N */
  row: number;
  seats: SeatLayout[];
}

export interface HallLayout {
  name: string;
  totalSeats: number;
  rows: RowLayout[];
}

function makeRow(row: number, leftEnd: number, rightStart: number, rightEnd: number): RowLayout {
  const seats: SeatLayout[] = [];
  for (let n = 1; n <= leftEnd; n++) seats.push({ number: n, block: 'left' });
  for (let n = rightStart; n <= rightEnd; n++) seats.push({ number: n, block: 'right' });
  return { row, seats };
}

export const HALL_1_LAYOUT: HallLayout = {
  name: 'Зал 1',
  totalSeats: 49,
  rows: [
    makeRow(1, 4, 5, 8),
    makeRow(2, 4, 5, 8),
    makeRow(3, 4, 5, 8),
    makeRow(4, 4, 5, 8),
    makeRow(5, 4, 5, 8),
    makeRow(6, 4, 5, 9), // ряд 6 — 9 мест
  ],
};
