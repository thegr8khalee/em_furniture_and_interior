import express from 'express';
import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

const SITE_URL =
  process.env.FRONTEND_URL || 'https://emfurnitureandinterior.com';

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toIsoDate = (d) => {
  if (!d) return new Date().toISOString();
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const urlEntry = ({ loc, lastmod, changefreq, priority }) => {
  const parts = [`<loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`<lastmod>${toIsoDate(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) parts.push(`<priority>${priority}</priority>`);
  return `  <url>\n    ${parts.join('\n    ')}\n  </url>`;
};

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/projects', changefreq: 'weekly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/faqs', changefreq: 'monthly', priority: '0.6' },
  { path: '/aboutUs', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  { path: '/consultation', changefreq: 'monthly', priority: '0.7' },
  { path: '/showroom', changefreq: 'monthly', priority: '0.6' },
  { path: '/e-catalog', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/styles/modern', changefreq: 'weekly', priority: '0.7' },
  { path: '/styles/contemporary', changefreq: 'weekly', priority: '0.7' },
  { path: '/styles/antique%2Froyal', changefreq: 'weekly', priority: '0.7' },
  { path: '/styles/bespoke', changefreq: 'weekly', priority: '0.7' },
  { path: '/styles/minimalist', changefreq: 'weekly', priority: '0.7' },
  { path: '/styles/glam', changefreq: 'weekly', priority: '0.7' },
];

router.get('/sitemap.xml', async (_req, res) => {
  try {
    // Everything the sitemap lists is in PostgreSQL now, so this is three
    // queries rather than four sources across two databases.
    const db = getSequelize();
    const [sellable, projects, blogPosts] = await Promise.all([
      db.query(`SELECT id, kind, updated_at FROM sellable_items ORDER BY updated_at DESC`, {
        type: QueryTypes.SELECT,
      }),
      db.query(`SELECT id, updated_at FROM projects ORDER BY updated_at DESC`, {
        type: QueryTypes.SELECT,
      }),
      db.query(
        `SELECT slug, updated_at, published_at FROM blog_posts
          WHERE status = 'published' ORDER BY published_at DESC`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    const products = sellable.filter((row) => row.kind === 'product');
    const collections = sellable.filter((row) => row.kind === 'collection');

    const urls = [
      ...STATIC_ROUTES.map((r) =>
        urlEntry({
          loc: `${SITE_URL}${r.path}`,
          changefreq: r.changefreq,
          priority: r.priority,
        })
      ),
      ...products.map((p) =>
        urlEntry({
          loc: `${SITE_URL}/product/${p.id}`,
          lastmod: p.updated_at,
          changefreq: 'weekly',
          priority: '0.8',
        })
      ),
      ...collections.map((c) =>
        urlEntry({
          loc: `${SITE_URL}/collection/${c.id}`,
          lastmod: c.updated_at,
          changefreq: 'weekly',
          priority: '0.8',
        })
      ),
      ...projects.map((p) =>
        urlEntry({
          loc: `${SITE_URL}/project/${p.id}`,
          lastmod: p.updated_at,
          changefreq: 'monthly',
          priority: '0.7',
        })
      ),
      ...blogPosts.map((b) =>
        urlEntry({
          loc: `${SITE_URL}/blog/${b.slug}`,
          lastmod: b.updated_at || b.published_at,
          changefreq: 'monthly',
          priority: '0.7',
        })
      ),
    ];

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.join('\n') +
      '\n</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  } catch (err) {
    logger.error({ err: err }, 'Sitemap generation error');
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/robots.txt', (_req, res) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /profile',
    'Disallow: /wishlist',
    'Disallow: /orders',
    'Disallow: /order-confirmation',
    'Disallow: /payment/verify',
    'Disallow: /notifications',
    'Disallow: /loyalty',
    'Disallow: /track-order',
    'Disallow: /reset-password',
    'Disallow: /signup',
    'Disallow: /compare',
    'Disallow: /api/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(body);
});

export default router;
