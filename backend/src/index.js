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
import path from 'path';
import { connectDB } from './lib/db.js';
import { apiLimiter } from './middleware/rateLimiter.js';

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
import { setupSwagger } from './swagger.js';

const app = express();
// Render (and most PaaS) terminate TLS at a proxy and forward the client IP via
// X-Forwarded-For. express-rate-limit refuses to run unless we opt in.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

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

// Body parsing — 1mb default, image-upload routes opt in to higher limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// CORS Configuration
if (process.env.NODE_ENV === 'production') {
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'https://emfurniture.com',
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    })
  );
} else {
  app.use(cors({ origin: true, credentials: true, exposedHeaders: ['Content-Disposition'] }));
}

// Higher body limit for image-upload routes (base64 payloads)
const largeBodyParser = express.json({ limit: '50mb' });
const largeUrlencoded = express.urlencoded({ limit: '50mb', extended: true });
app.use('/api/admin', largeBodyParser, largeUrlencoded);
app.use('/api/consultations', largeBodyParser, largeUrlencoded);
app.use('/api/designers', largeBodyParser, largeUrlencoded);
app.use('/api/payments', largeBodyParser, largeUrlencoded);

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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: 'Internal server error' });
});

// Start server — connect DB first, then listen
const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log('Server running on port:', PORT);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
