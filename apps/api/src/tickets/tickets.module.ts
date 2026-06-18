import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [ShiftsModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
