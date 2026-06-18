import { Module } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@Query('sessionId') sessionId: string) {
    return this.bookings.listActive(sessionId);
  }

  @Post()
  create(
    @Body()
    dto: {
      sessionId: string;
      seatIds: string[];
      customerName?: string;
      customerPhone?: string;
      holdMinutes?: number;
    },
  ) {
    return this.bookings.create(dto);
  }

  @Post(':id/release')
  release(@Param('id') id: string) {
    return this.bookings.release(id);
  }
}

@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
