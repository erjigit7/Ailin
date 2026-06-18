import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { SellTicketsDto, ReturnTicketDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('sell')
  sell(@Body() dto: SellTicketsDto, @CurrentUser() user: JwtUser) {
    return this.tickets.sell(dto, user.userId);
  }

  @Post('return')
  returnTicket(@Body() dto: ReturnTicketDto, @CurrentUser() user: JwtUser) {
    return this.tickets.returnTicket(dto, user.userId);
  }

  /** Поиск проданного билета для возврата: по QR или по сеансу + ряд + место. */
  @Get('find')
  find(
    @Query('qr') qr?: string,
    @Query('sessionId') sessionId?: string,
    @Query('row') row?: string,
    @Query('number') number?: string,
  ) {
    return this.tickets.find({
      qr,
      sessionId,
      row: row ? Number(row) : undefined,
      number: number ? Number(number) : undefined,
    });
  }
}
