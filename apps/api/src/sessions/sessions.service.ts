import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SeatStatus } from '@ailin/shared';
import { mapMovieOut } from '../common/format';

interface CreateSessionInput {
  movieId: string;
  hallId?: string;
  startsAt: string;
  basePrice: number;
  prices?: { categoryId: string; price: number }[];
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Категории билетов — для формы цен при создании сеанса. */
  categories() {
    return this.prisma.ticketCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  /** Залы — для выбора при создании сеанса. */
  halls() {
    return this.prisma.hall.findMany({ orderBy: { name: 'asc' } });
  }

  /** Создание сеанса с ценами по категориям. */
  async create(input: CreateSessionInput) {
    const hallId = input.hallId ?? (await this.prisma.hall.findFirst())?.id;
    if (!hallId) throw new NotFoundException('Зал не найден');

    // Если цены по категориям не заданы — берём базовую для всех категорий.
    let prices = input.prices;
    if (!prices?.length) {
      const cats = await this.prisma.ticketCategory.findMany({ where: { active: true } });
      prices = cats.map((c) => ({ categoryId: c.id, price: input.basePrice }));
    }

    const session = await this.prisma.session.create({
      data: {
        movieId: input.movieId,
        hallId,
        startsAt: new Date(input.startsAt),
        basePrice: new Prisma.Decimal(input.basePrice),
        prices: {
          create: prices.map((p) => ({
            categoryId: p.categoryId,
            price: new Prisma.Decimal(p.price),
          })),
        },
      },
      include: { movie: true, prices: { include: { category: true } } },
    });
    mapMovieOut(session.movie);
    return session;
  }

  /** Установить/изменить цены по категориям для сеанса. */
  async updatePrices(id: string, prices: { categoryId: string; price: number }[]) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Сеанс не найден');
    for (const p of prices) {
      await this.prisma.sessionPrice.upsert({
        where: { sessionId_categoryId: { sessionId: id, categoryId: p.categoryId } },
        update: { price: new Prisma.Decimal(p.price) },
        create: { sessionId: id, categoryId: p.categoryId, price: new Prisma.Decimal(p.price) },
      });
    }
    return this.getOne(id);
  }

  /**
   * Отмена сеанса с автоматическим возвратом всех проданных билетов (ТЗ 3.3).
   * Освобождает места и шлёт обновления на дисплей.
   */
  async cancel(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { tickets: { where: { returned: false }, include: { order: true } } },
    });
    if (!session) throw new NotFoundException('Сеанс не найден');

    await this.prisma.$transaction(async (tx) => {
      for (const ticket of session.tickets) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { returned: true } });
        // Возврат относим к смене и кассиру исходного заказа.
        await tx.return.create({
          data: {
            ticketId: ticket.id,
            orderId: ticket.orderId,
            shiftId: ticket.order.shiftId,
            cashierId: ticket.order.cashierId,
            reason: 'Отмена сеанса',
            amount: ticket.price,
          },
        });
      }
      await tx.session.update({ where: { id }, data: { status: 'CANCELLED' } });
    });

    // Real-time: освободить все возвращённые места
    for (const ticket of session.tickets) {
      this.realtime.emit(id, ticket.seatId, SeatStatus.FREE);
    }
    return { ok: true, refunded: session.tickets.length };
  }

  /** Сеансы на день (по умолчанию сегодня), опционально по фильму. */
  async list(params: { date?: string; movieId?: string }) {
    const where: any = { status: 'SCHEDULED' };
    if (params.date) {
      const day = new Date(params.date);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      where.startsAt = { gte: day, lt: next };
    }
    if (params.movieId) where.movieId = params.movieId;

    const sessions = await this.prisma.session.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: { movie: true, hall: true, prices: { include: { category: true } } },
    });
    sessions.forEach((s) => mapMovieOut(s.movie));
    return sessions;
  }

  async getOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { movie: true, hall: true, prices: { include: { category: true } } },
    });
    if (!session) throw new NotFoundException('Сеанс не найден');
    mapMovieOut(session.movie);
    return session;
  }

  /** Схема мест сеанса со статусами — для кассы и дисплея (REST-вариант снимка). */
  async seatMap(id: string) {
    const session = await this.getOne(id);
    const seats = await this.realtime.getSeatSnapshot(id);
    const free = seats.filter((s) => s.status === 'FREE').length;
    const sold = seats.filter((s) => s.status === 'SOLD').length;
    const booked = seats.filter((s) => s.status === 'BOOKED').length;
    return {
      session: {
        id: session.id,
        movieTitle: session.movie.title,
        startsAt: session.startsAt,
        hallName: session.hall.name,
      },
      counts: { total: seats.length, free, sold, booked },
      seats,
    };
  }
}
