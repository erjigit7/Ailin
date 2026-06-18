import { Module } from '@nestjs/common';
import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftsModule } from '../shifts/shifts.module';
import { ShiftsService } from '../shifts/shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';

/** Готовит данные товара к записи: числа → Decimal, отсекает лишнее. */
function productWriteData(d: any) {
  const out: any = {};
  if (d.categoryId !== undefined) out.categoryId = d.categoryId;
  if (d.name !== undefined) out.name = d.name;
  if (d.unit !== undefined) out.unit = d.unit;
  if (d.salePrice !== undefined) out.salePrice = new Prisma.Decimal(d.salePrice);
  if (d.purchasePrice !== undefined) out.purchasePrice = new Prisma.Decimal(d.purchasePrice);
  if (d.stock !== undefined) out.stock = new Prisma.Decimal(d.stock);
  if (d.lowStockThreshold !== undefined && d.lowStockThreshold !== null && d.lowStockThreshold !== '')
    out.lowStockThreshold = new Prisma.Decimal(d.lowStockThreshold);
  return out;
}

@UseGuards(JwtAuthGuard)
@Controller('bar')
class BarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: ShiftsService,
  ) {}

  /**
   * Продажа товаров бара отдельным чеком (без билетов).
   * Объединённый чек «билет + бар» оформляется через /tickets/sell.
   */
  @Post('sell')
  async sell(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      paymentMethod: 'CASH' | 'CARD' | 'QR';
      items: { productId: string; quantity: number }[];
    },
  ) {
    const shift = await this.shifts.requireOpen(user.userId);
    return this.prisma.$transaction(async (tx) => {
      let total = new Prisma.Decimal(0);
      const itemsData: Prisma.OrderBarItemCreateManyOrderInput[] = [];
      for (const item of dto.items) {
        const product = await tx.barProduct.findUnique({ where: { id: item.productId } });
        if (!product) throw new NotFoundException('Товар бара не найден');
        total = total.add(product.salePrice.mul(item.quantity));
        itemsData.push({
          productId: product.id,
          quantity: new Prisma.Decimal(item.quantity),
          price: product.salePrice,
        });
        await tx.barProduct.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: 'SALE',
            quantity: new Prisma.Decimal(-item.quantity),
            userId: user.userId,
          },
        });
      }
      return tx.order.create({
        data: {
          shiftId: shift.id,
          cashierId: user.userId,
          paymentMethod: dto.paymentMethod,
          total,
          barItems: { createMany: { data: itemsData } },
        },
        include: { barItems: true },
      });
    });
  }

  @Get('categories')
  categories() {
    return this.prisma.barCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      // Стабильный порядок товаров (по дате создания), чтобы места не «прыгали».
      include: { products: { where: { active: true }, orderBy: { createdAt: 'asc' } } },
    });
  }

  @Get('products')
  products() {
    return this.prisma.barProduct.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Управление товарами/категориями (только админ) ───

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('categories')
  createCategory(@Body() dto: { name: string; sortOrder?: number }) {
    return this.prisma.barCategory.create({
      data: { name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('products')
  createProduct(@Body() dto: any) {
    return this.prisma.barProduct.create({ data: productWriteData(dto) });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.barProduct.update({ where: { id }, data: productWriteData(dto) });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    // мягкое удаление — товар скрывается, история продаж сохраняется
    return this.prisma.barProduct.update({ where: { id }, data: { active: false } });
  }

  /** Приход товара на склад. */
  @Post('purchase')
  async purchase(@Body() dto: { productId: string; quantity: number; unitPrice: number }) {
    await this.prisma.inventoryMovement.create({
      data: {
        productId: dto.productId,
        type: 'PURCHASE',
        quantity: new Prisma.Decimal(dto.quantity),
        unitPrice: new Prisma.Decimal(dto.unitPrice),
      },
    });
    return this.prisma.barProduct.update({
      where: { id: dto.productId },
      data: { stock: { increment: dto.quantity }, purchasePrice: new Prisma.Decimal(dto.unitPrice) },
    });
  }

  /** Списание (порча/бой/личное потребление). */
  @Post('write-off')
  async writeOff(@Body() dto: { productId: string; quantity: number; reason: string }) {
    await this.prisma.inventoryMovement.create({
      data: {
        productId: dto.productId,
        type: 'WRITE_OFF',
        quantity: new Prisma.Decimal(-dto.quantity),
        reason: dto.reason,
      },
    });
    return this.prisma.barProduct.update({
      where: { id: dto.productId },
      data: { stock: { decrement: dto.quantity } },
    });
  }

  /** Товары с остатком ниже порога. */
  @Get('low-stock')
  async lowStock() {
    const products = await this.prisma.barProduct.findMany({
      where: { active: true, lowStockThreshold: { not: null } },
    });
    return products.filter(
      (p) => p.lowStockThreshold !== null && p.stock.lte(p.lowStockThreshold),
    );
  }

  @Get('product/:id/movements')
  movements(@Param('id') id: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}

@Module({ imports: [ShiftsModule], controllers: [BarController] })
export class BarModule {}
