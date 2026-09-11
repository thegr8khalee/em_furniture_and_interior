/**
 * Centralized Cookie Configuration for Cross-Origin & Production Environments
 *
 * When the frontends are served on Vercel (*.vercel.app or custom domains)
 * and the API is hosted on Render (*.onrender.com or custom domains),
 * credentialed requests require SameSite=None and Secure=true in production.
 *
 * If a custom parent domain is configured (e.g. *.emfurniture.ng), setting
 * COOKIE_DOMAIN=.emfurniture.ng allows seamless first-party sharing across
 * the apex storefront, the erp console, and the api.
 */

export const getCookieOptions = (overrides = {}) => {
  const isProd = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/',
    ...overrides,
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

/**
 * Options used when clearing authentication or session cookies.
 * The domain, path, secure, and sameSite properties must match the options
 * used when the cookie was originally set for browsers to discard it.
 */
export const getClearCookieOptions = (overrides = {}) => {
  const options = getCookieOptions(overrides);
  delete options.maxAge;
  delete options.expires;
  return options;
};
