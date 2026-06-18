import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getSessions, getMovies, createSession, cancelSession } from '../../lib/api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const { data: sessions } = useQuery({ queryKey: ['sessions', date], queryFn: () => getSessions(date) });
  const { data: movies } = useQuery({ queryKey: ['movies'], queryFn: getMovies });

  const [movieId, setMovieId] = useState('');
  const [time, setTime] = useState('19:30');
  const [basePrice, setBasePrice] = useState(250);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sessions'] });
  const createMut = useMutation({
    mutationFn: () =>
      createSession({
        movieId: movieId || movies?.[0]?.id || '',
        startsAt: `${date}T${time}:00`,
        basePrice,
      }),
    onSuccess: invalidate,
  });
  const cancelMut = useMutation({ mutationFn: cancelSession, onSuccess: invalidate });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Расписание</h1>

      <div className="flex gap-6">
        {/* Список сеансов на день */}
        <div className="flex-1">
          <label className="text-sm text-gray-400">
            Дата:{' '}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 rounded px-3 py-1 ml-1 text-sm"
            />
          </label>

          <div className="mt-4 space-y-2">
            {sessions?.length === 0 && <div className="text-gray-500 text-sm">Сеансов нет</div>}
            {sessions?.map((s) => (
              <div key={s.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-lg font-mono mr-3">
                    {new Date(s.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {s.movie.title} <span className="text-xs text-gray-400">{s.movie.format}</span>
                  <span className="text-xs text-gray-400 ml-2">· {s.hall.name} · {Number(s.basePrice)} сом</span>
                </div>
                <button
                  onClick={() => confirm('Отменить сеанс? Проданные билеты будут возвращены.') && cancelMut.mutate(s.id)}
                  className="text-xs px-3 py-1 rounded bg-red-700"
                >
                  Отменить
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Создание сеанса */}
        <div className="w-80 bg-gray-800 rounded-lg p-5 h-fit">
          <h2 className="font-semibold mb-3">Новый сеанс</h2>
          <label className="block text-xs text-gray-400 mb-2">
            Фильм
            <select
              value={movieId}
              onChange={(e) => setMovieId(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            >
              {movies?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-400 mb-2">
            Время
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-400 mb-2">
            Базовая цена
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm"
            />
          </label>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="mt-3 w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-sm font-semibold"
          >
            Создать сеанс
          </button>
          <p className="text-[11px] text-gray-500 mt-2">
            Цены по категориям проставятся по базовой; настроить можно позже.
          </p>
        </div>
      </div>
    </div>
  );
}
