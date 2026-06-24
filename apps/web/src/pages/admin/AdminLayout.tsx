import { NavLink, Outlet } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2 rounded text-sm ${isActive ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`;

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      {/* Боковое меню */}
      <aside className="w-56 bg-black/40 p-4 flex flex-col gap-1">
        <div className="text-lg font-semibold mb-4 px-2">🎬 Админка</div>
        <NavLink to="/admin/schedule" className={linkClass}>
          Расписание
        </NavLink>
        <NavLink to="/admin/movies" className={linkClass}>
          Фильмы
        </NavLink>
        <NavLink to="/admin/bar" className={linkClass}>
          Бар
        </NavLink>
        <NavLink to="/admin/trampoline" className={linkClass}>
          Батут
        </NavLink>
        <NavLink to="/admin/reports" className={linkClass}>
          Отчёты
        </NavLink>
        <div className="mt-auto pt-4 border-t border-gray-700">
          <NavLink to="/" className="block px-4 py-2 rounded text-sm text-gray-400 hover:bg-gray-800">
            ← К кассе
          </NavLink>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
