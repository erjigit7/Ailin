import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  getSessions,
  getMovies,
  getCategories,
  createSession,
  cancelSession,
  updateSessionPrices,
  type SessionListItem,
} from '../../lib/api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const { data: sessions } = useQuery({ queryKey: ['sessions', date], queryFn: () => getSessions(date) });
  const { data: movies } = useQuery({ queryKey: ['movies'], queryFn: getMovies });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  const [movieId, setMovieId] = useState('');
  const [time, setTime] = useState('19:30');
  const [basePrice, setBasePrice] = useState(250);
  // Цена по каждой категории (по умолчанию = базовой)
  const [catPrices, setCatPrices] = useState<Record<string, number>>({});

  // Когда категории загрузились или поменяли базовую — подставляем базовую как дефолт
  useEffect(() => {
    if (categories) {
      setCatPrices((prev) => {
        const next = { ...prev };
        for (const c of categories) if (next[c.id] == null) next[c.id] = basePrice;
        return next;
      });
    }
  }, [categories]); // eslint-disable-line

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sessions'] });
  const createMut = useMutation({
    mutationFn: () =>
      createSession({
        movieId: movieId || movies?.[0]?.id || '',
        startsAt: `${date}T${time}:00`,
        basePrice,
        prices: categories?.map((c) => ({ categoryId: c.id, price: catPrices[c.id] ?? basePrice })),
      }),
    onSuccess: invalidate,
  });
  const cancelMut = useMutation({ mutationFn: cancelSession, onSuccess: invalidate });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Расписание</h1>

      <div className="flex gap-6">
        {/* Список сеансов */}
        <div className="flex-1">
          <label className="text-sm text-gray-400">
            Дата:{' '}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-gray-800 rounded px-3 py-1 ml-1 text-sm" />
          </label>

          <div className="mt-4 space-y-2">
            {sessions?.length === 0 && <div className="text-gray-500 text-sm">Сеансов нет</div>}
            {sessions?.map((s) => (
              <SessionRow key={s.id} session={s} onCancel={() => cancelMut.mutate(s.id)} onSaved={invalidate} />
            ))}
          </div>
        </div>

        {/* Создание сеанса */}
        <div className="w-80 bg-gray-800 rounded-lg p-5 h-fit">
          <h2 className="font-semibold mb-3">Новый сеанс</h2>
          <label className="block text-xs text-gray-400 mb-2">
            Фильм
            <select value={movieId} onChange={(e) => setMovieId(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm">
              {movies?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-400 mb-2">
            Время
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm" />
          </label>
          <label className="block text-xs text-gray-400 mb-2">
            Базовая цена
            <input
              type="number"
              value={basePrice}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBasePrice(v);
              }}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            />
          </label>

          {/* Цены по категориям */}
          <div className="mt-2 mb-2">
            <div className="text-xs text-gray-400 mb-1">Цены по категориям:</div>
            {categories?.map((c) => (
              <div key={c.id} className="flex items-center justify-between mb-1">
                <span className="text-sm">{c.name}</span>
                <input
                  type="number"
                  value={catPrices[c.id] ?? basePrice}
                  onChange={(e) => setCatPrices({ ...catPrices, [c.id]: Number(e.target.value) })}
                  className="w-24 bg-gray-700 rounded px-2 py-1 text-sm text-right"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="mt-2 w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-sm font-semibold"
          >
            Создать сеанс
          </button>
        </div>
      </div>
    </div>
  );
}

/** Строка сеанса с раскрывающимся редактором цен. */
function SessionRow({
  session,
  onCancel,
  onSaved,
}: {
  session: SessionListItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(session.prices.map((p) => [p.categoryId, Number(p.price)])),
  );
  const saveMut = useMutation({
    mutationFn: () =>
      updateSessionPrices(
        session.id,
        Object.entries(prices).map(([categoryId, price]) => ({ categoryId, price })),
      ),
    onSuccess: () => {
      onSaved();
      setOpen(false);
    },
  });

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-mono mr-3">
            {new Date(session.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {session.movie.title} <span className="text-xs text-gray-400">{session.movie.format}</span>
          <span className="text-xs text-gray-400 ml-2">
            · {session.prices.map((p) => `${p.category.name} ${Number(p.price)}`).join(' / ')}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen((o) => !o)} className="text-xs px-3 py-1 rounded bg-gray-700">
            Цены
          </button>
          <button
            onClick={() => confirm('Отменить сеанс? Проданные билеты будут возвращены.') && onCancel()}
            className="text-xs px-3 py-1 rounded bg-red-700"
          >
            Отменить
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          {session.prices.map((p) => (
            <div key={p.categoryId} className="flex items-center justify-between mb-1">
              <span className="text-sm">{p.category.name}</span>
              <input
                type="number"
                value={prices[p.categoryId] ?? 0}
                onChange={(e) => setPrices({ ...prices, [p.categoryId]: Number(e.target.value) })}
                className="w-24 bg-gray-700 rounded px-2 py-1 text-sm text-right"
              />
            </div>
          ))}
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="mt-2 px-4 py-1.5 rounded bg-green-600 hover:bg-green-500 text-sm font-medium"
          >
            Сохранить цены
          </button>
        </div>
      )}
    </div>
  );
}
