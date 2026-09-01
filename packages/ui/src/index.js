/**
 * Shared presentation layer for the storefront and the ERP console.
 *
 * Extraction, not a rewrite: every component moved from
 * apps/storefront/src verbatim. The animation primitives and their easing
 * curves come along because the UI components import them — leaving them behind
 * would have the package reach back into one app, which is the boundary being
 * removed.
 */
export * from './components/index.js';
export * from './animations/index.js';
export * from './lib/animations.js';
