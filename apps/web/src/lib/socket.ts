import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { WS_EVENTS, SeatStatus } from '@ailin/shared';
import type { SeatState } from './api';

// Same-origin: подключаемся туда же, откуда открыта страница.
// В dev (5173) Vite проксирует /socket.io на 3000 (ws:true).
const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

let socket: Socket | null = null;
function getSocket(): Socket {
  if (!socket) socket = io(WS_URL, { transports: ['websocket'] });
  return socket;
}

export interface SeatUpdate {
  sessionId: string;
  seatId: string;
  status: SeatStatus;
}

/**
 * Подписка на real-time состояние мест сеанса.
 * При подключении получает снимок, далее — точечные обновления `seat:update`.
 * Используется и кассой, и гостевым дисплеем.
 */
export function useSeatRealtime(sessionId: string | undefined) {
  const [seats, setSeats] = useState<Record<string, SeatState>>({});
  const seatsRef = useRef(seats);
  seatsRef.current = seats;

  useEffect(() => {
    if (!sessionId) return;
    const s = getSocket();

    const onSnapshot = (data: { sessionId: string; seats: SeatState[] }) => {
      if (data.sessionId !== sessionId) return;
      const map: Record<string, SeatState> = {};
      for (const seat of data.seats) map[seat.seatId] = seat;
      setSeats(map);
    };

    const onUpdate = (u: SeatUpdate) => {
      if (u.sessionId !== sessionId) return;
      setSeats((prev) => {
        const existing = prev[u.seatId];
        if (!existing) return prev;
        return { ...prev, [u.seatId]: { ...existing, status: u.status as SeatState['status'] } };
      });
    };

    s.on(WS_EVENTS.SEAT_SNAPSHOT, onSnapshot);
    s.on(WS_EVENTS.SEAT_UPDATE, onUpdate);
    s.emit(WS_EVENTS.JOIN_SESSION, { sessionId });

    return () => {
      s.emit(WS_EVENTS.LEAVE_SESSION, { sessionId });
      s.off(WS_EVENTS.SEAT_SNAPSHOT, onSnapshot);
      s.off(WS_EVENTS.SEAT_UPDATE, onUpdate);
    };
  }, [sessionId]);

  return seats;
}

/** Касса: переключить дисплей гостей на сеанс. */
export function setDisplaySession(sessionId: string) {
  getSocket().emit(WS_EVENTS.DISPLAY_SET, { sessionId });
}

/** Касса: удержать (hold=true) или освободить (hold=false) место при выборе. */
export function holdSeat(sessionId: string, seatId: string, hold: boolean) {
  getSocket().emit(WS_EVENTS.SEAT_HOLD, { sessionId, seatId, hold });
}

/**
 * Дисплей гостей: подписка на канал «какой сеанс показывать».
 * Возвращает сеанс, выбранный кассой (или undefined, пока касса не переключала).
 */
export function useDisplaySession(): string | undefined {
  const [sessionId, setSessionId] = useState<string | undefined>();

  useEffect(() => {
    const s = getSocket();
    const onSession = (data: { sessionId: string }) => setSessionId(data.sessionId);
    s.on(WS_EVENTS.DISPLAY_SESSION, onSession);
    s.emit(WS_EVENTS.DISPLAY_JOIN);
    return () => {
      s.off(WS_EVENTS.DISPLAY_SESSION, onSession);
    };
  }, []);

  return sessionId;
}
