import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBarCategories, barSell, type BarProduct } from '../../lib/api';
import { printBarReceipt } from '../../lib/receipt';

interface CartLine {
  product: BarProduct;
  qty: number;
}

export default function BarTab({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({ queryKey: ['bar-categories'], queryFn: getBarCategories });

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [payment, setPayment] = useState<'CASH' | 'CARD' | 'QR'>('CASH');

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = lines.reduce((s, l) => s + Number(l.product.salePrice) * l.qty, 0);

  function add(product: BarProduct) {
    setCart((prev) => {
      const ex = prev[product.id];
      return { ...prev, [product.id]: { product, qty: (ex?.qty ?? 0) + 1 } };
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
      await barSell({
        paymentMethod: payment,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      });
      // Чек бара
      const receiptItems = lines.map((l) => ({
        name: l.product.name,
        qty: l.qty,
        price: Number(l.product.salePrice),
      }));
      printBarReceipt(receiptItems, total);
      setCart({});
      queryClient.invalidateQueries({ queryKey: ['bar-categories'] }); // обновить остатки
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Ошибка продажи');
    }
  }

  return (
    <div className="flex flex-1 gap-6 px-6 py-4">
      {/* Каталог */}
      <section className="flex-1 overflow-auto">
        {categories?.map((cat) => (
          <div key={cat.id} className="mb-6">
            <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">{cat.name}</h3>
            <div className="grid grid-cols-3 gap-3">
              {cat.products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  className="bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left transition"
                >
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Number(p.salePrice)} {t('som')} · {t('inStock')}: {Number(p.stock)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Чек */}
      <aside className="w-96 bg-gray-800 rounded-lg p-5 flex flex-col">
        <h2 className="text-lg font-semibold mb-4">{t('order')}</h2>
        <div className="flex-1 space-y-2 overflow-auto">
          {lines.length === 0 && <div className="text-sm text-gray-500">{t('emptyCart')}</div>}
          {lines.map((l) => (
            <div key={l.product.id} className="bg-gray-700/50 rounded px-3 py-2 flex justify-between items-center">
              <div className="text-sm flex-1">{l.product.name}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(l.product.id, l.qty - 1)} className="w-6 h-6 rounded bg-gray-600">
                  −
                </button>
                <span className="w-6 text-center">{l.qty}</span>
                <button onClick={() => setQty(l.product.id, l.qty + 1)} className="w-6 h-6 rounded bg-gray-600">
                  +
                </button>
                <span className="w-16 text-right text-sm">{Number(l.product.salePrice) * l.qty}</span>
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
