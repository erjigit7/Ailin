import { useTranslation } from 'react-i18next';
import type { SeatState } from '../lib/api';

export type SeatRenderStatus = SeatState['status'] | 'SELECTED';

interface Props {
  seats: SeatState[];
  /** id выбранных мест (клиентское состояние кассы) */
  selected?: Set<string>;
  onSeatClick?: (seat: SeatState) => void;
  readOnly?: boolean;
  /** разрешить выбор забронированных мест (конвертация брони в продажу) */
  allowBooked?: boolean;
  /** размер места в px */
  size?: number;
}

const COLORS: Record<SeatRenderStatus, string> = {
  FREE: 'bg-seat-free text-white',
  SOLD: 'bg-seat-sold text-gray-300',
  BOOKED: 'bg-seat-booked text-black',
  SELECTED: 'bg-seat-selected text-white ring-2 ring-white',
};

export default function HallScheme({ seats, selected, onSeatClick, readOnly, allowBooked, size = 44 }: Props) {
  const { t } = useTranslation();

  // Группируем по рядам
  const rows = new Map<number, SeatState[]>();
  for (const s of seats) {
    if (!rows.has(s.row)) rows.set(s.row, []);
    rows.get(s.row)!.push(s);
  }
  const sortedRows = [...rows.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Экран */}
      <div className="w-2/3 text-center">
        <div className="h-1 rounded bg-gray-600 mb-1" />
        <span className="text-xs tracking-[0.4em] text-gray-400">{t('screen')}</span>
      </div>

      <div className="flex flex-col gap-2">
        {sortedRows.map(([rowNum, rowSeats]) => {
          const left = rowSeats.filter((s) => s.block === 'left').sort((a, b) => a.number - b.number);
          const right = rowSeats.filter((s) => s.block === 'right').sort((a, b) => a.number - b.number);
          return (
            <div key={rowNum} className="flex items-center gap-3">
              <span className="w-14 text-right text-sm text-gray-400 shrink-0">
                {t('row')} {rowNum}
              </span>
              <div className="flex gap-2">
                {left.map((s) => (
                  <Seat key={s.seatId} seat={s} selected={selected?.has(s.seatId)} onClick={onSeatClick} readOnly={readOnly} allowBooked={allowBooked} size={size} />
                ))}
              </div>
              {/* Проход посередине */}
              <div style={{ width: size * 0.9 }} />
              <div className="flex gap-2">
                {right.map((s) => (
                  <Seat key={s.seatId} seat={s} selected={selected?.has(s.seatId)} onClick={onSeatClick} readOnly={readOnly} allowBooked={allowBooked} size={size} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Seat({
  seat,
  selected,
  onClick,
  readOnly,
  allowBooked,
  size,
}: {
  seat: SeatState;
  selected?: boolean;
  onClick?: (s: SeatState) => void;
  readOnly?: boolean;
  allowBooked?: boolean;
  size: number;
}) {
  const status: SeatRenderStatus = selected ? 'SELECTED' : seat.status;
  const clickable =
    !readOnly && (seat.status === 'FREE' || selected || (!!allowBooked && seat.status === 'BOOKED'));
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onClick?.(seat)}
      title={`${seat.row} ряд · ${seat.number} место`}
      style={{ width: size, height: size }}
      className={`rounded-md text-sm font-medium flex items-center justify-center transition
        ${COLORS[status]} ${clickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
    >
      {seat.number}
    </button>
  );
}

export function Legend() {
  const { t } = useTranslation();
  const items: [string, string][] = [
    ['bg-seat-free', t('free')],
    ['bg-seat-sold', t('sold')],
    ['bg-seat-selected', t('selected')],
  ];
  return (
    <div className="flex gap-6 justify-center text-sm text-gray-300">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded ${color}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
