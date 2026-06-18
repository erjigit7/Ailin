import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SeatStatus } from '@ailin/shared';

export interface SeatState {
  seatId: string;
  row: number;
  number: number;
  block: 'left' | 'right';
  status: SeatStatus; // FREE | SOLD | BOOKED
}

type Emitter = (p: { sessionId: string; seatId: string; status: SeatStatus }) => void;

/**
 * Связывает доменные модули (продажа/бронь/возврат) с WebSocket-шлюзом, не создавая
 * циклическую зависимость: модули зовут emit(), а gateway регистрирует реальный эмиттер.
 * Также собирает снимок состояния мест сеанса для подписавшихся клиентов.
 */
@Injectable()
export class RealtimeService {
  private emitter: Emitter = () => {};

  /** Какой сеанс сейчас показывать на дисплее гостей (управляется кассой). */
  private displaySessionId: string | null = null;

  /** Временно удерживаемые (выбранные кассой, но не оплаченные) места: sessionId → Set seatId. */
  private holds = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  /** Удержать место. true — если статус изменился (раньше не было удержания). */
  addHold(sessionId: string, seatId: string): boolean {
    let set = this.holds.get(sessionId);
    if (!set) {
      set = new Set();
      this.holds.set(sessionId, set);
    }
    if (set.has(seatId)) return false;
    set.add(seatId);
    return true;
  }

  /** Снять удержание. true — если оно действительно было (нужно ли слать FREE). */
  removeHold(sessionId: string, seatId: string): boolean {
    const set = this.holds.get(sessionId);
    if (!set || !set.has(seatId)) return false;
    set.delete(seatId);
    return true;
  }

  bindEmitter(emitter: Emitter) {
    this.emitter = emitter;
  }

  getDisplaySession(): string | null {
    return this.displaySessionId;
  }

  setDisplaySession(sessionId: string) {
    this.displaySessionId = sessionId;
  }

  emit(sessionId: string, seatId: string, status: SeatStatus) {
    this.emitter({ sessionId, seatId, status });
  }

  /** Полное состояние всех мест зала для конкретного сеанса. */
  async getSeatSnapshot(sessionId: string): Promise<SeatState[]> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        hall: { include: { seats: { orderBy: [{ row: 'asc' }, { number: 'asc' }] } } },
        tickets: { where: { returned: false }, select: { seatId: true } },
        bookings: { where: { released: false }, select: { seatId: true } },
      },
    });
    if (!session) return [];

    const sold = new Set(session.tickets.map((t) => t.seatId));
    const booked = new Set(session.bookings.map((b) => b.seatId));
    const held = this.holds.get(sessionId) ?? new Set<string>();

    return session.hall.seats.map((seat) => {
      let status = SeatStatus.FREE;
      if (sold.has(seat.id)) status = SeatStatus.SOLD;
      else if (booked.has(seat.id)) status = SeatStatus.BOOKED;
      else if (held.has(seat.id)) status = SeatStatus.SELECTED;
      return {
        seatId: seat.id,
        row: seat.row,
        number: seat.number,
        block: seat.block === 'LEFT' ? 'left' : 'right',
        status,
      };
    });
  }
}
