import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './index.css';
import { AuthProvider } from './lib/auth';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CashierPage from './pages/CashierPage';
import DisplayPage from './pages/DisplayPage';
import AdminLayout from './pages/admin/AdminLayout';
import MoviesPage from './pages/admin/MoviesPage';
import SchedulePage from './pages/admin/SchedulePage';
import ReportsPage from './pages/admin/ReportsPage';
import BarAdminPage from './pages/admin/BarAdminPage';
import TrampolineAdminPage from './pages/admin/TrampolineAdminPage';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Дисплей для гостей — публичный (киоск, без входа) */}
            <Route path="/display" element={<DisplayPage />} />

            {/* Рабочее место кассира — требует входа */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <CashierPage />
                </ProtectedRoute>
              }
            />

            {/* Панель администратора — только роль ADMIN */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="ADMIN">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SchedulePage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="movies" element={<MoviesPage />} />
              <Route path="bar" element={<BarAdminPage />} />
              <Route path="trampoline" element={<TrampolineAdminPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
