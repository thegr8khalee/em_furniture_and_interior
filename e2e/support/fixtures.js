/**
 * Canned API responses for visual tests.
 *
 * Screenshots must be byte-stable across runs, so nothing may come from a real
 * database, a clock, or the network. Every id, price and date here is fixed.
 */

const img = (n) => ({ url: `https://res.cloudinary.com/demo/image/upload/fixture-${n}.jpg` });

export const product = (n) => ({
  _id: `6600000000000000000000${String(n).padStart(2, '0')}`,
  name: `Fixture Product ${n}`,
  description: 'A representative catalogue item used for visual regression.',
  items: 'Chair',
  price: 100000 + n * 1000,
  discountedPrice: n % 3 === 0 ? 90000 + n * 1000 : undefined,
  category: ['Living Room', 'Bedroom', 'Dining Room'][n % 3],
  style: ['Modern', 'Antique/Royal', 'Minimalist'][n % 3],
  images: [img(n)],
  averageRating: 4,
  isBestSeller: n % 4 === 0,
  isPromo: n % 5 === 0,
  stockQuantity: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

export const collection = (n) => ({
  _id: `6610000000000000000000${String(n).padStart(2, '0')}`,
  name: `Fixture Collection ${n}`,
  description: 'A curated set used for visual regression.',
  price: 500000 + n * 1000,
  style: 'Modern',
  images: [img(100 + n)],
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const project = (n) => ({
  _id: `6620000000000000000000${String(n).padStart(2, '0')}`,
  title: `Fixture Project ${n}`,
  name: `Fixture Project ${n}`,
  description: 'A portfolio entry used for visual regression.',
  category: 'Residential',
  images: [img(200 + n)],
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const blogPost = (n) => ({
  _id: `6630000000000000000000${String(n).padStart(2, '0')}`,
  title: `Fixture Article ${n}`,
  slug: `fixture-article-${n}`,
  excerpt: 'An article summary held constant for visual regression.',
  content: '<p>Body copy.</p>',
  coverImage: img(300 + n).url,
  author: 'EM Editorial',
  tags: ['inspiration'],
  isPublished: true,
  publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const faq = (n) => ({
  _id: `6640000000000000000000${String(n).padStart(2, '0')}`,
  question: `Fixture question ${n}?`,
  answer: 'A stable answer for visual regression.',
  category: 'General',
  order: n,
  isPublished: true,
});

const list = (fn, count) => Array.from({ length: count }, (_, i) => fn(i + 1));

export const PRODUCTS = list(product, 8);
export const COLLECTIONS = list(collection, 4);
export const PROJECTS = list(project, 4);
export const BLOG_POSTS = list(blogPost, 3);
export const FAQS = list(faq, 4);

/**
 * Matched in order; the first pattern whose regex hits wins. A catch-all at the
 * end keeps an unstubbed endpoint from reaching the network and making the
 * screenshot depend on a live server.
 */
export const ROUTES = [
  // Shapes below match what each Zustand store actually reads. They were taken
  // from the stores, not guessed — several differ from the obvious guess
  // (products/count returns totalProducts, /blog returns items, a product
  // detail returns the document itself rather than a wrapper).
  [/\/api\/auth\/check/, { status: 401, body: { message: 'Unauthorized' } }],

  [/\/api\/products\/count/, { body: { totalProducts: PRODUCTS.length } }],
  [/\/api\/collections\/count/, { body: { totalCollections: COLLECTIONS.length } }],
  [/\/api\/projects\/count/, { body: { count: PROJECTS.length } }],

  [/\/api\/products\/by-ids/, { body: { products: PRODUCTS.slice(0, 2) } }],
  [/\/api\/products\/[0-9a-f]{24}/, { body: PRODUCTS[0] }],
  [/\/api\/products/, { body: { products: PRODUCTS, hasMore: false, totalProducts: PRODUCTS.length, totalPages: 1, currentPage: 1 } }],

  [/\/api\/collections\/[0-9a-f]{24}/, { body: COLLECTIONS[0] }],
  [/\/api\/collections/, { body: { collections: COLLECTIONS, hasMore: false, totalCollections: COLLECTIONS.length, totalPages: 1, currentPage: 1 } }],

  [/\/api\/projects\/get\//, { body: PROJECTS[0] }],
  [/\/api\/projects/, { body: { data: PROJECTS, pagination: { page: 1, limit: 12, total: PROJECTS.length, totalPages: 1 } } }],

  [/\/api\/blog\/[\w-]+$/, { body: BLOG_POSTS[0] }],
  [/\/api\/blog/, { body: { items: BLOG_POSTS, total: BLOG_POSTS.length, page: 1, limit: 10 } }],

  [/\/api\/faqs/, { body: FAQS }],

  [/\/api\/marketing\/banners\/active/, { body: { banners: [] } }],
  [/\/api\/marketing\/flash-sales\/active/, { body: { flashSales: [] } }],

  [/\/api\/cart\/check-existence/, { body: { existingProductIds: [], existingCollectionIds: [] } }],
  [/\/api\/cart/, { body: { cart: [] } }],
  [/\/api\/wishlist\/check-existence/, { body: { existingProductIds: [], existingCollectionIds: [] } }],
  [/\/api\/wishlist/, { body: { wishlist: [] } }],

  [/\/api\/notifications/, { body: { notifications: [], unreadCount: 0, totalPages: 1 } }],
  [/\/api\/loyalty/, { body: { points: 0, history: [], totalPages: 1 } }],
  [/\/api\/review/, { body: { reviews: [] } }],
  [/\/api\/guestAuth/, { body: { success: true } }],

  [/\/api\//, { body: {} }], // catch-all: nothing reaches the network
];
