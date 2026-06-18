import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { TOKEN_KEY, getMe, login as apiLogin, type AuthUser } from './api';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // При загрузке: если есть токен — проверяем его через /auth/me.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function signIn(login: string, password: string) {
    const { token, user } = await apiLogin(login, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    location.href = '/login';
  }

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
