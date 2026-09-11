import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAdminAuthStore } from '@em/domain';
import AdminProtectedRoute from '../components/AdminProtectedRoutes';
import AdminLoginProtectedRoute from '../components/AdminLoginProtectedRoute';

// The console is a separate deployment with no storefront routes, so a guard
// that redirects to "/" bounces off the catch-all and loops. These tests pin
// the destinations that make the console self-contained.

const setAuth = (state) =>
  useAdminAuthStore.setState({
    adminUser: null,
    isCheckingAdminAuth: false,
    permissions: [],
    checkAdminAuth: vi.fn(),
    ...state,
  });

/** Mirrors the real router: the same catch-all that closes the loop. */
const renderConsole = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AdminLoginProtectedRoute />}>
          <Route path="/admin/login" element={<div>Sign in</div>} />
        </Route>
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin/dashboard" element={<div>Dashboard</div>} />
        </Route>
        <Route path="*" element={<div>Catch-all</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  setAuth({});
});

describe('AdminProtectedRoute', () => {
  it('renders the console for a signed-in admin', () => {
    setAuth({ adminUser: { _id: 'a1', role: 'admin' } });

    renderConsole('/admin/dashboard');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('sends an anonymous visitor to the sign-in screen, not into a redirect loop', () => {
    // Redirecting to "/" would hit the catch-all, which sends back to the
    // dashboard, which redirects again — forever.
    renderConsole('/admin/dashboard');

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.queryByText('Catch-all')).not.toBeInTheDocument();
  });

  it('sends an unauthenticated visitor to the sign-in screen rather than the console', () => {
    setAuth({ adminUser: null });

    renderConsole('/admin/dashboard');

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('waits rather than redirecting while the session is still being checked', () => {
    // Redirecting during the check would throw an admin out on every refresh.
    setAuth({ isCheckingAdminAuth: true });

    renderConsole('/admin/dashboard');

    expect(screen.getByText(/loading authentication/i)).toBeInTheDocument();
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
  });
});

describe('AdminLoginProtectedRoute', () => {
  it('shows the sign-in screen to an anonymous visitor', () => {
    renderConsole('/admin/login');

    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('sends an already-signed-in admin straight to the dashboard', () => {
    setAuth({ adminUser: { _id: 'a1', role: 'admin' } });

    renderConsole('/admin/login');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('runs the session check on mount', () => {
    const checkAdminAuth = vi.fn();
    setAuth({ checkAdminAuth });

    renderConsole('/admin/login');

    expect(checkAdminAuth).toHaveBeenCalled();
  });
});

