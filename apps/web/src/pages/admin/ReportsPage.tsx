import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRevenue, getOccupancy, getTopProducts, downloadReport } from '../../lib/api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  // to-конец дня
  const toEnd = `${to}T23:59:59`;

  const revenue = useQuery({ queryKey: ['revenue', from, to], queryFn: () => getRevenue(from, toEnd) });
  const occupancy = useQuery({ queryKey: ['occupancy', from], queryFn: () => getOccupancy(from) });
  const top = useQuery({ queryKey: ['top', from, to], queryFn: () => getTopProducts(from, toEnd) });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Отчёты</h1>

      <div className="flex items-center gap-3 mb-6 text-sm text-gray-400">
        <label>
          С: <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-gray-800 rounded px-2 py-1 ml-1" />
        </label>
        <label>
          По: <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-gray-800 rounded px-2 py-1 ml-1" />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => downloadReport('excel', { from, to: toEnd, date: from })}
            className="px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium"
          >
            ⤓ Excel
          </button>
          <button
            onClick={() => downloadReport('pdf', { from, to: toEnd, date: from })}
            className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
          >
            ⤓ PDF
          </button>
        </div>
      </div>

      {/* Выручка */}
      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-3">Выручка</h2>
        <div className="grid grid-cols-4 gap-4">
          <Card label="Билеты" value={revenue.data?.tickets} />
          <Card label="Бар" value={revenue.data?.bar} />
          <Card label="Итого" value={revenue.data?.total} accent />
          <Card label="Чеков" value={revenue.data?.ordersCount} plain />
        </div>
        {revenue.data && (
          <div className="mt-3 text-sm text-gray-400">
            По способам оплаты:{' '}
            {Object.entries(revenue.data.byPayment).map(([k, v]) => (
              <span key={k} className="mr-3">
                {k === 'CASH' ? 'Наличные' : k === 'CARD' ? 'Карта' : k}: <b className="text-gray-200">{v}</b>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Заполняемость */}
      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-3">Заполняемость зала (на {from})</h2>
        <div className="space-y-2">
          {occupancy.data?.length === 0 && <div className="text-gray-500 text-sm">Нет сеансов</div>}
          {occupancy.data?.map((o) => (
            <div key={o.sessionId} className="bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1">
                <span>
                  {new Date(o.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} · {o.movie}
                </span>
                <span className="text-gray-400">
                  {o.sold}/{o.total} · {o.occupancyPct}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded">
                <div className="h-2 bg-green-600 rounded" style={{ width: `${o.occupancyPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Топ-товары */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-3">Топ-товары бара</h2>
        <table className="w-full max-w-lg text-sm">
          <thead className="text-gray-400 text-left">
            <tr>
              <th className="py-1">Товар</th>
              <th className="py-1 text-right">Кол-во</th>
              <th className="py-1 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {top.data?.map((p) => (
              <tr key={p.name} className="border-t border-gray-800">
                <td className="py-1">{p.name}</td>
                <td className="py-1 text-right">{p.qty}</td>
                <td className="py-1 text-right">{p.sum} сом</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ label, value, accent, plain }: { label: string; value?: number; accent?: boolean; plain?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 font-bold ${accent ? 'text-3xl text-green-400' : 'text-2xl'}`}>
        {value ?? 0}
        {!plain && <span className="text-sm text-gray-500 ml-1">сом</span>}
      </div>
    </div>
  );
}
