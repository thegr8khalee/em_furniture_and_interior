// src/seed/seed.js
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import Product from '../models/product.model.js';
import Collection from '../models/collection.model.js';
import Admin from '../models/admin.model.js';
import BlogPost from '../models/blogPost.model.js';
import FAQ from '../models/faq.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import GuestSession from '../models/guest.model.js';
import Designer from '../models/designer.model.js';
import Coupon from '../models/coupon.model.js';
import PromoBanner from '../models/promoBanner.model.js';
import FlashSale from '../models/flashSale.model.js';
import Order from '../models/order.model.js';
import InventoryAdjustment from '../models/inventoryAdjustment.model.js';
import { connectDB } from '../lib/db.js';
import { resolvePermissions } from '../lib/permissions.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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

// --- Generators ---

const generateUser = async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    return {
        username: faker.internet.userName(),
        email: faker.internet.email(),
        passwordHash,
        phoneNumber: faker.phone.number(),
        wishlist: [], 
        cart: []
    };
};

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

const generateCollection = (index) => {
    const isPromo = faker.datatype.boolean(0.2); // 20% chance
    const isForeign = faker.datatype.boolean(0.3);
    const price = parseFloat(faker.commerce.price({ min: 50000, max: 1000000, dec: 0 }));
    const discountedPrice = isPromo ? Math.floor(price * 0.85) : undefined;
    
    const name = `${faker.commerce.productAdjective()} ${faker.commerce.productMaterial()} Collection ${index + 1}`;

    return {
        name: name,
        description: faker.lorem.paragraph(),
        price: price,
        style: faker.helpers.arrayElement(styles),
        productIds: [], 
        isBestSeller: faker.datatype.boolean(0.1),
        isPromo: isPromo,
        discountedPrice: discountedPrice,
        isForeign: isForeign,
        origin: isForeign ? faker.location.country() : undefined,
        coverImage: {
             url: faker.image.urlLoremFlickr({ category: 'furniture' }), 
             public_id: faker.string.uuid() 
        },
        reviews: [],
        averageRating: 0
    };
};

const generateProduct = (collections = []) => {
    const isPromo = faker.datatype.boolean(0.2);
    const isForeign = faker.datatype.boolean(0.3);
    const price = parseFloat(faker.commerce.price({ min: 10000, max: 500000, dec: 0 }));
    const discountedPrice = isPromo ? Math.floor(price * 0.85) : undefined;

    // 50% chance to belong to a collection
    const collection = faker.datatype.boolean() && collections.length > 0 
        ? faker.helpers.arrayElement(collections) 
        : null;

    const numImages = getRandomInt(1, 4);
    const images = Array.from({ length: numImages }, () => ({
        url: faker.image.urlLoremFlickr({ category: 'furniture' })
    }));
    
    return {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        items: `${faker.number.int({ min: 1, max: 5 })} items`,
        price: price,
        category: faker.helpers.arrayElement(categories),
        style: faker.helpers.arrayElement(styles),
        collectionId: collection ? collection._id : undefined,
        images: images,
        isBestSeller: faker.datatype.boolean(0.1),
        isPromo: isPromo,
        discountedPrice: discountedPrice,
        isForeign: isForeign,
        origin: isForeign ? faker.location.country() : undefined,
        leadTimeDays: getRandomInt(3, 14),
        shippingMinDays: getRandomInt(2, 5),
        shippingMaxDays: getRandomInt(7, 21),
        reviews: [],
        averageRating: 0,
    };
};

const generateReviews = (users) => {
    const numReviews = getRandomInt(0, 5);
    const reviews = [];
    for (let i = 0; i < numReviews; i++) {
        reviews.push({
            userId: faker.helpers.arrayElement(users)._id,
            rating: faker.number.int({ min: 3, max: 5 }), // Bias towards good ratings
            comment: faker.lorem.sentence(),
            createdAt: faker.date.past()
        });
    }
    return reviews;
};


