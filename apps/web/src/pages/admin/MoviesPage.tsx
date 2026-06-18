import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getMovies, createMovie, updateMovie, deleteMovie, type Movie } from '../../lib/api';

const empty: Partial<Movie> = { title: '', durationMin: 120, format: '2D', genre: '', ageRating: '', language: 'RU' };

export default function MoviesPage() {
  const qc = useQueryClient();
  const { data: movies } = useQuery({ queryKey: ['movies'], queryFn: getMovies });
  const [form, setForm] = useState<Partial<Movie>>(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['movies'] });
  const saveMut = useMutation({
    mutationFn: () => (editId ? updateMovie(editId, form) : createMovie(form)),
    onSuccess: () => {
      invalidate();
      setForm(empty);
      setEditId(null);
    },
  });
  const delMut = useMutation({ mutationFn: deleteMovie, onSuccess: invalidate });

  function edit(m: Movie) {
    setEditId(m.id);
    setForm(m);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Фильмы</h1>

      <div className="flex gap-6">
        {/* Список */}
        <div className="flex-1 space-y-2">
          {movies?.map((m) => (
            <div key={m.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {m.title} <span className="text-xs text-gray-400">{m.format}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {m.durationMin} мин · {m.genre || '—'} · {m.ageRating || '—'}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => edit(m)} className="text-xs px-3 py-1 rounded bg-gray-700">
                  Изм.
                </button>
                <button
                  onClick={() => confirm(`Удалить «${m.title}»?`) && delMut.mutate(m.id)}
                  className="text-xs px-3 py-1 rounded bg-red-700"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Форма */}
        <div className="w-80 bg-gray-800 rounded-lg p-5 h-fit">
          <h2 className="font-semibold mb-3">{editId ? 'Редактировать' : 'Новый фильм'}</h2>
          <div className="space-y-2">
            <Field label="Название" value={form.title ?? ''} onChange={(v) => setForm({ ...form, title: v })} />
            <Field
              label="Длительность (мин)"
              type="number"
              value={String(form.durationMin ?? '')}
              onChange={(v) => setForm({ ...form, durationMin: Number(v) })}
            />
            <Field label="Жанр" value={form.genre ?? ''} onChange={(v) => setForm({ ...form, genre: v })} />
            <Field label="Возраст" value={form.ageRating ?? ''} onChange={(v) => setForm({ ...form, ageRating: v })} />
            <Field label="Язык" value={form.language ?? ''} onChange={(v) => setForm({ ...form, language: v })} />
            <label className="block text-xs text-gray-400">
              Формат
              <select
                value={form.format ?? '2D'}
                onChange={(e) => setForm({ ...form, format: e.target.value as '2D' | '3D' })}
                className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm text-gray-100"
              >
                <option value="2D">2D</option>
                <option value="3D">3D</option>
              </select>
            </label>
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!form.title || saveMut.isPending}
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
  value: string;
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
