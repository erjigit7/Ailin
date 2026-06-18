-- Частичные уникальные индексы — защита от двойной продажи / двойной брони.
-- Prisma не умеет выражать partial unique index в schema.prisma, поэтому применяем
-- их отдельно: `npm run db:indexes` (после prisma migrate).

-- Непогашенный билет на место в сеансе должен быть единственным.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_ticket_per_seat
  ON tickets ("sessionId", "seatId")
  WHERE returned = false;

-- Активная (не сброшенная) бронь на место в сеансе должна быть единственной.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_seat
  ON bookings ("sessionId", "seatId")
  WHERE released = false;
