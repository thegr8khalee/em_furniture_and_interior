import { vi } from 'vitest';

// The API client and the toaster are the two boundaries these stores talk to.
// Mocking them here means every test drives real store logic against fakes,
// rather than mocking the store itself.
vi.mock('../src/lib/axios.js', () => ({
  axiosInstance: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), custom: vi.fn() },
}));
