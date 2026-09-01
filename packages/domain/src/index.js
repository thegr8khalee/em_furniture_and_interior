/**
 * Domain state and authorisation shared by both applications.
 *
 * Only what genuinely serves both lives here: auth and admin session, the
 * catalog and content stores that the console edits and the storefront reads,
 * and the permission constants that gate console navigation. Cart, wishlist,
 * compare, loyalty and checkout stores stay in the storefront — the console has
 * no use for them and moving them would make this a dumping ground.
 */
export { useAuthStore } from './store/useAuthStore.js';
export { useAdminStore } from './store/useAdminStore.js';
export { useProductsStore } from './store/useProductsStore.js';
export { useCollectionStore } from './store/useCollectionStore.js';
export { useBlogStore } from './store/useBlogStore.js';
export { useFaqStore } from './store/useFaqStore.js';
export { useProjectsStore } from './store/useProjectsStore.js';
export * from './lib/permissions.js';
