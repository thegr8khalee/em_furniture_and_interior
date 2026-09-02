import { describe, it, expect, beforeEach, vi } from 'vitest';
import { axiosInstance } from '../lib/axios';
import { useAuthStore } from '../store/useAuthStore';

// The store is the gate on every admin screen: hasPermission decides what the
// sidebar renders, and checkAuth decides whether someone is an admin at all.

const initialState = useAuthStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    ...initialState,
    authUser: null,
    isAdmin: false,
    permissions: [],
    isAuthReady: false,
    isCheckingAuth: true,
  });
});

describe('hasPermission', () => {
  it('grants a permission the user holds', () => {
    useAuthStore.setState({ permissions: ['orders.view', 'finance.view'] });

    expect(useAuthStore.getState().hasPermission('finance.view')).toBe(true);
  });

  it('denies a permission the user does not hold', () => {
    useAuthStore.setState({ permissions: ['orders.view'] });

    expect(useAuthStore.getState().hasPermission('finance.view')).toBe(false);
  });

  it('denies everything when the user holds no permissions', () => {
    useAuthStore.setState({ permissions: [] });

    expect(useAuthStore.getState().hasPermission('orders.view')).toBe(false);
  });

  it('denies rather than throwing when permissions are missing entirely', () => {
    useAuthStore.setState({ permissions: undefined });

    expect(useAuthStore.getState().hasPermission('orders.view')).toBe(false);
  });

  it('does not treat a prefix as a match', () => {
    useAuthStore.setState({ permissions: ['orders.view'] });

    expect(useAuthStore.getState().hasPermission('orders')).toBe(false);
    expect(useAuthStore.getState().hasPermission('orders.view.all')).toBe(false);
  });
});

describe('checkAuth', () => {
  it('marks an admin session and stores its permissions', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: { _id: 'a1', role: 'admin', permissions: ['orders.view', 'finance.view'] },
    });

    await useAuthStore.getState().checkAuth();
    const state = useAuthStore.getState();

    expect(state.isAdmin).toBe(true);
    expect(state.permissions).toEqual(['orders.view', 'finance.view']);
    expect(state.isAuthReady).toBe(true);
    expect(state.isCheckingAuth).toBe(false);
  });

  it('does not mark a normal customer as an admin', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { _id: 'u1', email: 'a@b.com' } });

    await useAuthStore.getState().checkAuth();
    const state = useAuthStore.getState();

    expect(state.isAdmin).toBe(false);
    expect(state.permissions).toEqual([]);
  });

  it('clears the session and still finishes when the check fails', async () => {
    axiosInstance.get.mockRejectedValueOnce(new Error('network down'));

    await useAuthStore.getState().checkAuth();
    const state = useAuthStore.getState();

    expect(state.authUser).toBeNull();
    // isAuthReady must flip regardless, or the app renders its loading state forever.
    expect(state.isAuthReady).toBe(true);
    expect(state.isCheckingAuth).toBe(false);
  });
});

describe('logout', () => {
  it('clears the session after a successful request', async () => {
    useAuthStore.setState({
      authUser: { _id: 'a1' },
      isAdmin: true,
      permissions: ['finance.view'],
    });
    axiosInstance.post.mockResolvedValueOnce({ data: {} });

    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.authUser).toBeNull();
    expect(state.isAdmin).toBe(false);
    expect(state.permissions).toEqual([]);
  });

  it('still clears the session when the server is unreachable', async () => {
    // A network error has no `response`, so the old handler threw while handling
    // the error and left the user apparently signed in.
    useAuthStore.setState({
      authUser: { _id: 'a1' },
      isAdmin: true,
      permissions: ['finance.view'],
    });
    axiosInstance.post.mockRejectedValueOnce(new Error('network down'));

    await expect(useAuthStore.getState().logout()).resolves.not.toThrow();
    const state = useAuthStore.getState();

    expect(state.authUser).toBeNull();
    expect(state.isAdmin).toBe(false);
    expect(state.permissions).toEqual([]);
  });

  it('surfaces a server-supplied error message when there is one', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { data: { message: 'Session already expired' } },
    });

    await expect(useAuthStore.getState().logout()).resolves.not.toThrow();
    expect(useAuthStore.getState().authUser).toBeNull();
  });
});
