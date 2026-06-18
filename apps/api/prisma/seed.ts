import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { HALL_1_LAYOUT } from '@ailin/shared';

const prisma = new PrismaClient();

async function main() {
  // ─── Пользователи ───
  const adminPass = await bcrypt.hash('admin', 10);
  const cashierPass = await bcrypt.hash('cashier', 10);

  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: { login: 'admin', password: adminPass, fullName: 'Администратор', role: 'ADMIN' },
  });
  // Фиксированный id кассира — на него ссылается заглушка контроллера (TEMP_CASHIER)
  const cashier = await prisma.user.upsert({
    where: { login: 'kassir' },
    update: {},
    create: {
      id: 'seed-cashier',
      login: 'kassir',
      password: cashierPass,
      fullName: 'Айгуль К.',
      role: 'CASHIER',
    },
  });

  // Открытая смена для демо-продаж
  await prisma.shift.upsert({
    where: { id: 'seed-shift' },
    update: {},
    create: { id: 'seed-shift', cashierId: cashier.id, startCash: new Prisma.Decimal(5000) },
  });

  // ─── Зал и места (асимметричная раскладка из @ailin/shared) ───
  const hall = await prisma.hall.upsert({
    where: { id: 'hall-1' },
    update: {},
    create: { id: 'hall-1', name: HALL_1_LAYOUT.name },
  });

  for (const row of HALL_1_LAYOUT.rows) {
    for (const seat of row.seats) {
      await prisma.seat.upsert({
        where: { hallId_row_number: { hallId: hall.id, row: row.row, number: seat.number } },
        update: {},
        create: {
          hallId: hall.id,
          row: row.row,
          number: seat.number,
          block: seat.block === 'left' ? 'LEFT' : 'RIGHT',
        },
      });
    }
  }

  // ─── Категории билетов ───
  const categories = [
    { code: 'ADULT', name: 'Взрослый' },
    { code: 'CHILD', name: 'Детский' },
    { code: 'CONCESSION', name: 'Льготный' },
  ];
  const catRecords: { id: string; code: string; name: string }[] = [];
  for (const c of categories) {
    catRecords.push(
      await prisma.ticketCategory.upsert({
        where: { code: c.code },
        update: {},
        create: c,
      }),
    );
  }

  // ─── Фильм + сеансы ───
  const movie = await prisma.movie.upsert({
    where: { id: 'movie-avatar' },
    update: {},
    create: {
      id: 'movie-avatar',
      title: 'Аватар: Огонь и пепел',
      durationMin: 190,
      ageRating: '12+',
      genre: 'фантастика',
      language: 'RU',
      format: 'THREE_D',
    },
  });

  function todayAt(h: number, m: number) {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  const prices: Record<string, number> = { ADULT: 250, CHILD: 150, CONCESSION: 180 };
  for (const [id, time] of [
    ['session-1930', todayAt(19, 30)],
    ['session-2200', todayAt(22, 0)],
  ] as [string, Date][]) {
    const session = await prisma.session.upsert({
      where: { id },
      update: {},
      create: {
        id,
        movieId: movie.id,
        hallId: hall.id,
        startsAt: time,
        basePrice: new Prisma.Decimal(250),
      },
    });
    for (const cat of catRecords) {
      await prisma.sessionPrice.upsert({
        where: { sessionId_categoryId: { sessionId: session.id, categoryId: cat.id } },
        update: {},
        create: {
          sessionId: session.id,
          categoryId: cat.id,
          price: new Prisma.Decimal(prices[cat.code]),
        },
      });
    }
  }

  // ─── Бар ───
  const barCats = [
    { id: 'bc-popcorn', name: 'Попкорн', sortOrder: 1 },
    { id: 'bc-drinks', name: 'Напитки', sortOrder: 2 },
    { id: 'bc-snacks', name: 'Снеки', sortOrder: 3 },
    { id: 'bc-coffee', name: 'Кофе', sortOrder: 4 },
  ];
  for (const c of barCats) {
    await prisma.barCategory.upsert({ where: { id: c.id }, update: {}, create: c });
  }

  const products = [
    { name: 'Попкорн солёный M', categoryId: 'bc-popcorn', salePrice: 150, purchasePrice: 40, stock: 100 },
    { name: 'Попкорн карамель L', categoryId: 'bc-popcorn', salePrice: 220, purchasePrice: 70, stock: 80 },
    { name: 'Кола 0.5', categoryId: 'bc-drinks', salePrice: 120, purchasePrice: 50, stock: 200 },
    { name: 'Вода 0.5', categoryId: 'bc-drinks', salePrice: 60, purchasePrice: 20, stock: 200 },
    { name: 'Начос с сыром', categoryId: 'bc-snacks', salePrice: 200, purchasePrice: 80, stock: 50 },
    { name: 'Капучино', categoryId: 'bc-coffee', salePrice: 140, purchasePrice: 45, stock: 999 },
  ];
  // Товары бара создаём только если их ещё нет (идемпотентность повторного сида).
  const existingProducts = await prisma.barProduct.count();
  if (existingProducts === 0) {
    for (const p of products) {
      await prisma.barProduct.create({
        data: {
          categoryId: p.categoryId,
          name: p.name,
          salePrice: new Prisma.Decimal(p.salePrice),
          purchasePrice: new Prisma.Decimal(p.purchasePrice),
          stock: new Prisma.Decimal(p.stock),
          lowStockThreshold: new Prisma.Decimal(10),
        },
      });
    }
  }

  console.log('Сиды загружены: зал на 49 мест, фильм, 2 сеанса, бар, пользователи (admin/admin, kassir/cashier).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
