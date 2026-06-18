import QRCode from 'qrcode';

const CINEMA_NAME = 'Кинотеатр';

export interface TicketReceipt {
  movie: string;
  sessionAt: string; // ISO дата/время сеанса
  hall: string;
  row: number;
  number: number;
  category: string;
  price: number;
  qr: string; // строка QR-кода билета
}

export interface BarReceiptItem {
  name: string;
  qty: number;
  price: number;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' });
}

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 80mm; font-family: 'Courier New', monospace; color: #000; }
  .r { width: 80mm; padding: 4mm 3mm; }
  .center { text-align: center; }
  .big { font-size: 14px; font-weight: bold; }
  .sm { font-size: 11px; }
  .md { font-size: 12px; }
  .row { display: flex; justify-content: space-between; font-size: 12px; margin: 1px 0; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .qr { display: block; margin: 6px auto 2px; }
  .cut { page-break-after: always; }
  @page { size: 80mm auto; margin: 0; }
  @media print { body { width: 80mm; } }
`;

function ticketHtml(t: TicketReceipt, qrImg: string) {
  return `
  <div class="r">
    <div class="center big">${CINEMA_NAME}</div>
    <div class="center sm">БИЛЕТ</div>
    <hr/>
    <div class="md" style="font-weight:bold">${t.movie}</div>
    <div class="row"><span>Сеанс</span><span>${fmtDateTime(t.sessionAt)}</span></div>
    <div class="row"><span>Зал</span><span>${t.hall}</span></div>
    <div class="row"><span>Ряд / Место</span><span>${t.row} / ${t.number}</span></div>
    <div class="row"><span>Категория</span><span>${t.category}</span></div>
    <div class="row" style="font-weight:bold"><span>Цена</span><span>${t.price} сом</span></div>
    <hr/>
    <img class="qr" src="${qrImg}" width="150" height="150" />
    <div class="center sm">${t.qr}</div>
    <div class="center sm">${fmtDateTime(new Date().toISOString())}</div>
    <div class="center sm">Спасибо за покупку!</div>
  </div>`;
}

function barHtml(items: BarReceiptItem[], total: number) {
  return `
  <div class="r">
    <div class="center big">${CINEMA_NAME}</div>
    <div class="center sm">БАР · ЧЕК</div>
    <hr/>
    ${items
      .map(
        (i) =>
          `<div class="row"><span>${i.name} x${i.qty}</span><span>${i.price * i.qty} сом</span></div>`,
      )
      .join('')}
    <hr/>
    <div class="row big"><span>ИТОГО</span><span>${total} сом</span></div>
    <div class="center sm">${fmtDateTime(new Date().toISOString())}</div>
    <div class="center sm">Спасибо за покупку!</div>
  </div>`;
}

/** Открывает окно печати с заданным HTML тела чека(ов). */
function printHtml(inner: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Чек</title><style>${STYLES}</style></head><body>${inner}<script>window.onload=function(){setTimeout(function(){window.print();},100);};window.onafterprint=function(){window.close();};</script></body></html>`;
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) {
    alert('Разрешите всплывающие окна для печати чека');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Печать билетов: по одному чеку с QR на каждое место. */
export async function printTicketReceipts(tickets: TicketReceipt[]) {
  if (tickets.length === 0) return;
  const parts = await Promise.all(
    tickets.map(async (t, i) => {
      const qrImg = await QRCode.toDataURL(t.qr, { margin: 1, width: 150 });
      const sep = i < tickets.length - 1 ? '<div class="cut"></div>' : '';
      return ticketHtml(t, qrImg) + sep;
    }),
  );
  printHtml(parts.join(''));
}

/** Печать чека бара. */
export function printBarReceipt(items: BarReceiptItem[], total: number) {
  printHtml(barHtml(items, total));
}
