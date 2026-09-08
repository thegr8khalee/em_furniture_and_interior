// src/seed/seed.js
import { QueryTypes } from 'sequelize';
import { faker } from '@faker-js/faker';
import { getSequelize, closeSequelize } from '../db/sequelize.js';
import { toMinor } from '../lib/money.js';
import { registerCustomer, registerStaff } from '../services/identity.js';
import { createCollection, createProduct } from '../services/catalogAdmin.js';
import { createCoupon } from '../services/coupons.js';
import { placeOrder, setOrderStatus, setPaymentStatus } from '../services/orders.js';
import { adjustStock } from '../services/inventory.js';
import { createFaq, createPost, createProject } from '../services/content.js';
import { createDesigner } from '../services/interiors.js';
import { createBanner, createFlashSale } from '../services/marketing.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

// --- Configuration ---
const NUM_USERS = 20;
const NUM_PROJECTS = 15;
const NUM_COLLECTIONS = 30;
const NUM_PRODUCTS = 100;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

// --- Constants ---
const categories = [
  "Living Room", "Armchair", "Bedroom", "Dining Room",
  "Center Table", "Wardrobe", "TV Unit", "Carpet", "Sofa", "Office"
];

const styles = [
  "Modern", "Contemporary", "Antique/Royal", "Bespoke", "Minimalist", "Glam", "Industrial", "Scandinavian"
];

const projectCategories = [
  "Residential", "Commercial", "Office", "Hospitality", "Outdoor"
];

// Helpers
const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** An already-hosted image, so seeding does not push a hundred files to Cloudinary. */
const seedImage = () => ({
    url: faker.image.urlLoremFlickr({ category: 'furniture' }),
    public_id: faker.string.uuid(),
});

// --- Generators ---

// Accounts are in PostgreSQL; `registerCustomer` hashes the password, so the
// seeder no longer does it by hand with a different cost factor than the API.
const generateUser = () => ({
    fullName: faker.internet.userName(),
    email: faker.internet.email(),
    password: 'Password123!',
    phoneNumber: faker.phone.number(),
});

const generateProject = () => {
    const numImages = getRandomInt(2, 5);
    const images = Array.from({ length: numImages }, () => ({
        url: faker.image.urlLoremFlickr({ category: 'interior' }),
        public_id: faker.string.uuid()
    }));

    return {
        title: faker.company.catchPhrase(),
        description: faker.lorem.paragraphs(2),
        images: images,
        category: faker.helpers.arrayElement(projectCategories),
        location: `${faker.location.city()}, ${faker.location.country()}`,
        price: parseFloat(faker.commerce.price({ min: 100000, max: 5000000, dec: 0 })),
    };
};

// The catalog is in PostgreSQL, and these go in through the same service the
// console writes with — so seeding exercises the real validation rather than a
// second, more forgiving path into the same tables.
const generateCollection = (index) => {
    const isPromo = faker.datatype.boolean(0.2);
    const isForeign = faker.datatype.boolean(0.3);
    const price = parseFloat(faker.commerce.price({ min: 50000, max: 1000000, dec: 0 }));

    return {
        name: `${faker.commerce.productAdjective()} ${faker.commerce.productMaterial()} Collection ${index + 1}`,
        description: faker.lorem.paragraph(),
        price,
        style: faker.helpers.arrayElement(styles),
        isBestSeller: faker.datatype.boolean(0.1),
        isPromo,
        discountedPrice: isPromo ? Math.floor(price * 0.85) : undefined,
        isForeign,
        origin: isForeign ? faker.location.country() : undefined,
        // A collection takes a single `coverImage`, where a product takes an
        // `images` array. Passing the wrong one is silently ignored, which is
        // how thirty collections ended up with no picture.
        coverImage: seedImage(),
    };
};

