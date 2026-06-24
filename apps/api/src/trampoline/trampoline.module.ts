import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftsModule } from '../shifts/shifts.module';
import { ShiftsService } from '../shifts/shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';

function tariffWriteData(d: any) {
  const out: any = {};
  if (d.name !== undefined) out.name = d.name;
  if (d.sortOrder !== undefined) out.sortOrder = Number(d.sortOrder);
  if (d.durationMin !== undefined && d.durationMin !== null && d.durationMin !== '')
    out.durationMin = Number(d.durationMin);
  if (d.price !== undefined) out.price = new Prisma.Decimal(d.price);
  return out;
}

@UseGuards(JwtAuthGuard)
@Controller('trampoline')
class TrampolineController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: ShiftsService,
  ) {}

  /** Тарифы батута (стабильный порядок). */
  @Get('tariffs')
  tariffs() {
    return this.prisma.trampolineTariff.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Продажа батута: один чек с позициями по тарифам. */
  @Post('sell')
  async sell(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      paymentMethod: 'CASH' | 'CARD' | 'QR';
      items: { tariffId: string; quantity: number }[];
    },
  ) {
    const shift = await this.shifts.requireOpen(user.userId);
    return this.prisma.$transaction(async (tx) => {
      let total = new Prisma.Decimal(0);
      const itemsData: Prisma.OrderTrampolineItemCreateManyOrderInput[] = [];
      for (const item of dto.items) {
        const tariff = await tx.trampolineTariff.findUnique({ where: { id: item.tariffId } });
        if (!tariff) throw new NotFoundException('Тариф батута не найден');
        total = total.add(tariff.price.mul(item.quantity));
        itemsData.push({
          tariffId: tariff.id,
          quantity: item.quantity,
          price: tariff.price,
        });
      }
      return tx.order.create({
        data: {
          shiftId: shift.id,
          cashierId: user.userId,
          paymentMethod: dto.paymentMethod,
          total,
          trampolineItems: { createMany: { data: itemsData } },
        },
        include: { trampolineItems: { include: { tariff: true } } },
      });
    });
  }

  // ─── Управление тарифами (только админ) ───

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('tariffs')
  create(@Body() dto: any) {
    return this.prisma.trampolineTariff.create({ data: tariffWriteData(dto) });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('tariffs/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.trampolineTariff.update({ where: { id }, data: tariffWriteData(dto) });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('tariffs/:id')
  remove(@Param('id') id: string) {
    // мягкое удаление — история продаж сохраняется
    return this.prisma.trampolineTariff.update({ where: { id }, data: { active: false } });
  }
}

@Module({ imports: [ShiftsModule], controllers: [TrampolineController] })
export class TrampolineModule {}
