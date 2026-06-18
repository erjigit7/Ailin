import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Текущая открытая смена кассира (или null). */
  current(cashierId: string) {
    return this.prisma.shift.findFirst({
      where: { cashierId, closedAt: null },
      orderBy: { openedAt: 'desc' },
    });
  }

  /** Открытая смена или ошибка — для операций продажи/возврата. */
  async requireOpen(cashierId: string) {
    const shift = await this.current(cashierId);
    if (!shift) throw new BadRequestException('Смена не открыта');
    return shift;
  }

  async open(cashierId: string, startCash: number) {
    const existing = await this.current(cashierId);
    if (existing) throw new BadRequestException('Смена уже открыта');
    return this.prisma.shift.create({
      data: { cashierId, startCash: new Prisma.Decimal(startCash) },
    });
  }

  /**
   * Закрытие смены: считает Z-отчёт и расхождение между фактической и расчётной
   * суммой наличных в кассе (ТЗ: контроль расхождений).
   */
  async close(cashierId: string, endCashFact: number) {
    const shift = await this.current(cashierId);
    if (!shift) throw new NotFoundException('Открытой смены нет');

    const orders = await this.prisma.order.findMany({ where: { shiftId: shift.id } });
    const returns = await this.prisma.return.findMany({ where: { shiftId: shift.id } });

    const cashSales = orders
      .filter((o) => o.paymentMethod === 'CASH')
      .reduce((s, o) => s + Number(o.total), 0);
    const cashRefunds = returns.reduce((s, r) => s + Number(r.amount), 0);
    // Расчётная наличность = старт + продажи нал − возвраты нал
    const endCashCalc = Number(shift.startCash) + cashSales - cashRefunds;
    const discrepancy = endCashFact - endCashCalc;

    const closed = await this.prisma.shift.update({
      where: { id: shift.id },
      data: {
        closedAt: new Date(),
        endCashFact: new Prisma.Decimal(endCashFact),
        endCashCalc: new Prisma.Decimal(endCashCalc),
      },
    });

    return {
      shift: closed,
      report: {
        ordersCount: orders.length,
        sales: orders.reduce((s, o) => s + Number(o.total), 0),
        cashSales,
        cardSales: orders
          .filter((o) => o.paymentMethod !== 'CASH')
          .reduce((s, o) => s + Number(o.total), 0),
        refunds: cashRefunds,
        startCash: Number(shift.startCash),
        endCashCalc,
        endCashFact,
        discrepancy,
      },
    };
  }
}
