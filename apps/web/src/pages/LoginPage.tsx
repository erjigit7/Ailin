import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(login, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
      <form onSubmit={submit} className="bg-gray-800 rounded-2xl p-8 w-80">
        <div className="text-2xl font-semibold mb-1 text-center">🎬 Кинотеатр</div>
        <div className="text-sm text-gray-400 mb-6 text-center">Вход в систему</div>

        <label className="block text-xs text-gray-400 mb-3">
          Логин
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
            className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm text-gray-100"
          />
        </label>
        <label className="block text-xs text-gray-400 mb-4">
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 rounded px-3 py-2 mt-1 text-sm text-gray-100"
          />
        </label>

        {error && <div className="text-sm text-red-400 mb-3">{error}</div>}

        <button
          type="submit"
          disabled={busy || !login || !password}
          className="w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 font-semibold"
        >
          Войти
        </button>

        <div className="text-[11px] text-gray-500 mt-4 text-center">
          Демо: admin / admin · kassir / cashier
        </div>
      </form>
    </div>
  );
}
