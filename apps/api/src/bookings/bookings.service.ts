import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SeatStatus } from '@ailin/shared';

const DEFAULT_HOLD_MINUTES = 30;
const SWEEP_INTERVAL_MS = 30_000; // как часто проверять истёкшие брони

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit() {
    // Периодический авто-сброс просроченных броней (ТЗ: настраиваемый таймаут).
    this.timer = setInterval(() => this.sweepExpired().catch(() => {}), SWEEP_INTERVAL_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Активные брони сеанса (не сброшены и не истекли). */
  listActive(sessionId: string) {
    return this.prisma.booking.findMany({
      where: { sessionId, released: false, expiresAt: { gt: new Date() } },
      include: { seat: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Создание брони на одно или несколько мест без оплаты. */
  async create(dto: {
    sessionId: string;
    seatIds: string[];
    customerName?: string;
    customerPhone?: string;
    holdMinutes?: number;
  }) {
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } });
    if (!session) throw new NotFoundException('Сеанс не найден');
    if (session.status === 'CANCELLED') throw new BadRequestException('Сеанс отменён');

    const minutes = dto.holdMinutes && dto.holdMinutes > 0 ? dto.holdMinutes : DEFAULT_HOLD_MINUTES;
    const expiresAt = new Date(Date.now() + minutes * 60_000);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Места не должны быть уже проданы.
        const sold = await tx.ticket.findMany({
          where: { sessionId: dto.sessionId, seatId: { in: dto.seatIds }, returned: false },
          select: { seatId: true },
        });
        if (sold.length > 0) throw new ConflictException('Некоторые места уже проданы');

        for (const seatId of dto.seatIds) {
          await tx.booking.create({
            data: {
              sessionId: dto.sessionId,
              seatId,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              expiresAt,
            },
          });
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Некоторые места уже забронированы');
      }
      throw e;
    }

    // Real-time: места стали забронированными (жёлтые).
    for (const seatId of dto.seatIds) {
      this.realtime.emit(dto.sessionId, seatId, SeatStatus.BOOKED);
    }
    return { ok: true, count: dto.seatIds.length, expiresAt };
  }

  /** Снять бронь вручную — место освобождается. */
  async release(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Бронь не найдена');
    if (!booking.released) {
      await this.prisma.booking.update({ where: { id }, data: { released: true } });
      this.realtime.emit(booking.sessionId, booking.seatId, SeatStatus.FREE);
    }
    return { ok: true };
  }

  /** Сброс всех просроченных броней + рассылка освобождения мест. */
  async sweepExpired() {
    const expired = await this.prisma.booking.findMany({
      where: { released: false, expiresAt: { lte: new Date() } },
    });
    if (expired.length === 0) return;
    await this.prisma.booking.updateMany({
      where: { id: { in: expired.map((b) => b.id) } },
      data: { released: true },
    });
    for (const b of expired) {
      this.realtime.emit(b.sessionId, b.seatId, SeatStatus.FREE);
    }
  }
}
