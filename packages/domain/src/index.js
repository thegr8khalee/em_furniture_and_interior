// State and API access that both applications need. Stores that only the
// storefront uses — cart, wishlist, compare, loyalty, orders — stay in apps/web
// rather than making this a dumping ground.
export { axiosInstance } from './lib/axios.js';
export { useAuthStore } from './store/useAuthStore.js';
export { useAdminStore } from './store/useAdminStore.js';
export { useProductsStore } from './store/useProductsStore.js';
export { useCollectionStore } from './store/useCollectionStore.js';
export { useProjectsStore } from './store/useProjectsStore.js';
export { useBlogStore } from './store/useBlogStore.js';
export { useFaqStore } from './store/useFaqStore.js';
