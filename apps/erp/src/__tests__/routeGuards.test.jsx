import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@em/domain';
import AdminProtectedRoute from '../components/AdminProtectedRoutes';
import AdminLoginProtectedRoute from '../components/AdminLoginProtectedRoute';

// The console is a separate deployment with no storefront routes, so a guard
// that redirects to "/" bounces off the catch-all and loops. These tests pin
// the destinations that make the console self-contained.

const setAuth = (state) =>
  useAuthStore.setState({
    authUser: null,
    isAdmin: false,
    isCheckingAuth: false,
    permissions: [],
    checkAuth: vi.fn(),
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
    setAuth({ authUser: { _id: 'a1' }, isAdmin: true });

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

  it('sends a signed-in customer to the sign-in screen rather than the console', () => {
    setAuth({ authUser: { _id: 'u1' }, isAdmin: false });

    renderConsole('/admin/dashboard');

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('waits rather than redirecting while the session is still being checked', () => {
    // Redirecting during the check would throw an admin out on every refresh.
    setAuth({ isCheckingAuth: true });

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
    setAuth({ authUser: { _id: 'a1' }, isAdmin: true });

    renderConsole('/admin/login');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('sends a signed-in customer to the storefront origin', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace });
    setAuth({ authUser: { _id: 'u1' }, isAdmin: false });

    renderConsole('/admin/login');

    // A cross-origin move, not a route change — the storefront is a separate
    // deployment, so react-router cannot get there.
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('http'));
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('runs the session check on mount', () => {
    const checkAuth = vi.fn();
    setAuth({ checkAuth });

    renderConsole('/admin/login');

    expect(checkAuth).toHaveBeenCalled();
  });
});