const generateProduct = (collections = []) => {
    const isPromo = faker.datatype.boolean(0.2);
    const isForeign = faker.datatype.boolean(0.3);
    const price = parseFloat(faker.commerce.price({ min: 10000, max: 500000, dec: 0 }));

    // Half of them belong to a collection; a product may be in at most one, by
    // unique index, so the seeder does not have to remember not to double up.
    const collection = faker.datatype.boolean() && collections.length > 0
        ? faker.helpers.arrayElement(collections)
        : null;

    // A cost between 45% and 70% of the selling price. Without one, the posting
    // rule skips the stock movement rather than inventing a margin, and the
    // seeded books show revenue with no cost of sales — a 100% gross margin,
    // which is not a demonstration of anything.
    const costPrice = Math.floor(price * faker.number.float({ min: 0.45, max: 0.7 }));

    return {
        name: `${faker.commerce.productName()} ${faker.string.alphanumeric(4).toUpperCase()}`,
        description: faker.commerce.productDescription(),
        items: `${faker.number.int({ min: 1, max: 5 })} items`,
        price,
        costPrice,
        category: faker.helpers.arrayElement(categories),
        style: faker.helpers.arrayElement(styles),
        collectionId: collection ? collection._id : undefined,
        images: Array.from({ length: getRandomInt(1, 4) }, seedImage),
        isBestSeller: faker.datatype.boolean(0.1),
        isPromo,
        discountedPrice: isPromo ? Math.floor(price * 0.85) : undefined,
        isForeign,
        origin: isForeign ? faker.location.country() : undefined,
        leadTimeDays: getRandomInt(3, 14),
        shippingMinDays: getRandomInt(2, 5),
        shippingMaxDays: getRandomInt(7, 21),
    };
};

