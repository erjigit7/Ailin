import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  getTrampolineTariffs,
  createTrampolineTariff,
  updateTrampolineTariff,
  deleteTrampolineTariff,
  type TrampolineTariff,
} from '../../lib/api';

const empty = { name: '', price: 0, durationMin: 30, sortOrder: 0 };

export default function TrampolineAdminPage() {
  const qc = useQueryClient();
  const { data: tariffs } = useQuery({ queryKey: ['trampoline-tariffs'], queryFn: getTrampolineTariffs });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['trampoline-tariffs'] });

  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => (editId ? updateTrampolineTariff(editId, form) : createTrampolineTariff(form)),
    onSuccess: () => {
      invalidate();
      setForm(empty);
      setEditId(null);
    },
  });
  const delMut = useMutation({ mutationFn: deleteTrampolineTariff, onSuccess: invalidate });

  function edit(t: TrampolineTariff) {
    setEditId(t.id);
    setForm({
      name: t.name,
      price: Number(t.price),
      durationMin: Number(t.durationMin ?? 0),
      sortOrder: t.sortOrder,
    });
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Батут · тарифы по возрасту</h1>
      <p className="text-sm text-gray-400 mb-4">Можно добавить любое число возрастных категорий, у каждой своя цена.</p>

      <div className="flex gap-6">
        {/* Список тарифов */}
        <div className="flex-1 space-y-2">
          {tariffs?.map((t) => (
            <div key={t.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-gray-400">
                  {Number(t.price)} сом{t.durationMin ? ` · ${t.durationMin} мин` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => edit(t)} className="text-xs px-3 py-1 rounded bg-gray-700">
                  изм.
                </button>
                <button
                  onClick={() => confirm(`Удалить тариф «${t.name}»?`) && delMut.mutate(t.id)}
                  className="text-xs px-3 py-1 rounded bg-red-700"
                >
                  удал.
                </button>
              </div>
            </div>
          ))}
          {tariffs?.length === 0 && <div className="text-sm text-gray-500">Тарифов пока нет</div>}
        </div>

        {/* Форма */}
        <div className="w-80 bg-gray-800 rounded-lg p-5 h-fit">
          <h2 className="font-semibold mb-3">{editId ? 'Редактировать тариф' : 'Новый тариф'}</h2>
          <div className="space-y-2">
            <Field label="Название / возраст (напр. «5–12 лет»)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Цена, сом" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) })} />
            <Field label="Длительность, мин (необязательно)" type="number" value={form.durationMin} onChange={(v) => setForm({ ...form, durationMin: Number(v) })} />
            <Field label="Порядок в списке" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: Number(v) })} />
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!form.name || saveMut.isPending}
            className="mt-4 w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-sm font-semibold"
          >
            {editId ? 'Сохранить' : 'Добавить'}
          </button>
          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setForm(empty);
              }}
              className="mt-2 w-full py-2 rounded border border-gray-600 text-sm text-gray-300"
            >
              Отмена
            </button>
          )}
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
