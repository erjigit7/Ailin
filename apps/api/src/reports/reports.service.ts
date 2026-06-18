import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

// pdfmake (server-side) + шрифты Roboto с кириллицей из vfs.
const PdfPrinter = require('pdfmake');
const vfsModule = require('pdfmake/build/vfs_fonts.js');
const VFS = vfsModule.pdfMake ? vfsModule.pdfMake.vfs : vfsModule.vfs || vfsModule;
const pdfFonts = {
  Roboto: {
    normal: Buffer.from(VFS['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(VFS['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(VFS['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(VFS['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

export interface ReportParams {
  from?: string;
  to?: string;
  date?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private periodWhere(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    return where;
  }

  async revenue(from?: string, to?: string) {
    const orders = await this.prisma.order.findMany({
      where: this.periodWhere(from, to),
      include: { tickets: true, barItems: true },
    });
    let tickets = 0;
    let bar = 0;
    const byPayment: Record<string, number> = {};
    for (const o of orders) {
      tickets += o.tickets.reduce((s, x) => s + Number(x.price), 0);
      bar += o.barItems.reduce((s, x) => s + Number(x.price) * Number(x.quantity), 0);
      byPayment[o.paymentMethod] = (byPayment[o.paymentMethod] || 0) + Number(o.total);
    }
    return { tickets, bar, total: tickets + bar, byPayment, ordersCount: orders.length };
  }

  async shift(id: string) {
    const orders = await this.prisma.order.findMany({ where: { shiftId: id } });
    const returns = await this.prisma.return.findMany({ where: { shiftId: id } });
    const sales = orders.reduce((s, o) => s + Number(o.total), 0);
    const refunds = returns.reduce((s, r) => s + Number(r.amount), 0);
    return { ordersCount: orders.length, sales, refunds, net: sales - refunds };
  }

  async topProducts(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.order = { createdAt: {} };
      if (from) where.order.createdAt.gte = new Date(from);
      if (to) where.order.createdAt.lte = new Date(to);
    }
    const items = await this.prisma.orderBarItem.findMany({ where, include: { product: true } });
    const byProduct = new Map<string, { name: string; qty: number; sum: number }>();
    for (const it of items) {
      const cur = byProduct.get(it.productId) ?? { name: it.product.name, qty: 0, sum: 0 };
      cur.qty += Number(it.quantity);
      cur.sum += Number(it.price) * Number(it.quantity);
      byProduct.set(it.productId, cur);
    }
    return [...byProduct.values()].sort((a, b) => b.sum - a.sum);
  }

  async occupancy(date?: string) {
    const where: any = { status: 'SCHEDULED' };
    if (date) {
      const day = new Date(date);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      where.startsAt = { gte: day, lt: next };
    }
    const sessions = await this.prisma.session.findMany({
      where,
      include: {
        movie: true,
        hall: { include: { _count: { select: { seats: true } } } },
        _count: { select: { tickets: { where: { returned: false } } } },
      },
    });
    return sessions.map((s) => ({
      sessionId: s.id,
      movie: s.movie.title,
      startsAt: s.startsAt,
      sold: s._count.tickets,
      total: s.hall._count.seats,
      occupancyPct: Math.round((s._count.tickets / s.hall._count.seats) * 100),
    }));
  }

  /** Собирает все секции отчёта за период. */
  private async gather(p: ReportParams) {
    const [revenue, occupancy, top] = await Promise.all([
      this.revenue(p.from, p.to),
      this.occupancy(p.date ?? p.from),
      this.topProducts(p.from, p.to),
    ]);
    return { revenue, occupancy, top };
  }

  // ─── Экспорт в Excel ───
  async excel(p: ReportParams): Promise<Buffer> {
    const { revenue, occupancy, top } = await this.gather(p);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ailin';

    const rev = wb.addWorksheet('Выручка');
    rev.columns = [
      { header: 'Показатель', key: 'k', width: 28 },
      { header: 'Сумма, сом', key: 'v', width: 16 },
    ];
    rev.addRow({ k: 'Билеты', v: revenue.tickets });
    rev.addRow({ k: 'Бар', v: revenue.bar });
    rev.addRow({ k: 'Итого', v: revenue.total });
    rev.addRow({ k: 'Чеков', v: revenue.ordersCount });
    Object.entries(revenue.byPayment).forEach(([k, v]) =>
      rev.addRow({ k: `Оплата: ${k}`, v }),
    );
    rev.getRow(1).font = { bold: true };

    const occ = wb.addWorksheet('Заполняемость');
    occ.columns = [
      { header: 'Сеанс', key: 'm', width: 30 },
      { header: 'Начало', key: 't', width: 18 },
      { header: 'Продано', key: 's', width: 10 },
      { header: 'Всего', key: 'tot', width: 10 },
      { header: '%', key: 'p', width: 8 },
    ];
    occupancy.forEach((o) =>
      occ.addRow({ m: o.movie, t: new Date(o.startsAt).toLocaleString('ru'), s: o.sold, tot: o.total, p: o.occupancyPct }),
    );
    occ.getRow(1).font = { bold: true };

    const tp = wb.addWorksheet('Топ-товары');
    tp.columns = [
      { header: 'Товар', key: 'n', width: 28 },
      { header: 'Кол-во', key: 'q', width: 10 },
      { header: 'Сумма, сом', key: 's', width: 14 },
    ];
    top.forEach((t) => tp.addRow({ n: t.name, q: t.qty, s: t.sum }));
    tp.getRow(1).font = { bold: true };

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // ─── Экспорт в PDF ───
  async pdf(p: ReportParams): Promise<Buffer> {
    const { revenue, occupancy, top } = await this.gather(p);
    const printer = new PdfPrinter(pdfFonts);

    const period = p.from || p.to ? `Период: ${p.from ?? '…'} — ${p.to ?? '…'}` : 'За всё время';

    const docDefinition = {
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      content: [
        { text: 'Кинотеатр · Отчёт', fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
        { text: period, color: '#666', margin: [0, 0, 0, 12] },

        { text: 'Выручка', fontSize: 14, bold: true, margin: [0, 8, 0, 4] },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Показатель', bold: true }, { text: 'Сумма, сом', bold: true }],
              ['Билеты', String(revenue.tickets)],
              ['Бар', String(revenue.bar)],
              [{ text: 'Итого', bold: true }, { text: String(revenue.total), bold: true }],
              ['Чеков', String(revenue.ordersCount)],
              ...Object.entries(revenue.byPayment).map(([k, v]) => [`Оплата: ${k}`, String(v)]),
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: 'Заполняемость зала', fontSize: 14, bold: true, margin: [0, 16, 0, 4] },
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Сеанс', bold: true },
                { text: 'Начало', bold: true },
                { text: 'Продано', bold: true },
                { text: '%', bold: true },
              ],
              ...occupancy.map((o) => [
                o.movie,
                new Date(o.startsAt).toLocaleString('ru'),
                `${o.sold}/${o.total}`,
                `${o.occupancyPct}%`,
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: 'Топ-товары бара', fontSize: 14, bold: true, margin: [0, 16, 0, 4] },
        {
          table: {
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Товар', bold: true },
                { text: 'Кол-во', bold: true },
                { text: 'Сумма, сом', bold: true },
              ],
              ...top.map((t) => [t.name, String(t.qty), String(t.sum)]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
    };

    const doc = printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
