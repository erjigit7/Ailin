import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSessions } from '../lib/api';
import { useSeatRealtime, useDisplaySession } from '../lib/socket';
import HallScheme from '../components/HallScheme';

/**
 * Дисплей для гостей. Режим киоска: только чтение.
 * Сеанс берётся из ?session=<id>, иначе — ближайший идущий в продаже.
 * Никаких афиш/цен/рекламы — только зал и счётчики (по ТЗ).
 */
export default function DisplayPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const forcedSession = params.get('session') ?? undefined;

  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions() });

  // Сеанс, который касса выбрала для показа (через WebSocket).
  const cashierSession = useDisplaySession();

  const session = useMemo(() => {
    if (!sessions?.length) return undefined;
    // Приоритет: ?session= (жёсткая фиксация) → выбор кассы → ближайший сеанс.
    return (
      sessions.find((s) => s.id === forcedSession) ??
      sessions.find((s) => s.id === cashierSession) ??
      sessions[0]
    );
  }, [sessions, forcedSession, cashierSession]);

  const seatsMap = useSeatRealtime(session?.id);
  const seats = useMemo(() => Object.values(seatsMap), [seatsMap]);

  const counts = useMemo(() => {
    const total = seats.length;
    const sold = seats.filter((s) => s.status === 'SOLD').length;
    return { total, sold, free: total - sold };
  }, [seats]);

  return (
    <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl bg-gray-900 rounded-3xl p-10">
        {/* Заголовок + счётчики */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-5xl font-bold">{session?.movie.title ?? '—'}</h1>
            <p className="text-gray-400 mt-2 text-lg">
              {session
                ? `${new Date(session.startsAt).toLocaleDateString('ru')} · ${new Date(session.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} · ${session.hall.name}`
                : ''}
            </p>
          </div>
          <div className="flex gap-10 text-center">
            <Counter value={counts.free} label={t('free')} className="text-green-500" />
            <Counter value={counts.sold} label={t('sold')} className="text-gray-400" />
            <Counter value={counts.total} label={t('total_seats')} className="text-gray-200" />
          </div>
        </div>

        <HallScheme seats={seats} readOnly size={56} />

        {/* Легенда + индикатор реального времени */}
        <div className="flex items-center justify-between mt-10 text-base text-gray-300">
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-seat-free" /> {t('free')}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-seat-sold" /> {t('sold')}
            </span>
          </div>
          <span className="flex items-center gap-2 uppercase tracking-wider text-sm">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" /> {t('realtime')}
          </span>
        </div>
      </div>
    </div>
  );
}

function Counter({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div>
      <div className={`text-6xl font-bold ${className ?? ''}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">{label}</div>
    </div>
  );
}
