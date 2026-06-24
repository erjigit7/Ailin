import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@Query('date') date?: string, @Query('movieId') movieId?: string) {
    return this.sessions.list({ date, movieId });
  }

  // ВАЖНО: статические пути выше параметрического ':id', иначе 'meta' попадёт в :id.
  @Get('meta/categories')
  categories() {
    return this.sessions.categories();
  }

  @Get('meta/halls')
  halls() {
    return this.sessions.halls();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(
    @Body()
    dto: {
      movieId: string;
      hallId?: string;
      startsAt: string;
      basePrice: number;
      prices?: { categoryId: string; price: number }[];
    },
  ) {
    return this.sessions.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id/prices')
  updatePrices(@Param('id') id: string, @Body() dto: { prices: { categoryId: string; price: number }[] }) {
    return this.sessions.updatePrices(id, dto.prices ?? []);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.sessions.cancel(id);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.sessions.getOne(id);
  }

  @Get(':id/seats')
  seatMap(@Param('id') id: string) {
    return this.sessions.seatMap(id);
  }
}
