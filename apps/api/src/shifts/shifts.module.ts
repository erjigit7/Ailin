import { Module } from '@nestjs/common';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('shifts')
class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get('current')
  current(@CurrentUser() user: JwtUser) {
    return this.shifts.current(user.userId);
  }

  @Post('open')
  open(@CurrentUser() user: JwtUser, @Body() dto: { startCash: number }) {
    return this.shifts.open(user.userId, dto.startCash ?? 0);
  }

  @Post('close')
  close(@CurrentUser() user: JwtUser, @Body() dto: { endCashFact: number }) {
    return this.shifts.close(user.userId, dto.endCashFact ?? 0);
  }
}

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
