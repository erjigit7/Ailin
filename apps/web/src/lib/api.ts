import axios from 'axios';

// Относительный адрес: в проде фронт отдаёт сам API (один origin),
// в dev — проксируется Vite на localhost:3000 (см. vite.config.ts).
const apiBase = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({ baseURL: `${apiBase}/api` });

// Токен авторизации добавляется в каждый запрос.
export const TOKEN_KEY = 'ailin_token';
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// 401 → токен невалиден: чистим и отправляем на логин.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/display')) {
        location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Авторизация ───
export interface AuthUser {
  id: string;
  fullName: string;
  role: 'ADMIN' | 'CASHIER';
}
export const login = (loginName: string, password: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login', { login: loginName, password }).then((r) => r.data);
export const getMe = () => api.get<AuthUser>('/auth/me').then((r) => r.data);

// ─── Смены ───
export interface Shift {
  id: string;
  startCash: string;
  openedAt: string;
}
export const getCurrentShift = () =>
  api.get<Shift | null>('/shifts/current').then((r) => r.data);
export const openShift = (startCash: number) =>
  api.post('/shifts/open', { startCash }).then((r) => r.data);
export const closeShift = (endCashFact: number) =>
  api.post('/shifts/close', { endCashFact }).then((r) => r.data);

export interface SessionListItem {
  id: string;
  startsAt: string;
  basePrice: string;
  movie: { id: string; title: string; durationMin: number; format: string };
  hall: { id: string; name: string };
  prices: { categoryId: string; price: string; category: { code: string; name: string } }[];
}

export interface SeatState {
  seatId: string;
  row: number;
  number: number;
  block: 'left' | 'right';
  // SELECTED — место удерживается кассой (выбрано, ещё не оплачено)
  status: 'FREE' | 'SOLD' | 'BOOKED' | 'SELECTED';
}

export interface SeatMap {
  session: { id: string; movieTitle: string; startsAt: string; hallName: string };
  counts: { total: number; free: number; sold: number; booked: number };
  seats: SeatState[];
}

export const getSessions = (date?: string) =>
  api.get<SessionListItem[]>('/sessions', { params: { date } }).then((r) => r.data);

export const getSeatMap = (sessionId: string) =>
  api.get<SeatMap>(`/sessions/${sessionId}/seats`).then((r) => r.data);

export interface SellPayload {
  sessionId: string;
  seats: { seatId: string; categoryId: string }[];
  paymentMethod: 'CASH' | 'CARD' | 'QR';
}

export const sellTickets = (payload: SellPayload) =>
  api.post('/tickets/sell', payload).then((r) => r.data);

// ─── Бар ───
export interface BarProduct {
  id: string;
  name: string;
  salePrice: string;
  stock: string;
  unit: string;
}
export interface BarCategory {
  id: string;
  name: string;
  products: BarProduct[];
}
export const getBarCategories = () =>
  api.get<BarCategory[]>('/bar/categories').then((r) => r.data);

export const barSell = (payload: {
  paymentMethod: 'CASH' | 'CARD' | 'QR';
  items: { productId: string; quantity: number }[];
}) => api.post('/bar/sell', payload).then((r) => r.data);

// ─── Бар: управление (админ) ───
export interface BarProductFull {
  id: string;
  categoryId: string;
  name: string;
  salePrice: string;
  purchasePrice: string;
  stock: string;
  unit: string;
  lowStockThreshold?: string | null;
}
export const createBarProduct = (data: any) => api.post('/bar/products', data).then((r) => r.data);
export const updateBarProduct = (id: string, data: any) =>
  api.put(`/bar/products/${id}`, data).then((r) => r.data);
export const deleteBarProduct = (id: string) =>
  api.delete(`/bar/products/${id}`).then((r) => r.data);
export const createBarCategory = (data: { name: string; sortOrder?: number }) =>
  api.post('/bar/categories', data).then((r) => r.data);
export const barPurchase = (data: { productId: string; quantity: number; unitPrice: number }) =>
  api.post('/bar/purchase', data).then((r) => r.data);
export const barWriteOff = (data: { productId: string; quantity: number; reason: string }) =>
  api.post('/bar/write-off', data).then((r) => r.data);

// ─── Возврат ───
export interface FoundTicket {
  id: string;
  price: string;
  qrCode: string;
  seat: { row: number; number: number };
  category: { name: string };
  session: { startsAt: string; movie: { title: string } };
}
export const findTicket = (params: {
  qr?: string;
  sessionId?: string;
  row?: number;
  number?: number;
}) => api.get<FoundTicket>('/tickets/find', { params }).then((r) => r.data);

export const returnTicket = (payload: { ticketId: string; reason: string }) =>
  api.post('/tickets/return', payload).then((r) => r.data);

// ─── Батут ───
export interface TrampolineTariff {
  id: string;
  name: string;
  price: string;
  durationMin?: number | null;
  sortOrder: number;
}
export const getTrampolineTariffs = () =>
  api.get<TrampolineTariff[]>('/trampoline/tariffs').then((r) => r.data);
export const trampolineSell = (payload: {
  paymentMethod: 'CASH' | 'CARD' | 'QR';
  items: { tariffId: string; quantity: number }[];
}) => api.post('/trampoline/sell', payload).then((r) => r.data);
export const createTrampolineTariff = (data: any) =>
  api.post('/trampoline/tariffs', data).then((r) => r.data);
export const updateTrampolineTariff = (id: string, data: any) =>
  api.put(`/trampoline/tariffs/${id}`, data).then((r) => r.data);
export const deleteTrampolineTariff = (id: string) =>
  api.delete(`/trampoline/tariffs/${id}`).then((r) => r.data);

// ─── Бронирование ───
export interface Booking {
  id: string;
  customerName?: string;
  customerPhone?: string;
  expiresAt: string;
  seat: { row: number; number: number };
}
export const getBookings = (sessionId: string) =>
  api.get<Booking[]>('/bookings', { params: { sessionId } }).then((r) => r.data);
export const createBooking = (payload: {
  sessionId: string;
  seatIds: string[];
  customerName?: string;
  customerPhone?: string;
  holdMinutes?: number;
}) => api.post('/bookings', payload).then((r) => r.data);
export const releaseBooking = (id: string) =>
  api.post(`/bookings/${id}/release`, {}).then((r) => r.data);

// ─── Отчёты ───
export interface ShiftReport {
  ordersCount: number;
  sales: number;
  refunds: number;
  net: number;
}
export const getShiftReport = (shiftId: string) =>
  api.get<ShiftReport>(`/reports/shift/${shiftId}`).then((r) => r.data);

// ─── Админка: фильмы ───
export interface Movie {
  id: string;
  title: string;
  description?: string;
  durationMin: number;
  ageRating?: string;
  genre?: string;
  language?: string;
  format: '2D' | '3D';
}
export const getMovies = () => api.get<Movie[]>('/movies').then((r) => r.data);
export const createMovie = (data: Partial<Movie>) => api.post('/movies', data).then((r) => r.data);
export const updateMovie = (id: string, data: Partial<Movie>) =>
  api.put(`/movies/${id}`, data).then((r) => r.data);
export const deleteMovie = (id: string) => api.delete(`/movies/${id}`).then((r) => r.data);

// ─── Админка: сеансы ───
export interface TicketCategory {
  id: string;
  code: string;
  name: string;
}
export interface Hall {
  id: string;
  name: string;
}
export const getCategories = () =>
  api.get<TicketCategory[]>('/sessions/meta/categories').then((r) => r.data);
export const getHalls = () => api.get<Hall[]>('/sessions/meta/halls').then((r) => r.data);

export const createSession = (data: {
  movieId: string;
  hallId?: string;
  startsAt: string;
  basePrice: number;
  prices?: { categoryId: string; price: number }[];
}) => api.post('/sessions', data).then((r) => r.data);

export const cancelSession = (id: string) =>
  api.post(`/sessions/${id}/cancel`, {}).then((r) => r.data);

export const updateSessionPrices = (id: string, prices: { categoryId: string; price: number }[]) =>
  api.put(`/sessions/${id}/prices`, { prices }).then((r) => r.data);

// ─── Админка: отчёты ───
export interface Revenue {
  tickets: number;
  bar: number;
  trampoline: number;
  total: number;
  byPayment: Record<string, number>;
  ordersCount: number;
}
export interface Occupancy {
  sessionId: string;
  movie: string;
  startsAt: string;
  sold: number;
  total: number;
  occupancyPct: number;
}
export interface TopProduct {
  name: string;
  qty: number;
  sum: number;
}
export const getRevenue = (from?: string, to?: string) =>
  api.get<Revenue>('/reports/revenue', { params: { from, to } }).then((r) => r.data);
export const getOccupancy = (date?: string) =>
  api.get<Occupancy[]>('/reports/occupancy', { params: { date } }).then((r) => r.data);
export const getTopProducts = (from?: string, to?: string) =>
  api.get<TopProduct[]>('/reports/top-products', { params: { from, to } }).then((r) => r.data);

/** Скачивание отчёта в Excel/PDF (через blob, с авторизацией). */
export async function downloadReport(
  format: 'excel' | 'pdf',
  params: { from?: string; to?: string; date?: string },
) {
  const res = await api.get(`/reports/export/${format}`, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'excel' ? 'report.xlsx' : 'report.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
