import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  getBarCategories,
  createBarProduct,
  updateBarProduct,
  deleteBarProduct,
  barPurchase,
  barWriteOff,
  type BarCategory,
} from '../../lib/api';

const emptyProduct = {
  id: '',
  categoryId: '',
  name: '',
  salePrice: 0,
  purchasePrice: 0,
  stock: 0,
  unit: 'шт',
  lowStockThreshold: 0,
};

export default function BarAdminPage() {
  const qc = useQueryClient();
  const { data: categories } = useQuery({ queryKey: ['bar-categories'], queryFn: getBarCategories });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['bar-categories'] });

  const [form, setForm] = useState<any>(emptyProduct);
  const [editId, setEditId] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => (editId ? updateBarProduct(editId, form) : createBarProduct(form)),
    onSuccess: () => {
      invalidate();
      setForm(emptyProduct);
      setEditId(null);
    },
  });
  const delMut = useMutation({ mutationFn: deleteBarProduct, onSuccess: invalidate });
  const purchaseMut = useMutation({ mutationFn: barPurchase, onSuccess: invalidate });
  const writeOffMut = useMutation({ mutationFn: barWriteOff, onSuccess: invalidate });

  function edit(p: any, categoryId: string) {
    setEditId(p.id);
    setForm({
      categoryId,
      name: p.name,
      salePrice: Number(p.salePrice),
      purchasePrice: Number(p.purchasePrice ?? 0),
      stock: Number(p.stock),
      unit: p.unit ?? 'шт',
      lowStockThreshold: Number(p.lowStockThreshold ?? 0),
    });
  }

  function startNew(categoryId: string) {
    setEditId(null);
    setForm({ ...emptyProduct, categoryId });
  }

  function doPurchase(id: string) {
    const qty = Number(prompt('Приход — количество:') || 0);
    if (qty <= 0) return;
    const price = Number(prompt('Цена закупки за единицу:') || 0);
    purchaseMut.mutate({ productId: id, quantity: qty, unitPrice: price });
  }
  function doWriteOff(id: string) {
    const qty = Number(prompt('Списание — количество:') || 0);
    if (qty <= 0) return;
    const reason = prompt('Причина списания:') || 'порча';
    writeOffMut.mutate({ productId: id, quantity: qty, reason });
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Бар · товары и склад</h1>

      <div className="flex gap-6">
        {/* Список по категориям */}
        <div className="flex-1 space-y-6">
          {categories?.map((cat: BarCategory) => (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm uppercase tracking-wider text-gray-400">{cat.name}</h2>
                <button onClick={() => startNew(cat.id)} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">
                  + товар
                </button>
              </div>
              <div className="space-y-2">
                {cat.products.map((p: any) => (
                  <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {Number(p.salePrice)} сом · остаток {Number(p.stock)} {p.unit}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => doPurchase(p.id)} className="text-xs px-2 py-1 rounded bg-green-800" title="Приход">
                        +приход
                      </button>
                      <button onClick={() => doWriteOff(p.id)} className="text-xs px-2 py-1 rounded bg-amber-800" title="Списание">
                        −списать
                      </button>
                      <button onClick={() => edit(p, cat.id)} className="text-xs px-2 py-1 rounded bg-gray-700">
                        изм.
                      </button>
                      <button
                        onClick={() => confirm(`Удалить «${p.name}»?`) && delMut.mutate(p.id)}
                        className="text-xs px-2 py-1 rounded bg-red-700"
                      >
                        удал.
                      </button>
                    </div>
                  </div>
                ))}
                {cat.products.length === 0 && <div className="text-xs text-gray-500">Нет товаров</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Форма товара */}
        <div className="w-80 bg-gray-800 rounded-lg p-5 h-fit">
          <h2 className="font-semibold mb-3">{editId ? 'Редактировать товар' : 'Новый товар'}</h2>
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">
              Категория
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
              >
                <option value="">—</option>
                {categories?.map((c: BarCategory) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Название" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Цена продажи" type="number" value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: Number(v) })} />
            <Field label="Цена закупки" type="number" value={form.purchasePrice} onChange={(v) => setForm({ ...form, purchasePrice: Number(v) })} />
            {!editId && (
              <Field label="Начальный остаток" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: Number(v) })} />
            )}
            <Field label="Ед. изм." value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Field label="Порог низкого остатка" type="number" value={form.lowStockThreshold} onChange={(v) => setForm({ ...form, lowStockThreshold: Number(v) })} />
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!form.name || !form.categoryId || saveMut.isPending}
            className="mt-4 w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-sm font-semibold"
          >
            {editId ? 'Сохранить' : 'Добавить'}
          </button>
          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setForm(emptyProduct);
              }}
              className="mt-2 w-full py-2 rounded border border-gray-600 text-sm text-gray-300"
            >
              Отмена
            </button>
          )}
          <p className="text-[11px] text-gray-500 mt-3">
            Остаток меняется кнопками «приход» / «списать», а не вручную.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs text-gray-400">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm text-gray-100"
      />
    </label>
  );
}
