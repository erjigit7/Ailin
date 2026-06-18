import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSessions, getBookings, createBooking, releaseBooking, type SeatState } from '../../lib/api';
import { useSeatRealtime } from '../../lib/socket';
import HallScheme from '../../components/HallScheme';

export default function BookingTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions() });
  const [sessionId, setSessionId] = useState<string | undefined>();
  const activeSession = useMemo(
    () => sessions?.find((s) => s.id === sessionId) ?? sessions?.[0],
    [sessions, sessionId],
  );

  const seatsMap = useSeatRealtime(activeSession?.id);
  const seats = useMemo(() => Object.values(seatsMap), [seatsMap]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [minutes, setMinutes] = useState(30);

  // Активные брони сеанса (обновляем периодически для счётчика времени).
  const { data: bookings } = useQuery({
    queryKey: ['bookings', activeSession?.id],
    queryFn: () => getBookings(activeSession!.id),
    enabled: !!activeSession,
    refetchInterval: 15000,
  });

  function toggle(seat: SeatState) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(seat.seatId) ? next.delete(seat.seatId) : next.add(seat.seatId);
      return next;
    });
  }

  async function book() {
    if (!activeSession || selected.size === 0) return;
    try {
      await createBooking({
        sessionId: activeSession.id,
        seatIds: [...selected],
        customerName: name || undefined,
        customerPhone: phone || undefined,
        holdMinutes: minutes,
      });
      setSelected(new Set());
      setName('');
      setPhone('');
      qc.invalidateQueries({ queryKey: ['bookings', activeSession.id] });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Ошибка брони');
    }
  }

  async function release(id: string) {
    await releaseBooking(id);
    qc.invalidateQueries({ queryKey: ['bookings', activeSession?.id] });
  }

  return (
    <>
      <div className="px-6 py-3">
        <select
          className="w-full bg-gray-800 rounded px-4 py-3 text-sm"
          value={activeSession?.id ?? ''}
          onChange={(e) => {
            setSessionId(e.target.value);
            setSelected(new Set());
          }}
        >
          {sessions?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.movie.title} ·{' '}
              {new Date(s.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} · {s.hall.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-6 px-6 pb-6">
        {/* Схема: выбираем свободные места для брони */}
        <section className="flex-1 bg-gray-900 rounded-lg p-4">
          <div className="text-center text-sm text-gray-400 mb-4">
            Выберите места для брони · выбрано: {selected.size}
          </div>
          <HallScheme seats={seats} selected={selected} onSeatClick={toggle} />
        </section>

        {/* Панель брони */}
        <aside className="w-96 bg-gray-800 rounded-lg p-5 flex flex-col">
          <h2 className="text-lg font-semibold mb-3">{t('booking')}</h2>
          <label className="block text-xs text-gray-400 mb-2">
            Имя клиента
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm" />
          </label>
          <label className="block text-xs text-gray-400 mb-2">
            Телефон
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm" />
          </label>
          <label className="block text-xs text-gray-400 mb-3">
            Сброс через (мин)
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            />
          </label>
          <button
            onClick={book}
            disabled={selected.size === 0}
            className="py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 font-semibold"
          >
            Забронировать ({selected.size})
          </button>

          {/* Активные брони */}
          <div className="mt-5 border-t border-gray-700 pt-4 flex-1 overflow-auto">
            <div className="text-xs text-gray-400 mb-2">Активные брони</div>
            <div className="space-y-2">
              {bookings?.length === 0 && <div className="text-xs text-gray-500">Нет активных броней</div>}
              {bookings?.map((b) => (
                <div key={b.id} className="bg-gray-700/50 rounded px-3 py-2 text-sm flex justify-between items-center">
                  <div>
                    <div>
                      {t('row')} {b.seat.row} · {t('seat')} {b.seat.number}
                    </div>
                    <div className="text-xs text-gray-400">
                      {b.customerName || '—'} {b.customerPhone || ''} · {minutesLeft(b.expiresAt)}
                    </div>
                  </div>
                  <button onClick={() => release(b.id)} className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500">
                    Снять
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function minutesLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'истекает…';
  return `осталось ${Math.ceil(ms / 60000)} мин`;
}
