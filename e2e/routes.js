/**
 * Storefront routes that render without authentication, plus the admin login
 * screen. Derived from frontend/src/App.jsx — note that the sign-in form is
 * served at /profile when logged out, and there is no bare /login route.
 *
 * Console routes need an authenticated admin; they are covered separately once
 * the split introduces the ERP app.
 *
 * `name` becomes the snapshot filename, so it must stay stable — renaming one
 * orphans its baseline and then silently passes.
 */
export const PUBLIC_ROUTES = [
  { name: 'home', path: '/' },
  { name: 'shop', path: '/shop' },
  { name: 'styles-modern', path: '/styles/Modern' },
  { name: 'product-detail', path: '/product/660000000000000000000001' },
  { name: 'collection-detail', path: '/collection/661000000000000000000001' },
  { name: 'compare', path: '/compare' },
  { name: 'projects', path: '/projects' },
  { name: 'project-detail', path: '/project/662000000000000000000001' },
  { name: 'blog', path: '/blog' },
  { name: 'blog-post', path: '/blog/fixture-article-1' },
  { name: 'faqs', path: '/faqs' },
  { name: 'about-us', path: '/aboutUs' },
  { name: 'contact', path: '/contact' },
  { name: 'showroom', path: '/showroom' },
  { name: 'consultation', path: '/consultation' },
  { name: 'e-catalog', path: '/e-catalog' },
  { name: 'cart', path: '/cart' },
  { name: 'wishlist', path: '/wishlist' },
  { name: 'checkout', path: '/checkout' },
  { name: 'signin', path: '/profile' },
  { name: 'signup', path: '/signup' },
  { name: 'track-order', path: '/track-order' },
  { name: 'terms', path: '/terms' },
  { name: 'privacy', path: '/privacy' },
  { name: 'not-found', path: '/this-route-does-not-exist' },
];

/**
 * Console routes. The ERP app is a separate deployment, so these are captured
 * against its own preview server (see erp-visual.spec.js). Only the login
 * screen renders without an authenticated admin session; the rest redirect,
 * and covering them needs a seeded session — tracked for a later pass.
 */
export const ERP_ROUTES = [
  { name: 'erp-login', path: '/admin/login' },
];
