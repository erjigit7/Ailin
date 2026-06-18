import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentShift } from '../../lib/shift';

interface ZReport {
  ordersCount: number;
  sales: number;
  cashSales: number;
  cardSales: number;
  refunds: number;
  startCash: number;
  endCashCalc: number;
  endCashFact: number;
  discrepancy: number;
}

export default function ShiftTab() {
  const { t } = useTranslation();
  const { shift, loading, open, close } = useCurrentShift();
  const [startCash, setStartCash] = useState(5000);
  const [endCashFact, setEndCashFact] = useState(0);
  const [zReport, setZReport] = useState<ZReport | null>(null);

  async function doClose() {
    const res: any = await close.mutateAsync(endCashFact);
    setZReport(res.report);
  }

  if (loading) return <div className="px-6 py-6 text-gray-500">…</div>;

  return (
    <div className="px-6 py-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Смена</h2>

      {!shift ? (
        // ─── Открытие смены ───
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-3">Смена закрыта. Откройте смену, чтобы продавать.</div>
          <label className="block text-xs text-gray-400 mb-3">
            Стартовая сумма в кассе
            <input
              type="number"
              value={startCash}
              onChange={(e) => setStartCash(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            />
          </label>
          <button
            onClick={() => open.mutate(startCash)}
            disabled={open.isPending}
            className="w-full py-2 rounded bg-green-600 hover:bg-green-500 font-semibold disabled:opacity-40"
          >
            Открыть смену
          </button>
        </div>
      ) : (
        // ─── Закрытие смены ───
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Смена открыта</span>
            <span>{new Date(shift.openedAt).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-gray-400">Стартовая сумма</span>
            <span>{Number(shift.startCash)} {t('som')}</span>
          </div>

          <label className="block text-xs text-gray-400 mb-3 border-t border-gray-700 pt-4">
            Фактическая сумма в кассе (для контроля расхождений)
            <input
              type="number"
              value={endCashFact}
              onChange={(e) => setEndCashFact(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            />
          </label>
          <button
            onClick={() => confirm('Закрыть смену? Сформируется Z-отчёт.') && doClose()}
            disabled={close.isPending}
            className="w-full py-2 rounded bg-red-600 hover:bg-red-500 font-semibold disabled:opacity-40"
          >
            Закрыть смену (Z-отчёт)
          </button>
        </div>
      )}

      {/* Z-отчёт после закрытия */}
      {zReport && (
        <div className="bg-gray-800 rounded-lg p-6 mt-6 space-y-2">
          <h3 className="font-semibold mb-2">Z-отчёт</h3>
          <Row label="Чеков" value={String(zReport.ordersCount)} />
          <Row label="Продажи всего" value={`${zReport.sales} ${t('som')}`} />
          <Row label="— наличными" value={`${zReport.cashSales} ${t('som')}`} />
          <Row label="— картой" value={`${zReport.cardSales} ${t('som')}`} />
          <Row label="Возвраты" value={`− ${zReport.refunds} ${t('som')}`} />
          <div className="border-t border-gray-700 pt-2 mt-2">
            <Row label="Старт. сумма" value={`${zReport.startCash} ${t('som')}`} />
            <Row label="Расчётная наличность" value={`${zReport.endCashCalc} ${t('som')}`} />
            <Row label="Фактическая" value={`${zReport.endCashFact} ${t('som')}`} />
            <Row
              label="Расхождение"
              value={`${zReport.discrepancy > 0 ? '+' : ''}${zReport.discrepancy} ${t('som')}`}
              highlight={zReport.discrepancy !== 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className={highlight ? 'font-bold text-amber-400' : 'font-medium'}>{value}</span>
    </div>
  );
}
