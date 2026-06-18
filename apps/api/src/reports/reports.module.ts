import { Module } from '@nestjs/common';
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('revenue')
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.revenue(from, to);
  }

  @Get('top-products')
  topProducts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.topProducts(from, to);
  }

  @Get('shift/:id')
  shift(@Param('id') id: string) {
    return this.reports.shift(id);
  }

  @Get('occupancy')
  occupancy(@Query('date') date?: string) {
    return this.reports.occupancy(date);
  }

  // ─── Экспорт ───
  @Get('export/excel')
  async excel(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('date') date?: string,
  ) {
    const buf = await this.reports.excel({ from, to, date });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
    res.end(buf);
  }

  @Get('export/pdf')
  async pdf(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('date') date?: string,
  ) {
    const buf = await this.reports.pdf({ from, to, date });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
    res.end(buf);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
