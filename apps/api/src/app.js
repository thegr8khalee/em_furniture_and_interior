// Builds and exports the Express app without starting a server, so tests can
// drive it with Supertest and index.js can own the listen/shutdown lifecycle.
import dotenv from 'dotenv';

// Load env vars before anything else in non-production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { apiLimiter, webhookLimiter } from './middleware/rateLimiter.js';
import { handlePaystackWebhook } from './controllers/payments.controller.js';
import { httpLogger, withRequestContext } from './middleware/requestLogger.js';
import { logger } from './lib/logger.js';

import authRoutes from './routes/auth.routes.js';
import guestRoutes from './routes/guest.routes.js';
import adminRoutes from './routes/admin.routes.js';
import collectionRoutes from './routes/collection.routes.js';
import productRoutes from './routes/product.routes.js';
import reviewRoutes from './routes/review.routes.js';
import cartRoutes from './routes/cart.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import contactRoutes from './routes/contact.routes.js';
import projectRoutes from './routes/project.routes.js';
import blogRoutes from './routes/blog.routes.js';
import faqRoutes from './routes/faq.routes.js';
import adminBlogRoutes from './routes/adminBlog.routes.js';
import adminFaqRoutes from './routes/adminFaq.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import orderRoutes from './routes/order.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import loyaltyRoutes from './routes/loyalty.routes.js';
import consultationRoutes from './routes/consultation.routes.js';
import designerRoutes from './routes/designer.routes.js';
import marketingRoutes from './routes/marketing.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import financeRoutes from './routes/finance.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import logsRoutes from './routes/logs.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import taxRoutes from './routes/tax.routes.js';
import sitemapRoutes from './routes/sitemap.routes.js';
import healthRoutes from './routes/health.routes.js';
import { setupSwagger } from './swagger.js';

const app = express();
// Render (and most PaaS) terminate TLS at a proxy and forward the client IP via
// X-Forwarded-For. express-rate-limit refuses to run unless we opt in.
app.set('trust proxy', 1);

// Structured request logging first, so nothing downstream escapes the record.
// Every log line for a request carries the same requestId, echoed back to the
// caller in the x-request-id header.
app.use(httpLogger);
app.use(withRequestContext);

// Health probes sit outside /api so the API rate limiter never throttles them —
// a limiter that 429s the platform's health check takes the service down.
app.use('/', healthRoutes);

// Security & compression
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://placehold.co"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(compression());
app.use(cookieParser());

// Paystack signs the exact bytes it sends, so the webhook has to see the body
// before anything parses it. Mounted ahead of CORS too — this is a
// server-to-server call, and ahead of the global API limiter, which it replaces
// with a limiter sized for gateway retry bursts.
app.post(
  '/api/payments/paystack/webhook',
  webhookLimiter,
  express.raw({ type: '*/*', limit: '1mb' }),
  handlePaystackWebhook
);

// Body parsing. Routes taking base64 image payloads opt into a higher limit and
// must be registered BEFORE the global parser: the first parser to run claims
// the body, and any later one is a no-op.
const largeBodyParser = express.json({ limit: '50mb' });
const largeUrlencoded = express.urlencoded({ limit: '50mb', extended: true });
app.use('/api/admin', largeBodyParser, largeUrlencoded);
app.use('/api/consultations', largeBodyParser, largeUrlencoded);
app.use('/api/designers', largeBodyParser, largeUrlencoded);
app.use('/api/payments', largeBodyParser, largeUrlencoded);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// CORS. Two browser applications now call this API from their own origins, so
// a single FRONTEND_URL is no longer enough. The allowlist is explicit: an
// unlisted origin is refused rather than reflected back, which is what
// `origin: true` did and what makes credentialed CORS unsafe.
const allowedOrigins = [
  process.env.STOREFRONT_URL,
  process.env.ERP_URL,
  process.env.FRONTEND_URL, // legacy single-app deploys
]
  .filter(Boolean)
  .map((value) => value.replace(/\/$/, ''));

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:5174');
}

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: same-origin navigations, curl, and server-to-server
      // callers such as the payment gateway. CORS does not apply to them.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'Blocked a cross-origin request from an unlisted origin');
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error(
    'No allowed origins configured — set STOREFRONT_URL and ERP_URL, or every browser request will be blocked'
  );
}

// Apply global rate limiter to all API routes
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/guestAuth', guestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/admin/blog', adminBlogRoutes);
app.use('/api/admin/faqs', adminFaqRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/designers', designerRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/taxes', taxRoutes);

// SEO: dynamic sitemap.xml and robots.txt (served at site root, not under /api)
app.use('/', sitemapRoutes);

// Swagger API Docs
setupSwagger(app);

// API 404 handler — must come after all API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// The two frontends are deployed separately (Vercel); this service is API-only.
// Serving a bundled frontend from here also meant local development was
// same-origin while production was not, so cross-origin auth bugs could only
// ever appear in production.
app.all('*', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  (req.log || logger).error({ err }, 'Unhandled error');
  res.status(err.status || 500).json({ message: 'Internal server error' });
});

export default app;
