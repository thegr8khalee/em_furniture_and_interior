import { describe, it, expect, beforeEach, vi } from 'vitest';
import { axiosInstance, useAdminAuthStore } from '@em/domain';

const initialState = useAdminAuthStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useAdminAuthStore.setState({
    ...initialState,
    adminUser: null,
    permissions: [],
    isAdminReady: false,
    isCheckingAdminAuth: true,
  });
});

describe('useAdminAuthStore', () => {
  describe('hasPermission', () => {
    it('grants a permission the admin holds', () => {
      useAdminAuthStore.setState({ permissions: ['orders.view', 'staff.manage'] });
      expect(useAdminAuthStore.getState().hasPermission('staff.manage')).toBe(true);
    });

    it('denies a permission the admin does not hold', () => {
      useAdminAuthStore.setState({ permissions: ['orders.view'] });
      expect(useAdminAuthStore.getState().hasPermission('staff.manage')).toBe(false);
    });
  });

  describe('checkAdminAuth', () => {
    it('loads the operator session from /admin/check', async () => {
      axiosInstance.get.mockResolvedValueOnce({
        data: { _id: 'op1', role: 'admin', adminRole: 'super_admin', permissions: ['staff.manage'] },
      });

      await useAdminAuthStore.getState().checkAdminAuth();
      const state = useAdminAuthStore.getState();

      expect(state.adminUser).toMatchObject({ _id: 'op1', role: 'admin' });
      expect(state.permissions).toEqual(['staff.manage']);
      expect(state.isCheckingAdminAuth).toBe(false);
      expect(state.isAdminReady).toBe(true);
    });

    it('clears adminUser when check fails', async () => {
      axiosInstance.get.mockRejectedValueOnce(new Error('unauthorized'));

      await useAdminAuthStore.getState().checkAdminAuth();
      const state = useAdminAuthStore.getState();

      expect(state.adminUser).toBeNull();
      expect(state.permissions).toEqual([]);
      expect(state.isCheckingAdminAuth).toBe(false);
      expect(state.isAdminReady).toBe(true);
    });
  });

  describe('adminLogin and adminLogout', () => {
    it('signs in and saves operator details', async () => {
      axiosInstance.post.mockResolvedValueOnce({
        data: { _id: 'op2', username: 'admin1', permissions: ['products.manage'] },
      });

      const ok = await useAdminAuthStore.getState().adminLogin({ email: 'op@test.com', password: 'pass' });
      expect(ok).toBe(true);

      const state = useAdminAuthStore.getState();
      expect(state.adminUser).toMatchObject({ username: 'admin1' });
      expect(state.permissions).toEqual(['products.manage']);
    });

    it('logs out and clears operator details', async () => {
      useAdminAuthStore.setState({ adminUser: { _id: 'op2' }, permissions: ['products.manage'] });
      axiosInstance.post.mockResolvedValueOnce({ data: {} });

      await useAdminAuthStore.getState().adminLogout();
      const state = useAdminAuthStore.getState();

      expect(state.adminUser).toBeNull();
      expect(state.permissions).toEqual([]);
    });
  });
});
