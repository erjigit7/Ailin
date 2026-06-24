import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { useCurrentShift } from '../lib/shift';
import TicketsTab from './tabs/TicketsTab';
import BarTab from './tabs/BarTab';
import ReturnTab from './tabs/ReturnTab';
import ShiftTab from './tabs/ShiftTab';
import BookingTab from './tabs/BookingTab';
import TrampolineTab from './tabs/TrampolineTab';

type Tab = 'tickets' | 'bar' | 'trampoline' | 'booking' | 'return' | 'shift';

export default function CashierPage() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { shift } = useCurrentShift();
  const [tab, setTab] = useState<Tab>('tickets');

  // Выбранный сеанс в «Билеты» сохраняется при переключении вкладок и перезагрузке.
  const [ticketSessionId, setTicketSessionId] = useState<string | undefined>(
    () => localStorage.getItem('ailin_ticket_session') ?? undefined,
  );
  const changeTicketSession = (id: string) => {
    setTicketSessionId(id);
    localStorage.setItem('ailin_ticket_session', id);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tickets', label: t('tickets') },
    { key: 'bar', label: t('bar') },
    { key: 'trampoline', label: t('trampoline') },
    { key: 'booking', label: t('booking') },
    { key: 'return', label: t('return') },
    { key: 'shift', label: t('shiftReport') },
  ];

  const noShift = !shift;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Шапка */}
      <header className="flex items-center justify-between px-6 py-3 bg-black/40">
        <div className="flex items-center gap-2 text-lg font-semibold">🎬 Кинотеатр · Касса</div>
        <div className="flex items-center gap-4">
          <button
            className="text-xs px-2 py-1 rounded bg-gray-700"
            onClick={() => i18n.changeLanguage(i18n.language === 'ru' ? 'ky' : 'ru')}
          >
            {i18n.language === 'ru' ? 'RU' : 'KY'}
          </button>
          <span className="text-sm text-gray-300">{user?.fullName}</span>
          <span className={`text-xs px-2 py-1 rounded ${shift ? 'bg-green-700' : 'bg-gray-600'}`}>
            {shift ? t('shiftOpen') : 'Смена закрыта'}
          </span>
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">
              Админка
            </Link>
          )}
          <button onClick={signOut} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">
            Выйти
          </button>
        </div>
      </header>

      {/* Вкладки */}
      <nav className="flex gap-6 px-6 py-3 border-b border-gray-700 text-sm">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={
              tab === tb.key ? 'text-red-400 border-b-2 border-red-500 pb-1' : 'text-gray-400 hover:text-gray-200'
            }
          >
            {tb.label}
          </button>
        ))}
      </nav>

      {/* Баннер «смена не открыта» для торговых вкладок (бронь и отчёт — без смены) */}
      {noShift && tab !== 'shift' && tab !== 'booking' && (
        <div className="mx-6 mt-4 px-4 py-3 rounded bg-amber-900/40 border border-amber-700 text-amber-300 text-sm">
          Смена не открыта — продажа недоступна. Откройте смену во вкладке «{t('shiftReport')}».
        </div>
      )}

      {/* Содержимое вкладки */}
      {tab === 'tickets' && (
        <TicketsTab disabled={noShift} sessionId={ticketSessionId} onSessionChange={changeTicketSession} />
      )}
      {tab === 'bar' && <BarTab disabled={noShift} />}
      {tab === 'trampoline' && <TrampolineTab disabled={noShift} />}
      {tab === 'return' && <ReturnTab disabled={noShift} />}
      {tab === 'shift' && <ShiftTab />}
      {tab === 'booking' && <BookingTab />}
    </div>
  );
}