const seedDB = async () => {
  try {
    await connectDB();
    console.log('Connected to DB via Mongoose.');

    // --- Cleanup ---
    console.log('Cleaning up database...');
    await Promise.all([
        Product.deleteMany({}),
        Collection.deleteMany({}),
        Admin.deleteMany({}),
        BlogPost.deleteMany({}),
        FAQ.deleteMany({}),
        Project.deleteMany({}),
        User.deleteMany({}),
        GuestSession.deleteMany({}),
        Designer.deleteMany({}),
        Coupon.deleteMany({}),
        PromoBanner.deleteMany({}),
        FlashSale.deleteMany({}),
        Order.deleteMany({}),
        InventoryAdjustment.deleteMany({}),
    ]);
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
        const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
        const admin = await Admin.create({
            username: seed.username,
            email: seed.email,
            passwordHash,
            role: seed.role,
            permissions: resolvePermissions(seed.role),
        });
        createdAdmins.push(admin);
    }

    // --- 2. Users ---
    console.log(`Seeding ${NUM_USERS} users...`);
    const userPromises = Array.from({ length: NUM_USERS }, () => generateUser());
    const userData = await Promise.all(userPromises);
    const createdUsers = await User.insertMany(userData);
    console.log('Users created.');

    // --- 3. Projects ---
    console.log(`Seeding ${NUM_PROJECTS} projects...`);
    const projectData = Array.from({ length: NUM_PROJECTS }, () => generateProject());
    await Project.insertMany(projectData);
    console.log('Projects created.');

    // --- 4. Collections ---
    console.log(`Seeding ${NUM_COLLECTIONS} collections...`);
    const collectionData = Array.from({ length: NUM_COLLECTIONS }, (_, i) => generateCollection(i));
    const createdCollections = await Collection.insertMany(collectionData);
    
    // Add reviews to collections
    for (const col of createdCollections) {
        col.reviews = generateReviews(createdUsers);
        if(col.reviews.length > 0) {
            const totalRating = col.reviews.reduce((acc, r) => acc + r.rating, 0);
            col.averageRating = parseFloat((totalRating / col.reviews.length).toFixed(1));
        }
        await col.save();
    }
    console.log('Collections created and reviewed.');

    // --- 5. Products ---
    console.log(`Seeding ${NUM_PRODUCTS} products...`);
    const productData = Array.from({ length: NUM_PRODUCTS }, () => generateProduct(createdCollections));
    const createdProducts = await Product.insertMany(productData);

    // Add reviews to products & update collection linkage
    for (const prod of createdProducts) {
        // Reviews
        prod.reviews = generateReviews(createdUsers);
        if(prod.reviews.length > 0) {
            const totalRating = prod.reviews.reduce((acc, r) => acc + r.rating, 0);
            prod.averageRating = parseFloat((totalRating / prod.reviews.length).toFixed(1));
        }
        await prod.save();

        // Update Collection Product IDs
        if (prod.collectionId) {
            await Collection.findByIdAndUpdate(prod.collectionId, {
                $addToSet: { productIds: prod._id }
            });
        }
    }
    console.log('Products created, reviewed, and linked.');


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
        author: createdAdmins.find(a => a.role === 'admin')?._id || createdAdmins[0]._id
      },
      {
        title: '5 Ways to Refresh Your Bedroom in a Weekend',
        excerpt: 'Simple updates that make your bedroom feel new without a full renovation.',
        content: 'Swap in crisp bedding, update lighting, and add layered textures with throws and pillows.\n\nConsider a new headboard or statement art piece for instant impact.\n\nFinish with a warm, soft rug to create a cozy retreat.',
        tags: ['Bedroom', 'Refresh', 'Weekend'],
        status: 'published',
        publishedAt: new Date(Date.now() - 86400000 * 2),
        author: createdAdmins.find(a => a.role === 'editor')?._id || createdAdmins[0]._id
      },
      {
        title: 'How We Source Materials for Lasting Quality',
        excerpt: 'A behind-the-scenes look at how we select wood, fabric, and hardware.',
        content: 'We partner with trusted suppliers who meet our quality and sustainability standards.\n\nEvery material is vetted for durability, finish consistency, and long-term performance.\n\nThe result is furniture you can enjoy for years.',
        tags: ['Craftsmanship', 'Materials'],
        status: 'published',
        publishedAt: new Date(Date.now() - 86400000 * 5),
        author: createdAdmins.find(a => a.role === 'editor')?._id || createdAdmins[0]._id
      },
      {
         title: 'The Modern Minimalist Guide',
         excerpt: 'Less is more. Discover how to declutter and design a minimalist home.',
         content: 'Minimalism is about focusing on what matters. Remove unnecessary items from your space and focus on functional, beautiful pieces.',
         tags: ['Minimalist', 'Design', 'Guide'],
         status: 'published',
         publishedAt: new Date(Date.now() - 86400000 * 10),
         author: createdAdmins.find(a => a.role === 'admin')?._id || createdAdmins[0]._id
      }
    ];

    const blogPostsWithSlugs = blogPosts.map((post) => ({
      ...post,
      slug: slugify(post.title),
      coverImage: { url: faker.image.urlLoremFlickr({ category: 'interior' }) }
    }));

    await BlogPost.insertMany(blogPostsWithSlugs);
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
    await FAQ.insertMany(faqs);
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
    await Designer.insertMany(designers.map(d => ({
      ...d,
      avatar: { url: faker.image.avatar(), public_id: faker.string.uuid() }
    })));
    console.log('Designers seeded.');

    // --- 9. Coupons ---
    console.log('Seeding coupons...');
    const coupons = [
      { code: 'WELCOME10', description: 'Welcome discount for new customers', discountType: 'percentage', discountValue: 10, minimumPurchase: 50000, validUntil: new Date(Date.now() + 90 * 86400000), isActive: true },
      { code: 'SAVE5000', description: '₦5,000 off orders over ₦100,000', discountType: 'fixed', discountValue: 5000, minimumPurchase: 100000, validUntil: new Date(Date.now() + 60 * 86400000), isActive: true },
      { code: 'VIP20', description: 'VIP 20% discount — max ₦50,000 off', discountType: 'percentage', discountValue: 20, minimumPurchase: 200000, maximumDiscount: 50000, validUntil: new Date(Date.now() + 30 * 86400000), isActive: true },
    ];
    await Coupon.insertMany(coupons);
    console.log('Coupons seeded.');

    // --- 10. Promo Banners ---
    console.log('Seeding promo banners...');
    const banners = [
      { title: 'New Arrivals', subtitle: 'Explore our latest furniture collection', imageUrl: faker.image.urlLoremFlickr({ category: 'furniture' }), linkUrl: '/shop', position: 'home', priority: 1, isActive: true },
      { title: 'Free Delivery in Lagos', subtitle: 'On orders above ₦150,000', imageUrl: faker.image.urlLoremFlickr({ category: 'furniture' }), linkUrl: '/shop', position: 'home', priority: 2, isActive: true },
      { title: 'Shop by Style', subtitle: 'Find your perfect aesthetic', imageUrl: faker.image.urlLoremFlickr({ category: 'interior' }), linkUrl: '/shop', position: 'shop', priority: 1, isActive: true },
      { title: 'Design Consultation', subtitle: 'Book a free session with our experts', imageUrl: faker.image.urlLoremFlickr({ category: 'interior' }), linkUrl: '/consultation', position: 'home', priority: 3, isActive: true },
    ];
    await PromoBanner.insertMany(banners);
    console.log('Promo banners seeded.');

    // --- 11. Flash Sales ---
    console.log('Seeding flash sales...');
    const sampleProducts = createdProducts.slice(0, 10).map(p => p._id);
    const sampleCollections = createdCollections.slice(0, 3).map(c => c._id);
    const flashSales = [
      { name: 'Weekend Blitz', description: '15% off select sofas and armchairs', discountType: 'percentage', discountValue: 15, productIds: sampleProducts.slice(0, 5), isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 3 * 86400000) },
      { name: 'Collection Clearance', description: '₦10,000 off featured collections', discountType: 'fixed', discountValue: 10000, collectionIds: sampleCollections, isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 7 * 86400000) },
    ];
    await FlashSale.insertMany(flashSales);
    console.log('Flash sales seeded.');

    // --- 12. Orders ---
    console.log('Seeding orders...');
    const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const paymentStatuses = ['pending', 'paid'];
    const paymentMethods = ['paystack', 'flutterwave', 'bank_transfer', 'whatsapp'];

    const orders = [];
    for (let i = 0; i < 10; i++) {
      const user = faker.helpers.arrayElement(createdUsers);
      const numItems = getRandomInt(1, 3);
      const items = [];
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const prod = faker.helpers.arrayElement(createdProducts);
        const qty = getRandomInt(1, 2);
        const price = prod.discountedPrice || prod.price || 50000;
        const itemSub = price * qty;
        subtotal += itemSub;
        items.push({
          item: prod._id,
          itemType: 'Product',
          name: prod.name,
          imageUrl: prod.images?.[0]?.url || '',
          price,
          quantity: qty,
          subtotal: itemSub,
        });
      }

      const shipping = getRandomInt(0, 5000);
      const tax = Math.round(subtotal * 0.075);
      const total = subtotal + shipping + tax;
      const status = statuses[Math.min(i, statuses.length - 1)];

      orders.push({
        orderNumber: `ORD-SEED-${String(i + 1).padStart(3, '0')}`,
        user: user._id,
        items,
        shippingAddress: {
          fullName: user.username,
          phone: user.phoneNumber || '08012345678',
          email: user.email,
          address: faker.location.streetAddress(),
          city: faker.helpers.arrayElement(['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan']),
          state: faker.helpers.arrayElement(['Lagos', 'FCT', 'Rivers', 'Oyo']),
          country: 'Nigeria',
        },
        subtotal,
        shippingCost: shipping,
        taxAmount: tax,
        totalAmount: total,
        status,
        paymentStatus: status === 'delivered' || status === 'shipped' ? 'paid' : faker.helpers.arrayElement(paymentStatuses),
        paymentMethod: faker.helpers.arrayElement(paymentMethods),
        deliveredAt: status === 'delivered' ? faker.date.recent({ days: 5 }) : undefined,
      });
    }
    await Order.insertMany(orders);
    console.log('Orders seeded.');

    // --- 13. Inventory Adjustments ---
    console.log('Seeding inventory adjustments...');
    const adjustments = [];
    for (let i = 0; i < 5; i++) {
      const prod = createdProducts[i];
      const prev = getRandomInt(5, 50);
      const delta = faker.helpers.arrayElement([-2, -1, 5, 10, 20]);
      adjustments.push({
        product: prod._id,
        delta,
        previousQuantity: prev,
        newQuantity: prev + delta,
        reason: delta > 0 ? 'Restock from supplier' : 'Sold / returned',
        adjustedBy: createdAdmins[0]._id,
      });
    }
    await InventoryAdjustment.insertMany(adjustments);
    console.log('Inventory adjustments seeded.');

    console.log('Database seeding complete! 🚀');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }
  }
};

seedDB();
