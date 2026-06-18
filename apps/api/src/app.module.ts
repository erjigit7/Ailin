import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { TicketsModule } from './tickets/tickets.module';
import { MoviesModule } from './movies/movies.module';
import { BarModule } from './bar/bar.module';
import { ReportsModule } from './reports/reports.module';
import { ShiftsModule } from './shifts/shifts.module';
import { BookingsModule } from './bookings/bookings.module';

// Прод-режим: API отдаёт собранный фронт (apps/web/dist) с тем же origin.
// В dev папки нет — модуль не подключается, фронт обслуживает Vite.
const WEB_DIST = join(__dirname, '..', '..', 'web', 'dist');
const serveWeb = existsSync(join(WEB_DIST, 'index.html'))
  ? [
      ServeStaticModule.forRoot({
        rootPath: WEB_DIST,
        exclude: ['/api/(.*)', '/socket.io/(.*)'],
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...serveWeb,
    PrismaModule,
    RealtimeModule,
    AuthModule,
    SessionsModule,
    TicketsModule,
    MoviesModule,
    BarModule,
    ReportsModule,
    ShiftsModule,
    BookingsModule,
  ],
})
export class AppModule {}
