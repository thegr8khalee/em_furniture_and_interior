// src/seed/seed.js
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import Product from '../models/product.model.js'; // Adjusted path: assuming models are in src/models
import Collection from '../models/collection.model.js'; // Adjusted path: assuming models are in src/models
import { connectDB } from '../lib/db.js'; // Adjusted path: assuming lib is in src/lib
import dotenv from 'dotenv'; // Import dotenv

dotenv.config({ path: './.env' }); // Load environment variables for this script. Adjust path if .env is not in project root.

// --- Configuration ---
const NUM_PRODUCTS = 50;
const NUM_COLLECTIONS = 50;

// --- Defined Categories and Styles ---
const categories = [
  "Living Room", "Armchair", "Bedroom", "Dining Room",
  "Center Table", "Wardrobe", "TV Unit", "Carpet"
];

const styles = [
  "Modern", "Contemporay", "Antique/Royal", "Bespoke", "Minimalist", "Glam"
];

// Keywords for Faker.js image generation
const imageKeywords = ['furniture', 'interior', 'design', 'home', 'decor', 'chair', 'table', 'bed', 'sofa'];

// Function to generate a random product
const generateProduct = async (collections) => {
  const isPromo = faker.datatype.boolean();
  const price = parseFloat(faker.commerce.price({ min: 10000, max: 500000, dec: 0 }));
  const discountedPrice = isPromo ? (parseFloat(faker.commerce.price({ min: 1000, max: price * 0.8, dec: 0 }))) : undefined;
  const isForeign = faker.datatype.boolean();

  // Pick a random collection ID, or null if not assigned to a collection
  const collectionId = faker.helpers.arrayElement([...collections.map(col => col._id), null]);

  return {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    items: faker.number.int({ min: 1, max: 100 }).toString(),
    price: price,
    category: faker.helpers.arrayElement(categories),
    style: faker.helpers.arrayElement(styles),
    collectionId: collectionId,
    images: [{ url: faker.image.urlLoremFlickr({ category: faker.helpers.arrayElement(imageKeywords) }), public_id: faker.string.uuid() }],
    isBestSeller: faker.datatype.boolean(),
    isPromo: isPromo,
    discountedPrice: discountedPrice,
    isForeign: isForeign,
    origin: isForeign ? faker.location.country() : undefined,
    reviews: [],
    averageRating: 0,
  };
};

// Function to generate a random collection
const generateCollection = async (index) => { // Added index parameter for uniqueness
  const isPromo = faker.datatype.boolean();

  let rawPrice = faker.commerce.price({ min: 50000, max: 1000000, dec: 0 });
  let price = parseFloat(rawPrice);
  if (isNaN(price) || price < 0) {
      console.warn(`Faker generated invalid price for collection: ${rawPrice}. Defaulting to 50000.`);
      price = 50000;
  }

  const discountedPrice = isPromo ? (parseFloat(faker.commerce.price({ min: 10000, max: price * 0.8, dec: 0 }))) : undefined;
  const isForeign = faker.datatype.boolean();

  let selectedStyle = faker.helpers.arrayElement(styles);
  if (!selectedStyle) {
      console.warn('Faker failed to select a style for collection. Defaulting to "Modern".');
      selectedStyle = 'Modern';
  }

  // Ensure name is unique by appending an index or UUID
  let collectionName = `${faker.commerce.productAdjective()} ${faker.commerce.productMaterial()} Collection ${index + 1}`;
  // Alternatively, you could use faker.string.uuid() for a truly random suffix:
  // let collectionName = `${faker.commerce.productAdjective()} ${faker.commerce.productMaterial()} Collection - ${faker.string.uuid().substring(0, 8)}`;

  if (!collectionName || collectionName.trim() === '') {
      console.warn('Faker generated empty collection name. Defaulting to "Generic Collection".');
      collectionName = `Generic Collection ${index + 1}`;
  }

  return {
    name: collectionName,
    description: faker.lorem.paragraph(),
    price: price,
    style: selectedStyle,
    productIds: [],
    isBestSeller: faker.datatype.boolean(),
    isPromo: isPromo,
    discountedPrice: discountedPrice,
    isForeign: isForeign,
    origin: isForeign ? faker.location.country() : undefined,
    coverImage: { url: faker.image.urlLoremFlickr({ category: faker.helpers.arrayElement(imageKeywords) }), public_id: faker.string.uuid() },
    reviews: [],
    averageRating: 0,
  };
};

const seedDB = async () => {
  try {
    await connectDB();

    console.log('Clearing existing data...');
    await Product.deleteMany({});
    await Collection.deleteMany({});
    console.log('Existing data cleared.');

    // 1. Create Collections first
    console.log(`Generating ${NUM_COLLECTIONS} collections...`);
    const collectionsData = [];
    for (let i = 0; i < NUM_COLLECTIONS; i++) {
        collectionsData.push(await generateCollection(i)); // Pass index to generateCollection
    }
    const createdCollections = await Collection.insertMany(collectionsData);
    console.log(`${NUM_COLLECTIONS} collections created.`);

    // 2. Create Products, linking to collections
    console.log(`Generating ${NUM_PRODUCTS} products...`);
    const productsToCreate = [];
    for (let i = 0; i < NUM_PRODUCTS; i++) {
      productsToCreate.push(await generateProduct(createdCollections));
    }
    const createdProducts = await Product.insertMany(productsToCreate);
    console.log(`${NUM_PRODUCTS} products created.`);

    // 3. Update Collections with associated Product IDs
    console.log('Updating collections with product links...');
    for (const product of createdProducts) {
      if (product.collectionId) {
        await Collection.findByIdAndUpdate(
          product.collectionId,
          { $addToSet: { productIds: product._id } }
        );
      }
    }
    console.log('Collections updated with product links.');

    // Optional: Add some random reviews to products and collections
    console.log('Adding some random reviews...');
    const users = Array.from({ length: 10 }, (_, i) => new mongoose.Types.ObjectId());

    for (const product of createdProducts) {
      const numReviews = faker.number.int({ min: 0, max: 5 });
      for (let i = 0; i < numReviews; i++) {
        product.reviews.push({
          userId: faker.helpers.arrayElement(users),
          rating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.lorem.sentence(),
        });
      }
      await product.save();
    }

    for (const collection of createdCollections) {
      const numReviews = faker.number.int({ min: 0, max: 5 });
      for (let i = 0; i < numReviews; i++) {
        collection.reviews.push({
          userId: faker.helpers.arrayElement(users),
          rating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.lorem.sentence(),
        });
      }
      await collection.save();
    }
    console.log('Reviews added and average ratings updated.');

    console.log('Database seeding complete!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }
  }
};

seedDB();