const seedDB = async () => {
  try {
    // --- Cleanup ---
    //
    // TRUNCATE rather than DELETE: the ledger is append-only, and
    // `reject_ledger_history_change` refuses a DELETE on a posted entry — which
    // is the whole point of it. That guard is a row trigger, so a table-level
    // truncate is the one operation that resets it. This resets a development
    // database; it should never be pointed at books anybody relies on.
    //
    // The list is the complete set of tables the seeder writes, plus every table
    // that references one — so no CASCADE is needed, and nothing is wiped that
    // was not named. CASCADE was tried and is wrong here: it reaches
    // `accounting_periods` through `closed_by`, and the accounting calendar
    // comes from a migration, not from this script.
    //
    // `staff` and `customers` are deleted rather than truncated for the same
    // reason: truncating them would require listing `accounting_periods` too.
    console.log('Cleaning up database...');
    const sql = getSequelize();
    await sql.query(`
      TRUNCATE
        journal_lines, journal_entries,
        stock_movements, stock_reservations, product_stock,
        activity_logs, audit_logs,
        notifications, loyalty_transactions,
        payment_transactions, order_items, order_status_events, orders,
        reviews,
        cart_items, carts, wishlist_items,
        flash_sale_items, flash_sales, promo_banners,
        collection_products, sellable_images, products, collections, sellable_items,
        coupons,
        consultation_room_photos, consultation_requests, designers,
        project_images, projects,
        blog_posts, faqs,
        purchase_order_items, purchase_orders, expenses, vendors,
        guest_sessions, counters
      RESTART IDENTITY
    `);
    await sql.query('DELETE FROM staff');
    await sql.query('DELETE FROM customers');

    // The seeded orders post to the ledger, and a posting outside an open
    // period is refused by the database. Checking here turns "no accounting
    // period covers 2026-09-05", raised from deep inside order confirmation,
    // into something a reader can act on.
    const [today] = await sql.query(
      `SELECT count(*)::int AS open FROM accounting_periods
        WHERE CURRENT_DATE BETWEEN starts_on AND ends_on AND status = 'open'`,
      { type: QueryTypes.SELECT }
    );

    if (today.open === 0) {
      throw new Error(
        'No open accounting period covers today, so no order can be confirmed. ' +
          'Run `npm run migrate` against a fresh database, or open a period ' +
          '(see src/db/migrations/0010_accounting_calendar.sql).'
      );
    }
    console.log('Database cleared.');

    // --- 1. Admins ---
    console.log('Seeding admins...');
    const adminSeeds = [
      { username: 'Super Admin', email: 'superadmin@emfurniture.local', role: 'super_admin' },
      { username: 'Admin Manager', email: 'admin.manager@emfurniture.local', role: 'admin' },
      { username: 'Content Editor', email: 'editor@emfurniture.local', role: 'editor' },
      { username: 'Support Agent', email: 'support@emfurniture.local', role: 'support' },
      { username: 'Social Media', email: 'social@emfurniture.local', role: 'social_media_manager' },
    ];

    const createdAdmins = [];
    for (const seed of adminSeeds) {
        createdAdmins.push(
            await registerStaff({ ...seed, password: SEED_ADMIN_PASSWORD })
        );
    }

    // --- 2. Users ---
    console.log(`Seeding ${NUM_USERS} users...`);
    const createdUsers = [];
    for (let i = 0; i < NUM_USERS; i += 1) {
        createdUsers.push(await registerCustomer(generateUser()));
    }
    console.log('Users created.');

    // --- 3. Projects ---
    console.log(`Seeding ${NUM_PROJECTS} projects...`);
    for (let i = 0; i < NUM_PROJECTS; i += 1) {
        await createProject(generateProject());
    }
    console.log('Projects created.');

    // --- 4. Collections ---
    console.log(`Seeding ${NUM_COLLECTIONS} collections...`);
    const createdCollections = [];
    for (let i = 0; i < NUM_COLLECTIONS; i += 1) {
        createdCollections.push(await createCollection(generateCollection(i)));
    }
    console.log('Collections created.');

    // --- 5. Products ---
    console.log(`Seeding ${NUM_PRODUCTS} products...`);
    const createdProducts = [];
    for (let i = 0; i < NUM_PRODUCTS; i += 1) {
        createdProducts.push(await createProduct(generateProduct(createdCollections)));
    }
    console.log('Products created and linked.');

    const { postEntry } = await import('../services/ledger.js');

    // --- 5b. The buying side ---
    console.log('Seeding vendors, expenses and a purchase order...');
    const { createVendor, createExpense, approveExpense, payExpense,
            createPurchaseOrder, receivePurchaseOrder, payPurchaseOrder } =
      await import('../services/purchasing.js');

    const vendors = [];
    for (const name of ['Lagos Timber Co', 'Ikeja Fabrics', 'Apapa Freight']) {
        vendors.push(await createVendor({
            name,
            email: faker.internet.email().toLowerCase(),
            phone: `080${faker.string.numeric(8)}`,
        }));
    }

    // One of each state, so every branch of the screen has a row: a draft, one
    // approved and still owed, and one paid.
    const owner = createdAdmins[0]._id;
    const costs = [
        { accountCode: '5600', description: 'Workshop rent', netAmount: 450000, tax: 33750 },
        { accountCode: '5500', description: 'Workshop wages', netAmount: 720000, tax: 0 },
        { accountCode: '5700', description: 'Instagram campaign', netAmount: 120000, tax: 9000 },
        { accountCode: '5200', description: 'Delivery van fuel', netAmount: 85000, tax: 6375 },
    ];

    for (const [index, cost] of costs.entries()) {
        const expense = await createExpense({
            vendorId: vendors[index % vendors.length]._id,
            accountCode: cost.accountCode,
            description: cost.description,
            date: new Date().toISOString().slice(0, 10),
            netAmount: cost.netAmount,
            taxAmount: cost.tax,
        }, owner);

        if (index === 0) continue;                       // left as a draft
        await approveExpense(expense._id, owner);
        if (index > 2) continue;                         // approved, still owed
        await payExpense(expense._id, { paymentMethod: 'bank_transfer' });
    }

    // A purchase order, received: stock in, and money owed for it.
    const ordered = createdProducts.slice(0, 3);
    if (ordered.length > 0) {
        const purchaseOrder = await createPurchaseOrder({
            vendorId: vendors[0]._id,
            expectedOn: null,
            items: ordered.map((product) => ({
                product: product._id,
                quantity: getRandomInt(2, 10),
                unitCost: Math.floor(product.price * 0.5),
            })),
        }, owner);

        await receivePurchaseOrder(purchaseOrder._id, { staffId: owner });
    }
    console.log('Purchasing seeded.');

    // --- 6. Blog Posts ---
    console.log('Seeding blog posts...');
    const blogPosts = [
      {
        title: 'Choosing the Right Sofa for Your Living Room',
        excerpt: 'A quick guide to sizing, fabrics, and layout so your living room feels balanced.',
        content: 'Start with room measurements, then decide on a layout that supports traffic flow.\n\nNext, choose a fabric that matches your lifestyle: performance textiles for high-traffic homes, velvet for luxe spaces, or leather for durability.\n\nFinally, anchor the seating with a rug that is at least as wide as the sofa to keep the room cohesive.',
        tags: ['Living Room', 'Sofa', 'Tips'],
        status: 'published',
        publishedAt: new Date(),
        author: createdAdmins.find(a => a.adminRole === 'admin')?._id || createdAdmins[0]._id
      },
      {
        title: '5 Ways to Refresh Your Bedroom in a Weekend',
        excerpt: 'Simple updates that make your bedroom feel new without a full renovation.',
        content: 'Swap in crisp bedding, update lighting, and add layered textures with throws and pillows.\n\nConsider a new headboard or statement art piece for instant impact.\n\nFinish with a warm, soft rug to create a cozy retreat.',
        tags: ['Bedroom', 'Refresh', 'Weekend'],
        status: 'published',
        publishedAt: new Date(Date.now() - 86400000 * 2),
        author: createdAdmins.find(a => a.adminRole === 'editor')?._id || createdAdmins[0]._id
      },
      {
        title: 'How We Source Materials for Lasting Quality',
        excerpt: 'A behind-the-scenes look at how we select wood, fabric, and hardware.',
        content: 'We partner with trusted suppliers who meet our quality and sustainability standards.\n\nEvery material is vetted for durability, finish consistency, and long-term performance.\n\nThe result is furniture you can enjoy for years.',
        tags: ['Craftsmanship', 'Materials'],
        status: 'published',
        publishedAt: new Date(Date.now() - 86400000 * 5),
        author: createdAdmins.find(a => a.adminRole === 'editor')?._id || createdAdmins[0]._id
      },
      {
         title: 'The Modern Minimalist Guide',
         excerpt: 'Less is more. Discover how to declutter and design a minimalist home.',
         content: 'Minimalism is about focusing on what matters. Remove unnecessary items from your space and focus on functional, beautiful pieces.',
         tags: ['Minimalist', 'Design', 'Guide'],
         status: 'published',
         publishedAt: new Date(Date.now() - 86400000 * 10),
         author: createdAdmins.find(a => a.adminRole === 'admin')?._id || createdAdmins[0]._id
      }
    ];

    // Slugs are the service's business, not the seeder's.
    for (const post of blogPosts) {
      const { author, ...rest } = post;
      await createPost(
        { ...rest, coverImage: { url: faker.image.urlLoremFlickr({ category: 'interior' }) } },
        author
      );
    }
    console.log('Blog posts seeded.');

    // --- 7. FAQs ---
    console.log('Seeding FAQs...');
    const faqs = [
      { question: 'Do you offer custom furniture?', answer: 'Yes. Share your requirements and we can design a custom piece to fit your space.', order: 1, isActive: true },
      { question: 'How long does delivery take?', answer: 'Delivery timelines depend on product availability and location. We will confirm dates at checkout.', order: 2, isActive: true },
      { question: 'Can I schedule a consultation?', answer: 'Yes. Use our consultation page to book a session with our design team.', order: 3, isActive: true },
      { question: 'What is your return policy?', answer: 'Returns are accepted for eligible items within the return window. Terms apply.', order: 4, isActive: true },
      { question: 'Do you deliver outside Lagos?', answer: 'We deliver nationwide. Shipping fees vary by location.', order: 5, isActive: true },
    ];
    for (const faq of faqs) {
      await createFaq(faq);
    }
    console.log('FAQs seeded.');

    // --- 8. Designers ---
    console.log('Seeding designers...');
    const designers = [
      { name: 'Adaeze Okafor', title: 'Lead Interior Designer', bio: 'Over 10 years of experience transforming residential spaces across Nigeria.', isActive: true },
      { name: 'Emeka Nwosu', title: 'Senior Furniture Designer', bio: 'Specialises in modern African-inspired furniture design and bespoke pieces.', isActive: true },
      { name: 'Fatima Bello', title: 'Space Planner', bio: 'Expert in optimising commercial and residential layouts for maximum functionality.', isActive: true },
      { name: 'Chidi Eze', title: 'Creative Director', bio: 'Brings a unique blend of contemporary and traditional Nigerian aesthetics.', isActive: true },
      { name: 'Ngozi Amadi', title: 'Junior Designer', bio: 'Passionate about sustainable design and eco-friendly materials.', isActive: true },
    ];
    for (const designer of designers) {
      await createDesigner({
        ...designer,
        avatar: { url: faker.image.avatar(), public_id: faker.string.uuid() },
      });
    }
    console.log('Designers seeded.');

    // --- 9. Coupons ---
    console.log('Seeding coupons...');
    const coupons = [
      { code: 'WELCOME10', description: 'Welcome discount for new customers', discountType: 'percentage', discountValue: 10, minimumPurchase: 50000, validUntil: new Date(Date.now() + 90 * 86400000) },
      { code: 'SAVE5000', description: '₦5,000 off orders over ₦100,000', discountType: 'fixed', discountValue: 5000, minimumPurchase: 100000, validUntil: new Date(Date.now() + 60 * 86400000) },
      { code: 'VIP20', description: 'VIP 20% discount — max ₦50,000 off', discountType: 'percentage', discountValue: 20, minimumPurchase: 200000, maximumDiscount: 50000, validUntil: new Date(Date.now() + 30 * 86400000) },
    ];
    for (const coupon of coupons) {
        await createCoupon(coupon);
    }
    console.log('Coupons seeded.');

    // --- 10. Promo Banners ---
    console.log('Seeding promo banners...');
    const banners = [
      { title: 'New Arrivals', subtitle: 'Explore our latest furniture collection', imageUrl: faker.image.urlLoremFlickr({ category: 'furniture' }), linkUrl: '/shop', position: 'home', priority: 1, isActive: true },
      { title: 'Free Delivery in Lagos', subtitle: 'On orders above ₦150,000', imageUrl: faker.image.urlLoremFlickr({ category: 'furniture' }), linkUrl: '/shop', position: 'home', priority: 2, isActive: true },
      { title: 'Shop by Style', subtitle: 'Find your perfect aesthetic', imageUrl: faker.image.urlLoremFlickr({ category: 'interior' }), linkUrl: '/shop', position: 'shop', priority: 1, isActive: true },
      { title: 'Design Consultation', subtitle: 'Book a free session with our experts', imageUrl: faker.image.urlLoremFlickr({ category: 'interior' }), linkUrl: '/consultation', position: 'home', priority: 3, isActive: true },
    ];
    for (const banner of banners) {
      await createBanner(banner);
    }
    console.log('Promo banners seeded.');

    // --- 11. Flash Sales ---
    console.log('Seeding flash sales...');
    const sampleProducts = createdProducts.slice(0, 10).map(p => p._id);
    const sampleCollections = createdCollections.slice(0, 3).map(c => c._id);
    const flashSales = [
      { name: 'Weekend Blitz', description: '15% off select sofas and armchairs', discountType: 'percentage', discountValue: 15, productIds: sampleProducts.slice(0, 5), isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 3 * 86400000) },
      { name: 'Collection Clearance', description: '₦10,000 off featured collections', discountType: 'fixed', discountValue: 10000, collectionIds: sampleCollections, isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 7 * 86400000) },
    ];
    for (const sale of flashSales) {
      await createFlashSale(sale);
    }
    console.log('Flash sales seeded.');

    // Opening stock arrives the way stock actually arrives: on a purchase order
    // from a supplier, received. It used to be seeded with `adjustment`
    // movements, and a positive adjustment credits 5400 Stock write-offs — so
    // stocking the shop for the first time booked ₦54m of *negative* expense
    // and the seeded profit and loss was nonsense. A receipt debits inventory
    // and credits the supplier, which is what happened.
    console.log('Seeding stock...');
    const stocking = createdProducts.slice(0, 20);

    if (stocking.length > 0) {
      const openingOrder = await createPurchaseOrder({
        vendorId: vendors[1]._id,
        items: stocking.map((product) => ({
          product: product._id,
          quantity: getRandomInt(5, 50),
          unitCost: Math.floor(product.price * 0.5),
        })),
      }, owner);

      // The owner puts money in before paying for the stock, and puts in enough:
      // sized to the order with a quarter again for working capital. A fixed
      // figure left the current account overdrawn whenever the randomly priced
      // opening order came in above it — the first number on the first screen,
      // in red, for no reason anyone could act on.
      //
      // This is the one entry a seeded set of books legitimately posts by hand.
      const capital = Math.ceil(toMinor(openingOrder.total) * 1.25);
      await postEntry(getSequelize(), {
        date: new Date().toISOString().slice(0, 10),
        description: 'Opening capital introduced',
        source: 'manual',
        lines: [
          { account: '1120', debit: capital, description: 'Paid into the current account' },
          { account: '3100', credit: capital, description: 'Owner capital' },
        ],
      });

      await receivePurchaseOrder(openingOrder._id, { staffId: owner });
      await payPurchaseOrder(openingOrder._id, { paymentMethod: 'bank_transfer' });
    }

    // One genuine correction, so the adjustment path and its note are exercised.
    if (stocking.length > 0) {
      await adjustStock(
        stocking[0]._id,
        { delta: -2, reason: 'Damaged in the workshop' },
        owner
      );
    }
    console.log('Stock seeded.');

    // --- 12. Orders ---
    //
    // Placed through the ordering service rather than inserted, so every seeded
    // order is priced, numbered and posted the way a real one is — and the
    // ledger has something in it when the console is first opened.
    console.log('Seeding orders...');
    const journey = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

    for (let i = 0; i < 10; i += 1) {
      const customer = faker.helpers.arrayElement(createdUsers);
      const items = Array.from({ length: getRandomInt(1, 3) }, () => ({
        item: faker.helpers.arrayElement(createdProducts)._id,
        quantity: getRandomInt(1, 2),
      }));

      const { order } = await placeOrder(
        { customerId: customer._id, guestSessionId: null },
        {
          items,
          shippingAddress: {
            fullName: customer.username,
            phone: customer.phoneNumber || '08012345678',
            email: customer.email,
            address: faker.location.streetAddress(),
            city: faker.helpers.arrayElement(['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan']),
            state: faker.helpers.arrayElement(['Lagos', 'FCT', 'Rivers', 'Oyo']),
          },
          shippingCost: getRandomInt(0, 5000),
          paymentMethod: faker.helpers.arrayElement(['paystack', 'bank_transfer', 'whatsapp']),
        }
      );

      // Walk it forward one stage at a time, so the status history and the
      // postings look like something that actually happened.
      const stopAt = journey[Math.min(i, journey.length - 1)];
      for (const status of journey.slice(1, journey.indexOf(stopAt) + 1)) {
        await setOrderStatus(order._id, { status }, createdAdmins[0]._id);
      }
      if (stopAt === 'shipped' || stopAt === 'delivered') {
        await setPaymentStatus(order._id, 'paid', createdAdmins[0]._id);
      }
    }
    console.log('Orders seeded.');

    // --- 13. Stock ---
    //
    // A receipt per product rather than a separate adjustments collection: the
    // count is derived from these rows, so this is both the stock and the reason
    // for it.
    console.log('Database seeding complete! 🚀');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await closeSequelize();
  }
};

seedDB();
