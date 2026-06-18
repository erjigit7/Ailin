import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ShiftsService } from '../shifts/shifts.service';
import { SeatStatus } from '@ailin/shared';
import { SellTicketsDto, ReturnTicketDto } from './dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly shifts: ShiftsService,
  ) {}

  /**
   * Продажа одного или нескольких мест одним заказом (чеком).
   * Всё в транзакции: либо продаётся весь заказ, либо ничего.
   * Защита от двойной продажи — проверка занятости внутри транзакции + частичный
   * уникальный индекс в БД (ловит гонку двух кассиров).
   */
  async sell(dto: SellTicketsDto, cashierId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: { prices: true },
    });
    if (!session) throw new NotFoundException('Сеанс не найден');
    if (session.status === 'CANCELLED')
      throw new BadRequestException('Сеанс отменён');

    const shift = await this.shifts.requireOpen(cashierId);

    const priceByCategory = new Map(
      session.prices.map((p) => [p.categoryId, p.price]),
    );

    const order = await this.prisma
      .$transaction(async (tx) => {
        // Проверяем, что места ещё свободны (нет непогашенного билета / активной брони)
        const seatIds = dto.seats.map((s) => s.seatId);
        const taken = await tx.ticket.findMany({
          where: { sessionId: dto.sessionId, seatId: { in: seatIds }, returned: false },
          select: { seatId: true },
        });
        if (taken.length > 0) {
          throw new ConflictException('Некоторые места уже проданы');
        }

        let total = new Prisma.Decimal(0);
        const ticketsData = dto.seats.map((s) => {
          const price = priceByCategory.get(s.categoryId) ?? session.basePrice;
          total = total.add(price);
          return {
            sessionId: dto.sessionId,
            seatId: s.seatId,
            categoryId: s.categoryId,
            price,
            qrCode: randomUUID(),
          };
        });

        // Товары бара в этом же чеке
        let barTotal = new Prisma.Decimal(0);
        const barItemsData: Prisma.OrderBarItemCreateManyOrderInput[] = [];
        if (dto.barItems?.length) {
          for (const item of dto.barItems) {
            const product = await tx.barProduct.findUnique({ where: { id: item.productId } });
            if (!product) throw new NotFoundException('Товар бара не найден');
            const line = product.salePrice.mul(item.quantity);
            barTotal = barTotal.add(line);
            barItemsData.push({
              productId: product.id,
              quantity: new Prisma.Decimal(item.quantity),
              price: product.salePrice,
            });
            // Списываем со склада + движение SALE
            await tx.barProduct.update({
              where: { id: product.id },
              data: { stock: { decrement: item.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                productId: product.id,
                type: 'SALE',
                quantity: new Prisma.Decimal(-item.quantity),
                userId: cashierId,
              },
            });
          }
        }

        const created = await tx.order.create({
          data: {
            shiftId: shift.id,
            cashierId,
            paymentMethod: dto.paymentMethod,
            total: total.add(barTotal),
            tickets: { create: ticketsData },
            barItems: barItemsData.length ? { createMany: { data: barItemsData } } : undefined,
          },
          include: { tickets: true, barItems: true },
        });

        // Снять активную бронь на эти места, если была
        await tx.booking.updateMany({
          where: { sessionId: dto.sessionId, seatId: { in: seatIds }, released: false },
          data: { released: true },
        });

        return created;
      })
      .catch((e) => {
        // Нарушение частичного уникального индекса = место перехватил другой кассир
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Место уже продано другим кассиром');
        }
        throw e;
      });

    // Real-time: места стали проданными. Снимаем удержание (выбор) на сервере,
    // чтобы последующий дисконнект кассы не пометил место снова свободным.
    for (const t of order.tickets) {
      this.realtime.removeHold(dto.sessionId, t.seatId);
      this.realtime.emit(dto.sessionId, t.seatId, SeatStatus.SOLD);
    }
    return order;
  }

  /** Поиск непогашенного билета по QR или по сеансу+ряд+место (для возврата). */
  async find(params: { qr?: string; sessionId?: string; row?: number; number?: number }) {
    const where: any = { returned: false };
    if (params.qr) {
      where.qrCode = params.qr;
    } else if (params.sessionId && params.row != null && params.number != null) {
      where.sessionId = params.sessionId;
      where.seat = { row: params.row, number: params.number };
    } else {
      throw new BadRequestException('Укажите QR или сеанс + ряд + место');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        seat: true,
        category: true,
        session: { include: { movie: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Билет не найден');
    return ticket;
  }

  /** Возврат билета: освобождает место и фиксирует в отчёте. */
  async returnTicket(dto: ReturnTicketDto, cashierId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
    if (!ticket) throw new NotFoundException('Билет не найден');
    if (ticket.returned) throw new BadRequestException('Билет уже возвращён');

    const shift = await this.shifts.requireOpen(cashierId);

    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { returned: true },
      }),
      this.prisma.return.create({
        data: {
          ticketId: ticket.id,
          orderId: ticket.orderId,
          shiftId: shift.id,
          cashierId,
          reason: dto.reason,
          amount: ticket.price,
        },
      }),
    ]);

    // Real-time: место снова свободно
    this.realtime.emit(ticket.sessionId, ticket.seatId, SeatStatus.FREE);
    return { ok: true };
  }
}
