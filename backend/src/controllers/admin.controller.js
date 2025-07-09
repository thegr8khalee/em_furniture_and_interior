// controllers/adminAuthController.js

import Admin from '../models/admin.model.js'; // Import the Admin model
import bcrypt from 'bcryptjs';
import { generateToken } from '../lib/utils.js'; // Re-use the same token generation utility
import Product from '../models/product.model.js'; // Ensure correct path
import Collection from '../models/collection.model.js'; // To validate collectionId
import mongoose from 'mongoose';
import cloudinary from '../lib/cloudinary.js';

export const adminSignup = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({
        message:
          'All fields (username, email, password) are required for admin signup.',
      });
    }

    // Check if admin with given email or username already exists
    const adminExists = await Admin.findOne({ $or: [{ email }, { username }] });
    if (adminExists) {
      return res
        .status(400)
        .json({ message: 'Admin with this email or username already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new admin instance
    const newAdmin = new Admin({
      username,
      email,
      passwordHash,
    });

    // Save the new admin to the database
    await newAdmin.save();

    // Generate JWT token for admin (you might want a different token secret or payload for admins)
    // For simplicity, we'll use the same generateToken, but in a real app, distinguish admin tokens.
    generateToken(newAdmin._id, res, 'admin'); // Pass 'admin' as role/type for token differentiation

    // Respond with success message and admin data (excluding passwordHash)
    res.status(201).json({
      _id: newAdmin._id,
      username: newAdmin.username,
      email: newAdmin.email,
      createdAt: newAdmin.createdAt,
      updatedAt: newAdmin.updatedAt,
      message: 'Admin registered successfully.',
    });
  } catch (error) {
    console.error('Error in adminSignup controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  console.log(email);

  try {
    // Input validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required for admin login.' });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Compare provided password with hashed password in the database
    const isPasswordCorrect = await bcrypt.compare(
      password,
      admin.passwordHash
    );
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Generate JWT token for admin
    generateToken(admin._id, res, 'admin'); // Pass 'admin' role/type

    // Respond with admin data (excluding passwordHash)
    res.status(200).json({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      role: 'admin',
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      message: 'Admin logged in successfully.',
    });
  } catch (error) {
    console.error('Error in adminLogin controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const adminLogout = (req, res) => {
  try {
    // Clear the JWT cookie by setting its maxAge to 0
    // Ensure this matches the cookie name used for admin tokens
    res.cookie('jwt', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    res.status(200).json({ message: 'Admin logged out successfully.' });
  } catch (error) {
    console.error('Error in adminLogout controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addProduct = async (req, res) => {
  const {
    name,
    description,
    category,
    items,
    style,
    collectionId,
    images, // This will be an array of Base64 strings from the frontend
    isBestSeller,
    isPromo, // This will be a number or undefined from frontend
    isForeign,
    origin,
  } = req.body;

  let price = parseFloat(req.body.price);
  let discountedPrice =
    req.body.discountedPrice !== ''
      ? parseFloat(req.body.discountedPrice)
      : undefined;

  // Basic validation using the parsed numeric values

  // Basic validation
  if (!name || !description || !price || !category || !style) {
    return res.status(400).json({
      message:
        'Please enter all required product fields: name, description, price, category.',
    });
  }
  // Frontend should already ensure discountedPrice is a number or undefined when isPromo is true
  // Backend validation for discountedPrice when isPromo is true
  if (
    isPromo &&
    (discountedPrice === undefined ||
      discountedPrice === null ||
      isNaN(discountedPrice))
  ) {
    return res.status(400).json({
      message:
        'Discounted price is required and must be a valid number if product is on promotion.',
    });
  }
  if (discountedPrice !== undefined && discountedPrice >= price) {
    return res.status(400).json({
      message: 'Discounted price must be less than the original price.',
    });
  }
  if (price < 0 || (discountedPrice !== undefined && discountedPrice < 0)) {
    return res
      .status(400)
      .json({ message: 'Price and discounted price must be non-negative.' });
  }
  if (isForeign && !origin) {
    return res
      .status(400)
      .json({ message: 'Origin is required if product is foreign.' });
  }

  try {
    // Validate collectionId if provided
    if (collectionId && !mongoose.Types.ObjectId.isValid(collectionId)) {
      return res.status(400).json({ message: 'Invalid Collection ID format.' });
    }
    if (collectionId) {
      const collectionExists = await Collection.findById(collectionId);
      if (!collectionExists) {
        return res
          .status(404)
          .json({ message: 'Collection not found with the provided ID.' });
      }
    }

    const uploadedImages = [];
    if (images && images.length > 0) {
      for (const imageData of images) {
        if (
          typeof imageData !== 'string' ||
          !imageData.startsWith('data:image')
        ) {
          console.warn('Skipping invalid image data:', imageData);
          continue;
        }
        const uploadResponse = await cloudinary.uploader.upload(imageData, {
          folder: 'furniture_products',
        });
        uploadedImages.push({
          url: uploadResponse.secure_url,
          public_id: uploadResponse.public_id,
        });
      }
    }

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      items,
      style,
      collectionId: collectionId || null,
      images: uploadedImages,
      isBestSeller: isBestSeller || false,
      isPromo: isPromo || false,
      // FIX: Ensure discountedPrice is a valid number when isPromo is true, otherwise undefined
      discountedPrice:
        isPromo &&
        typeof discountedPrice === 'number' &&
        !isNaN(discountedPrice)
          ? discountedPrice
          : undefined,
      isForeign: isForeign || false,
      origin: isForeign ? origin : undefined,
    });

    const savedProduct = await newProduct.save();

    if (collectionId) {
      const collection = await Collection.findById(collectionId);
      if (collection) {
        // Check if product._id already exists in productIds array
        if (!collection.productIds.includes(savedProduct._id)) {
          collection.productIds.push(savedProduct._id);
          await collection.save();
          console.log(
            `Product ${savedProduct._id} added to collection ${collectionId}.`
          );
        } else {
          console.log(
            `Product ${savedProduct._id} already exists in collection ${collectionId}.`
          );
        }
      }
    }

    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error in addProduct controller: ', error.message);
    // Check for Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: 'Product validation failed', errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateProduct = async (req, res) => {
  const { productId } = req.params;
  const {
    name,
    description,
    category,
    items,
    style,
    collectionId,
    images,
    isBestSeller,
    isPromo,
    isForeign,
    origin,
  } = req.body;

  // Parse price and discountedPrice from string to number for update
  let price =
    req.body.price !== undefined ? parseFloat(req.body.price) : undefined;
  let discountedPrice =
    req.body.discountedPrice !== undefined && req.body.discountedPrice !== ''
      ? parseFloat(req.body.discountedPrice)
      : undefined;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }

  // Validation for update fields
  if (price !== undefined && (isNaN(price) || price < 0)) {
    return res
      .status(400)
      .json({ message: 'Price must be a non-negative number.' });
  }
  if (isPromo !== undefined && isPromo) {
    if (
      isNaN(discountedPrice) ||
      discountedPrice === null ||
      discountedPrice === undefined
    ) {
      return res
        .status(400)
        .json({
          message:
            'Discounted price is required and must be a valid number if product is set to promotion.',
        });
    }
  }
  if (
    discountedPrice !== undefined &&
    price !== undefined &&
    discountedPrice >= price
  ) {
    return res
      .status(400)
      .json({
        message: 'Discounted price must be less than the original price.',
      });
  }
  if (
    discountedPrice !== undefined &&
    (isNaN(discountedPrice) || discountedPrice < 0)
  ) {
    return res
      .status(400)
      .json({ message: 'Discounted price must be non-negative.' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // --- Collection ID Update Logic ---
    const oldCollectionId = product.collectionId
      ? product.collectionId.toString()
      : null;
    const newCollectionId = collectionId === '' ? null : collectionId;

    if (oldCollectionId !== newCollectionId) {
      if (oldCollectionId) {
        const oldCollection = await Collection.findById(oldCollectionId);
        if (oldCollection) {
          oldCollection.productIds = oldCollection.productIds.filter(
            (id) => id.toString() !== productId
          );
          await oldCollection.save();
          console.log(
            `Product ${productId} removed from old collection ${oldCollectionId}.`
          );
        }
      }
      if (newCollectionId) {
        if (!mongoose.Types.ObjectId.isValid(newCollectionId)) {
          return res
            .status(400)
            .json({ message: 'Invalid New Collection ID format.' });
        }
        const newCollection = await Collection.findById(newCollectionId);
        if (!newCollection) {
          return res
            .status(404)
            .json({
              message: 'New Collection not found with the provided ID.',
            });
        }
        if (!newCollection.productIds.includes(product._id)) {
          newCollection.productIds.push(product._id);
          await newCollection.save();
          console.log(
            `Product ${productId} added to new collection ${newCollectionId}.`
          );
        }
      }
    }
    // --- End Collection ID Update Logic ---

    // --- Image Handling for Update ---
    // console.log('--- Debugging Image Update ---');
    // console.log(
    //   '1. Initial product.images from DB:',
    //   JSON.stringify(product.images)
    // );
    // console.log(
    //   '2. Incoming images from frontend (req.body.images):',
    //   JSON.stringify(images)
    // );

    const newImageUploads = [];
    const imagesToKeep = [];

    if (images && images.length > 0) {
      for (const imageData of images) {
        if (
          typeof imageData === 'object' &&
          imageData.url &&
          imageData.public_id === true
        ) {
          imagesToKeep.push(imageData);
        } else if (
          typeof imageData === 'object' &&
          imageData.url &&
          imageData.isNew
        ) {
          const base64String = imageData.url;
          if (
            typeof base64String === 'string' &&
            base64String.startsWith('data:image')
          ) {
            const uploadResponse = await cloudinary.uploader.upload(
              base64String,
              {
                folder: 'furniture_products',
              }
            );
            newImageUploads.push({
              url: uploadResponse.secure_url,
              public_id: uploadResponse.public_id,
            });
          } else {
            console.warn(
              'Skipping invalid new image data (not a Base64 string):',
              imageData
            );
          }
        } else {
          console.warn('Skipping unrecognized image data format:', imageData);
        }
      }
    }
    // console.log(
    //   '3. Images identified to keep (imagesToKeep):',
    //   JSON.stringify(imagesToKeep)
    // );
    // console.log(
    //   '4. Newly uploaded images (newImageUploads):',
    //   JSON.stringify(newImageUploads)
    // );

    const finalImages = [...imagesToKeep, ...newImageUploads];
    // console.log(
    //   '5. Final images array (finalImages):',
    //   JSON.stringify(finalImages)
    // );

    const publicIdsToDelete = product.images
      .map((img) => img.public_id) // Ensure this is correct property name from DB
      .filter(
        (publicId) =>
          publicId && !finalImages.some((img) => img.public_id === publicId)
      ); // Ensure img.public_id here matches DB property
    // console.log(
    //   '6. Public IDs to delete from Cloudinary (publicIdsToDelete):',
    //   JSON.stringify(publicIdsToDelete)
    // );

    for (const publicId of publicIdsToDelete) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted image from Cloudinary: ${publicId}`);
      } catch (deleteError) {
        console.error(
          `Error deleting image ${publicId} from Cloudinary:`,
          deleteError
        );
      }
    }
    // --- End Image Handling ---

    // Update fields dynamically
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined && !isNaN(price)) product.price = price;
    if (category !== undefined) product.category = category;
    if (items !== undefined) product.items = items;
    if (style !== undefined) product.style = style;
    product.collectionId = newCollectionId;
    product.images = finalImages; // Assign the processed images
    if (isBestSeller !== undefined) product.isBestSeller = isBestSeller;
    if (isPromo !== undefined) product.isPromo = isPromo;
    if (isForeign !== undefined) product.isForeign = isForeign;

    // Handle discountedPrice logic based on isPromo
    if (product.isPromo) {
      if (discountedPrice !== undefined && !isNaN(discountedPrice)) {
        product.discountedPrice = discountedPrice;
      } else {
        return res
          .status(400)
          .json({
            message:
              'Discounted price is required and must be a valid number when product is on promotion.',
          });
      }
    } else {
      product.discountedPrice = undefined;
    }

    // Handle origin logic based on isForeign
    if (product.isForeign) {
      if (origin !== undefined) {
        product.origin = origin;
      } else {
        return res
          .status(400)
          .json({ message: 'Origin is required when product is foreign.' });
      }
    } else {
      product.origin = undefined;
    }

    const updatedProduct = await product.save();
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error in updateProduct controller: ', error.message);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: 'Product validation failed', errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const delProduct = async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Delete associated images from Cloudinary using their public_ids
    for (const image of product.images) {
      if (image.public_id) {
        // Only delete if public_id exists
        await cloudinary.uploader.destroy(image.public_id);
        console.log(`Deleted image from Cloudinary: ${image.public_id}`);
      }
    }

    await Product.deleteOne({ _id: productId }); // Use deleteOne for clarity

    res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Error in delProduct controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addCollection = async (req, res) => {
  const {
    name,
    description,
    price,
    style,
    productIds,
    isBestSeller,
    isPromo,
    discountedPrice,
    isForeign,
    origin,
    coverImage,
  } = req.body;

  // Basic validation
  if (!name || !description || !price ||!style) {
    return res.status(400).json({
      message:
        'Please enter all required collection fields: name, description, price.',
    });
  }
  if (isPromo && (discountedPrice === undefined || discountedPrice === null)) {
    return res.status(400).json({
      message: 'Discounted price is required if collection is on promotion.',
    });
  }
  if (discountedPrice !== undefined && discountedPrice >= price) {
    return res.status(400).json({
      message: 'Discounted price must be less than the original price.',
    });
  }
  if (price < 0 || (discountedPrice !== undefined && discountedPrice < 0)) {
    return res
      .status(400)
      .json({ message: 'Price and discounted price must be non-negative.' });
  }
  if (isForeign && !origin) {
    return res
      .status(400)
      .json({ message: 'Origin is required if collection is foreign.' });
  }

  try {
    // Validate productIds if provided
    if (productIds && productIds.length > 0) {
      for (const productId of productIds) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res
            .status(400)
            .json({ message: `Invalid Product ID format: ${productId}` });
        }
        const productExists = await Product.findById(productId);
        if (!productExists) {
          return res
            .status(404)
            .json({ message: `Product with ID ${productId} not found.` });
        }
      }
    }

    let uploadedCoverImage = null;
    if (coverImage) {
      // Assuming coverImage is a Base64 string or a direct URL
      const uploadResponse = await cloudinary.uploader.upload(coverImage, {
        folder: 'furniture_collections_covers', // Optional: specify a folder in Cloudinary
      });
      uploadedCoverImage = {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      };
    }

    const newCollection = new Collection({
      name,
      description,
      price,
      style,
      productIds: productIds || [],
      isBestSeller: isBestSeller || false,
      isPromo: isPromo || false,
      discountedPrice: isPromo ? discountedPrice : undefined, // Only save if isPromo is true
      isForeign: isForeign || false,
      origin: isForeign ? origin : undefined, // Only save origin if isForeign is true
      coverImage: uploadedCoverImage, // Store the uploaded cover image data
    });

    const savedCollection = await newCollection.save();

    if (savedCollection.productIds && savedCollection.productIds.length > 0) {
      for (const productId of savedCollection.productIds) {
        const product = await Product.findById(productId);
        if (product) {
          // Check if the product is already associated with this collection
          if (
            !product.collectionId ||
            product.collectionId.toString() !== savedCollection._id.toString()
          ) {
            // If product was in another collection, remove it from there first
            if (product.collectionId) {
              const oldCollection = await Collection.findById(
                product.collectionId
              );
              if (oldCollection) {
                oldCollection.productIds = oldCollection.productIds.filter(
                  (id) => id.toString() !== productId.toString()
                );
                await oldCollection.save();
                console.log(
                  `Product ${productId} removed from old collection ${oldCollection._id}.`
                );
              }
            }
            product.collectionId = savedCollection._id;
            await product.save();
            console.log(
              `Product ${productId} updated with collectionId ${savedCollection._id}.`
            );
          }
        }
      }
    }

    res.status(201).json(savedCollection);
  } catch (error) {
    console.error('Error in addCollection controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateCollection = async (req, res) => {
  const { collectionId } = req.params;
  const {
    name,
    description,
    productIds,
    isBestSeller,
    isPromo,
    isForeign,
    origin,
    coverImage,
    style,
  } = req.body;

  // Parse price and discountedPrice from string to number
  let price =
    req.body.price !== undefined ? parseFloat(req.body.price) : undefined;
  let discountedPrice =
    req.body.discountedPrice !== undefined && req.body.discountedPrice !== ''
      ? parseFloat(req.body.discountedPrice)
      : undefined;

  if (!mongoose.Types.ObjectId.isValid(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }

  // Validation for update fields
  if (price !== undefined && (isNaN(price) || price < 0)) {
    return res
      .status(400)
      .json({ message: 'Price must be a non-negative number.' });
  }
  if (isPromo !== undefined && isPromo) {
    if (
      isNaN(discountedPrice) ||
      discountedPrice === null ||
      discountedPrice === undefined
    ) {
      return res
        .status(400)
        .json({
          message:
            'Discounted price is required and must be a valid number if collection is set to promotion.',
        });
    }
  }
  if (
    discountedPrice !== undefined &&
    price !== undefined &&
    discountedPrice >= price
  ) {
    return res
      .status(400)
      .json({
        message: 'Discounted price must be less than the original price.',
      });
  }
  if (
    discountedPrice !== undefined &&
    (isNaN(discountedPrice) || discountedPrice < 0)
  ) {
    return res
      .status(400)
      .json({ message: 'Discounted price must be non-negative.' });
  }

  try {
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    // Validate productIds if provided and ensure they exist
    const oldProductIds = collection.productIds.map((id) => id.toString());
    const newProductIds = productIds
      ? productIds.map((id) => id.toString())
      : []; // Ensure newProductIds is an array

    if (productIds !== undefined && productIds.length > 0) {
      for (const productId of productIds) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res
            .status(400)
            .json({ message: `Invalid Product ID format: ${productId}` });
        }
        const productExists = await Product.findById(productId);
        if (!productExists) {
          return res
            .status(404)
            .json({ message: `Product with ID ${productId} not found.` });
        }
      }
    }

    // --- Cover Image Handling for Update ---
    let updatedCoverImage = collection.coverImage; // Start with existing image

    if (coverImage === null) {
      // Frontend explicitly sent null to remove image
      if (collection.coverImage && collection.coverImage.public_id) {
        await cloudinary.uploader.destroy(collection.coverImage.public_id);
        console.log(
          `Deleted cover image from Cloudinary: ${collection.coverImage.public_id}`
        );
      }
      updatedCoverImage = undefined; // Set to undefined to remove from DB
    } else if (
      coverImage &&
      typeof coverImage === 'string' &&
      !coverImage.startsWith('http')
    ) {
      // New Base64 string provided, upload it
      if (collection.coverImage && collection.coverImage.public_id) {
        // Delete old image if it exists
        await cloudinary.uploader.destroy(collection.coverImage.public_id);
        console.log(
          `Deleted old cover image from Cloudinary: ${collection.coverImage.public_id}`
        );
      }
      const uploadResponse = await cloudinary.uploader.upload(coverImage, {
        folder: 'furniture_collections_covers',
      });
      updatedCoverImage = {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      };
    } else if (
      coverImage &&
      typeof coverImage === 'object' &&
      coverImage.url &&
      coverImage.public_id
    ) {
      // Existing image object provided, keep it as is
      updatedCoverImage = coverImage;
    }
    // If coverImage is undefined in req.body, it means no change, so updatedCoverImage remains collection.coverImage
    // --- End Cover Image Handling ---

    // Update fields dynamically
    if (name !== undefined) collection.name = name;
    if (description !== undefined) collection.description = description;
    // if (items !== undefined) collection.items = items;
    if (price !== undefined && !isNaN(price)) collection.price = price; // Use parsed price
    if (isBestSeller !== undefined) collection.isBestSeller = isBestSeller;
    if (isPromo !== undefined) collection.isPromo = isPromo;
    if (isForeign !== undefined) collection.isForeign = isForeign;
    if (style !== undefined) collection.style = style;
    collection.coverImage = updatedCoverImage; // Assign the processed cover image

    // Handle discountedPrice logic based on isPromo
    if (collection.isPromo) {
      if (discountedPrice !== undefined && !isNaN(discountedPrice)) {
        // Use parsed discountedPrice
        collection.discountedPrice = discountedPrice;
      } else {
        return res
          .status(400)
          .json({
            message:
              'Discounted price is required and must be a valid number when collection is on promotion.',
          });
      }
    } else {
      collection.discountedPrice = undefined;
    }

    // Handle origin logic based on isForeign
    if (collection.isForeign) {
      if (origin !== undefined) {
        collection.origin = origin;
      } else {
        return res
          .status(400)
          .json({ message: 'Origin is required when collection is foreign.' });
      }
    } else {
      collection.origin = undefined;
    }

    // --- NEW LOGIC: Update products' collectionId based on changes in productIds array ---
    const productsToAdd = newProductIds.filter(
      (id) => !oldProductIds.includes(id)
    );
    const productsToRemove = oldProductIds.filter(
      (id) => !newProductIds.includes(id)
    );

    // Add collectionId to newly associated products
    for (const productId of productsToAdd) {
      const product = await Product.findById(productId);
      if (product) {
        // If product was in another collection, remove it from there first
        if (
          product.collectionId &&
          product.collectionId.toString() !== collection._id.toString()
        ) {
          const oldCollection = await Collection.findById(product.collectionId);
          if (oldCollection) {
            oldCollection.productIds = oldCollection.productIds.filter(
              (id) => id.toString() !== productId
            );
            await oldCollection.save();
            console.log(
              `Product ${productId} removed from old collection ${oldCollection._id}.`
            );
          }
        }
        product.collectionId = collection._id;
        await product.save();
        console.log(
          `Product ${productId} added to collection ${collection._id}.`
        );
      }
    }

    // Remove collectionId from products no longer associated
    for (const productId of productsToRemove) {
      const product = await Product.findById(productId);
      if (
        product &&
        product.collectionId &&
        product.collectionId.toString() === collection._id.toString()
      ) {
        product.collectionId = undefined; // Or null, depending on your schema
        await product.save();
        console.log(
          `Product ${productId} removed from collection ${collection._id}.`
        );
      }
    }
    // --- END NEW LOGIC ---

    // Finally, update the collection's productIds array in the collection document itself
    collection.productIds = productIds || []; // Update the collection's productIds with the new array

    const updatedCollection = await collection.save();
    res.status(200).json(updatedCollection);
  } catch (error) {
    console.error('Error in updateCollection controller: ', error.message);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: 'Collection validation failed', errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const delCollection = async (req, res) => {
  const { collectionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }

  try {
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    // Delete associated cover image from Cloudinary if it exists
    if (collection.coverImage && collection.coverImage.public_id) {
      await cloudinary.uploader.destroy(collection.coverImage.public_id);
      console.log(
        `Deleted cover image from Cloudinary: ${collection.coverImage.public_id}`
      );
    }

    await Collection.deleteOne({ _id: collectionId }); // Use deleteOne for clarity

    res.status(200).json({ message: 'Collection deleted successfully.' });
  } catch (error) {
    console.error('Error in delCollection controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
