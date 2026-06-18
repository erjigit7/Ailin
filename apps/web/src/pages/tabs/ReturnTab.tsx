import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { findTicket, returnTicket, getSessions, type FoundTicket } from '../../lib/api';

export default function ReturnTab({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions() });

  const [mode, setMode] = useState<'qr' | 'seat'>('seat');
  const [qr, setQr] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [row, setRow] = useState('');
  const [number, setNumber] = useState('');
  const [reason, setReason] = useState('');
  const [ticket, setTicket] = useState<FoundTicket | null>(null);
  const [msg, setMsg] = useState('');

  async function search() {
    setMsg('');
    setTicket(null);
    try {
      const found =
        mode === 'qr'
          ? await findTicket({ qr })
          : await findTicket({ sessionId: sessionId || sessions?.[0]?.id, row: Number(row), number: Number(number) });
      setTicket(found);
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'Билет не найден');
    }
  }

  async function confirm() {
    if (!ticket || !reason.trim()) return;
    try {
      await returnTicket({ ticketId: ticket.id, reason });
      setMsg(`Билет возвращён, место освобождено. Сумма: ${Number(ticket.price)} ${t('som')}`);
      setTicket(null);
      setReason('');
      setQr('');
      setRow('');
      setNumber('');
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'Ошибка возврата');
    }
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">{t('return')}</h2>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('seat')}
          className={`px-3 py-2 rounded text-sm border ${mode === 'seat' ? 'bg-gray-700 border-gray-500' : 'border-gray-600'}`}
        >
          {t('row')} + {t('seat')}
        </button>
        <button
          onClick={() => setMode('qr')}
          className={`px-3 py-2 rounded text-sm border ${mode === 'qr' ? 'bg-gray-700 border-gray-500' : 'border-gray-600'}`}
        >
          QR
        </button>
      </div>

      {mode === 'qr' ? (
        <input
          value={qr}
          onChange={(e) => setQr(e.target.value)}
          placeholder="QR-код билета"
          className="w-full bg-gray-800 rounded px-4 py-2 mb-3"
        />
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="bg-gray-800 rounded px-3 py-2 col-span-3">
            {sessions?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.movie.title} · {new Date(s.startsAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </option>
            ))}
          </select>
          <input value={row} onChange={(e) => setRow(e.target.value)} placeholder={t('row')} className="bg-gray-800 rounded px-3 py-2" />
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t('seat')} className="bg-gray-800 rounded px-3 py-2" />
        </div>
      )}

      <button onClick={search} className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm font-medium">
        Найти билет
      </button>

      {ticket && (
        <div className="mt-6 bg-gray-800 rounded-lg p-5">
          <div className="text-lg font-semibold">{ticket.session.movie.title}</div>
          <div className="text-sm text-gray-400 mt-1">
            {new Date(ticket.session.startsAt).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
            {t('row')} {ticket.seat.row} · {t('seat')} {ticket.seat.number} · {ticket.category.name}
          </div>
          <div className="text-2xl font-bold mt-2">
            {Number(ticket.price)} {t('som')}
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина возврата"
            className="w-full bg-gray-700 rounded px-3 py-2 mt-4 text-sm"
            rows={2}
          />
          <button
            onClick={confirm}
            disabled={!reason.trim() || disabled}
            className="mt-3 px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-sm font-semibold"
          >
            Подтвердить возврат
          </button>
        </div>
      )}

      {msg && <div className="mt-4 text-sm text-amber-400">{msg}</div>}
    </div>
  );
}
