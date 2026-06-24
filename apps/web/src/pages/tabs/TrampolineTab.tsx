import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrampolineTariffs, trampolineSell, type TrampolineTariff } from '../../lib/api';
import { printTrampolineReceipt } from '../../lib/receipt';

interface CartLine {
  tariff: TrampolineTariff;
  qty: number;
}

export default function TrampolineTab({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const { data: tariffs } = useQuery({ queryKey: ['trampoline-tariffs'], queryFn: getTrampolineTariffs });

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [payment, setPayment] = useState<'CASH' | 'CARD' | 'QR'>('CASH');

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = lines.reduce((s, l) => s + Number(l.tariff.price) * l.qty, 0);

  function add(tariff: TrampolineTariff) {
    setCart((prev) => {
      const ex = prev[tariff.id];
      return { ...prev, [tariff.id]: { tariff, qty: (ex?.qty ?? 0) + 1 } };
    });
  }
  function setQty(id: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...prev[id], qty } };
    });
  }

  async function pay() {
    if (lines.length === 0) return;
    try {
      await trampolineSell({
        paymentMethod: payment,
        items: lines.map((l) => ({ tariffId: l.tariff.id, quantity: l.qty })),
      });
      printTrampolineReceipt(
        lines.map((l) => ({ name: l.tariff.name, qty: l.qty, price: Number(l.tariff.price) })),
        total,
      );
      setCart({});
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Ошибка продажи');
    }
  }

  return (
    <div className="flex flex-1 gap-6 px-6 py-4">
      {/* Тарифы по возрасту */}
      <section className="flex-1">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Тарифы батута (по возрасту)</h3>
        <div className="grid grid-cols-3 gap-3">
          {tariffs?.map((tr) => (
            <button
              key={tr.id}
              onClick={() => add(tr)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-left transition"
            >
              <div className="font-medium">{tr.name}</div>
              <div className="text-lg font-bold mt-1">
                {Number(tr.price)} {t('som')}
              </div>
              {tr.durationMin ? <div className="text-xs text-gray-400">{tr.durationMin} мин</div> : null}
            </button>
          ))}
        </div>
      </section>

      {/* Чек */}
      <aside className="w-96 bg-gray-800 rounded-lg p-5 flex flex-col">
        <h2 className="text-lg font-semibold mb-4">{t('order')}</h2>
        <div className="flex-1 space-y-2 overflow-auto">
          {lines.length === 0 && <div className="text-sm text-gray-500">{t('emptyCart')}</div>}
          {lines.map((l) => (
            <div key={l.tariff.id} className="bg-gray-700/50 rounded px-3 py-2 flex justify-between items-center">
              <div className="text-sm flex-1">{l.tariff.name}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(l.tariff.id, l.qty - 1)} className="w-6 h-6 rounded bg-gray-600">
                  −
                </button>
                <span className="w-6 text-center">{l.qty}</span>
                <button onClick={() => setQty(l.tariff.id, l.qty + 1)} className="w-6 h-6 rounded bg-gray-600">
                  +
                </button>
                <span className="w-16 text-right text-sm">{Number(l.tariff.price) * l.qty}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-700 mt-4 pt-4 flex justify-between items-center">
          <span className="text-gray-400">{t('total')}</span>
          <span className="text-3xl font-bold">
            {total} {t('som')}
          </span>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setPayment('CASH')}
            className={`flex-1 py-2 rounded border ${payment === 'CASH' ? 'bg-gray-600 border-gray-500' : 'border-gray-600'}`}
          >
            💵 {t('cash')}
          </button>
          <button
            onClick={() => setPayment('CARD')}
            className={`flex-1 py-2 rounded border ${payment === 'CARD' ? 'bg-gray-600 border-gray-500' : 'border-gray-600'}`}
          >
            💳 {t('card')}
          </button>
        </div>

        <button
          onClick={pay}
          disabled={lines.length === 0 || disabled}
          className="mt-3 py-3 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 font-semibold"
        >
          {t('payAndPrint')}
        </button>
        <button onClick={() => setCart({})} className="mt-2 py-2 rounded border border-gray-600 text-gray-300">
          {t('clearOrder')}
        </button>
      </aside>
    </div>
  );
}
