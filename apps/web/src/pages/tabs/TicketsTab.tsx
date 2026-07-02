import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSessions, sellTickets, type SeatState, type SessionListItem } from '../../lib/api';
import { useSeatRealtime, setDisplaySession, holdSeat } from '../../lib/socket';
import { printTicketReceipts } from '../../lib/receipt';
import HallScheme, { Legend } from '../../components/HallScheme';

interface SelectedSeat {
  seat: SeatState;
  categoryId: string;
  /** место было свободным и мы его «удержали» (для брони — false, удержание не шлём) */
  held: boolean;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TicketsTab({
  disabled,
  sessionId,
  onSessionChange,
}: {
  disabled?: boolean;
  sessionId?: string;
  onSessionChange: (id: string) => void;
}) {
  const { t } = useTranslation();

  // По умолчанию показываем сеансы только на сегодня; фильтр даты — для поиска по дням.
  const [date, setDate] = useState(todayStr());
  const { data: sessions } = useQuery({ queryKey: ['sessions', date], queryFn: () => getSessions(date) });
  const activeSession: SessionListItem | undefined = useMemo(
    () => sessions?.find((s) => s.id === sessionId) ?? sessions?.[0],
    [sessions, sessionId],
  );

  // Если сеанс выбранного дня не входит в новый список (сменили дату) — переключаемся
  // на первый сеанс этого дня, чтобы не остаться на «чужом» sessionId.
  useEffect(() => {
    if (sessions && sessions.length > 0 && !sessions.find((s) => s.id === sessionId)) {
      onSessionChange(sessions[0].id);
    }
  }, [sessions]); // eslint-disable-line

  const seatsMap = useSeatRealtime(activeSession?.id);
  const seats = useMemo(() => Object.values(seatsMap), [seatsMap]);

  // Дисплей гостей следует за активным сеансом кассы.
  useEffect(() => {
    if (activeSession?.id) setDisplaySession(activeSession.id);
  }, [activeSession?.id]);

  const categories = activeSession?.prices ?? [];
  const [nextCategoryId, setNextCategoryId] = useState<string | undefined>();
  const currentCategoryId = nextCategoryId ?? categories[0]?.categoryId;

  const [selected, setSelected] = useState<SelectedSeat[]>([]);
  const [payment, setPayment] = useState<'CASH' | 'CARD' | 'QR'>('CASH');
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.seat.seatId)), [selected]);

  const priceOf = (categoryId: string) =>
    Number(categories.find((c) => c.categoryId === categoryId)?.price ?? activeSession?.basePrice ?? 0);
  const total = selected.reduce((sum, s) => sum + priceOf(s.categoryId), 0);

  const counts = useMemo(() => {
    const free = seats.filter((s) => s.status === 'FREE').length;
    const sold = seats.filter((s) => s.status === 'SOLD').length;
    return { free, sold };
  }, [seats]);

  function toggleSeat(seat: SeatState) {
    if (!activeSession) return;
    const exists = selected.find((s) => s.seat.seatId === seat.seatId);
    if (exists) {
      setSelected((prev) => prev.filter((s) => s.seat.seatId !== seat.seatId));
      // Освобождаем удержание только если сами его ставили (не для брони).
      if (exists.held) holdSeat(activeSession.id, seat.seatId, false);
    } else {
      if (!currentCategoryId) return;
      // Бронь (BOOKED) конвертируем в продажу без удержания — место и так жёлтое.
      const held = seat.status === 'FREE';
      setSelected((prev) => [...prev, { seat, categoryId: currentCategoryId, held }]);
      if (held) holdSeat(activeSession.id, seat.seatId, true);
    }
  }

  function releaseAllHolds() {
    if (!activeSession) return;
    selected.forEach((s) => s.held && holdSeat(activeSession.id, s.seat.seatId, false));
  }

  // Освобождаем удержания при уходе с вкладки (размонтировании), чтобы выбранные
  // места не «зависали» зелёными у гостей.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const sessionRef = useRef(activeSession);
  sessionRef.current = activeSession;
  useEffect(
    () => () => {
      const s = sessionRef.current;
      if (s) selectedRef.current.forEach((x) => x.held && holdSeat(s.id, x.seat.seatId, false));
    },
    [],
  );

  function clearOrder() {
    releaseAllHolds();
    setSelected([]);
  }

  async function pay() {
    if (!activeSession || selected.length === 0) return;
    try {
      const order: any = await sellTickets({
        sessionId: activeSession.id,
        seats: selected.map((s) => ({ seatId: s.seat.seatId, categoryId: s.categoryId })),
        paymentMethod: payment,
      });
      // Печать билетов: QR из ответа сервера + данные мест/сеанса с клиента.
      const receipts = (order.tickets ?? []).map((t: any) => {
        const sel = selected.find((s) => s.seat.seatId === t.seatId);
        return {
          movie: activeSession.movie.title,
          sessionAt: activeSession.startsAt,
          hall: activeSession.hall.name,
          row: sel?.seat.row ?? 0,
          number: sel?.seat.number ?? 0,
          category: categories.find((c) => c.categoryId === t.categoryId)?.category.name ?? '',
          price: Number(t.price),
          qr: t.qrCode,
        };
      });
      setSelected([]);
      printTicketReceipts(receipts);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Ошибка продажи');
    }
  }

  return (
    <>
      {/* Фильтр по дате + селектор сеанса */}
      <div className="px-6 py-3 flex gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            releaseAllHolds();
            setDate(e.target.value);
            setSelected([]);
          }}
          className="bg-gray-800 rounded px-4 py-3 text-sm shrink-0"
        />
        <button
          onClick={() => {
            releaseAllHolds();
            setDate(todayStr());
            setSelected([]);
          }}
          className="px-3 py-2 rounded text-xs bg-gray-700 hover:bg-gray-600 shrink-0"
        >
          Сегодня
        </button>
        <select
          className="flex-1 bg-gray-800 rounded px-4 py-3 text-sm"
          value={activeSession?.id ?? ''}
          onChange={(e) => {
            releaseAllHolds();
            onSessionChange(e.target.value);
            setSelected([]);
          }}
        >
          {sessions?.length === 0 && <option value="">Сеансов на эту дату нет</option>}
          {sessions?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.movie.title} ·{' '}
              {new Date(s.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} ·{' '}
              {s.hall.name} · {Number(s.basePrice)} {t('som')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-6 px-6 pb-6">
        {/* Схема зала */}
        <section className="flex-1 bg-gray-900 rounded-lg p-4">
          <div className="text-center text-sm text-gray-400 mb-4">
            {t('free')}: {counts.free} · {t('sold')}: {counts.sold} · {t('selected')}: {selected.length}
          </div>
          <HallScheme seats={seats} selected={selectedIds} onSeatClick={toggleSeat} allowBooked />
          <div className="mt-6">
            <Legend />
          </div>
        </section>

        {/* Панель заказа */}
        <aside className="w-96 bg-gray-800 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('order')}</h2>
            <span className="text-sm text-gray-400">{t('ticketsCount', { count: selected.length })}</span>
          </div>

          <div className="flex-1 space-y-2 overflow-auto">
            {selected.map((s) => (
              <div key={s.seat.seatId} className="bg-gray-700/50 rounded px-3 py-2 flex justify-between items-center">
                <div>
                  <div className="text-sm">
                    {t('row')} {s.seat.row} · {t('seat')} {s.seat.number}
                  </div>
                  <div className="text-xs text-gray-400">
                    {categories.find((c) => c.categoryId === s.categoryId)?.category.name}
                  </div>
                </div>
                <div className="text-sm">
                  {priceOf(s.categoryId)} {t('som')}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="text-xs text-gray-400 mb-2">{t('nextCategory')}</div>
            <div className="flex gap-2">
              {categories.map((c) => (
                <button
                  key={c.categoryId}
                  onClick={() => setNextCategoryId(c.categoryId)}
                  className={`flex-1 text-xs py-2 rounded border ${
                    currentCategoryId === c.categoryId ? 'bg-red-600 border-red-600' : 'border-gray-600'
                  }`}
                >
                  {c.category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-700 mt-4 pt-4 flex justify-between items-center">
            <span className="text-gray-400">{t('total')}</span>
            <span className="text-3xl font-bold">
              {total} {t('som')}
            </span>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setPayment('CASH')}
              className={`flex-1 py-2 rounded border ${payment === 'CASH' ? 'bg-gray-600 border-gray-500' : 'border-gray-600'}`}
            >
              💵 {t('cash')}
            </button>
            <button
              onClick={() => setPayment('CARD')}
              className={`flex-1 py-2 rounded border ${payment === 'CARD' ? 'bg-gray-600 border-gray-500' : 'border-gray-600'}`}
            >
              💳 {t('card')}
            </button>
          </div>

          <button
            onClick={pay}
            disabled={selected.length === 0 || disabled}
            className="mt-3 py-3 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 font-semibold"
          >
            {t('payAndPrint')}
          </button>
          <button onClick={clearOrder} className="mt-2 py-2 rounded border border-gray-600 text-gray-300">
            {t('clearOrder')}
          </button>
        </aside>
      </div>
    </>
  );
}
