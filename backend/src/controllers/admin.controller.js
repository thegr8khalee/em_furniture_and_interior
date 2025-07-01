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

export const adminCheckAuth = (req, res) => {
  try {
    // If protectAdminRoute successfully populated req.admin, the admin is authenticated
    if (req.admin) {
      // Respond with admin data (excluding sensitive fields like passwordHash)
      res.status(200).json({
        _id: req.admin._id,
        username: req.admin.username,
        email: req.admin.email,
        createdAt: req.admin.createdAt,
        updatedAt: req.admin.updatedAt,
        message: 'Admin session active.',
      });
    } else {
      // This case should ideally be caught by protectAdminRoute if it's a protected route
      res.status(401).json({ message: 'Not authenticated as admin.' });
    }
  } catch (error) {
    console.error('Error in adminCheckAuth controller: ', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addProduct = async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    collectionId,
    images,
    isBestSeller,
    isPromo,
    discountedPrice,
    isForeign,
    origin,
  } = req.body;

  // Basic validation
  if (!name || !description || !price || !category) {
    return res
      .status(400)
      .json({
        message:
          'Please enter all required product fields: name, description, price, category.',
      });
  }
  if (isPromo && (discountedPrice === undefined || discountedPrice === null)) {
    return res
      .status(400)
      .json({
        message: 'Discounted price is required if product is on promotion.',
      });
  }
  if (discountedPrice !== undefined && discountedPrice >= price) {
    return res
      .status(400)
      .json({
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
        // Assuming imageData is a Base64 string or a direct URL
        // Cloudinary's uploader.upload can handle Base64 strings directly
        const uploadResponse = await cloudinary.uploader.upload(imageData, {
          folder: 'furniture_products', // Optional: specify a folder in Cloudinary
        });
        uploadedImages.push({
          url: uploadResponse.secure_url,
          public_id: uploadResponse.public_id, // Store public_id for future deletion
        });
      }
    }

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      collectionId: collectionId || null, // Set to null if not provided
      images: uploadedImages, // Store array of { url, public_id } objects
      isBestSeller: isBestSeller || false,
      isPromo: isPromo || false,
      discountedPrice: isPromo ? discountedPrice : undefined, // Only save if isPromo is true
      isForeign: isForeign || false,
      origin: isForeign ? origin : undefined, // Only save origin if isForeign is true
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error in addProduct controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateProduct = async (req, res) => {
  const { productId } = req.params;
  const {
    name,
    description,
    price,
    category,
    collectionId,
    images,
    isBestSeller,
    isPromo,
    discountedPrice,
    isForeign,
    origin,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }

  // Validation for update fields
  if (price !== undefined && price < 0) {
    return res.status(400).json({ message: 'Price must be non-negative.' });
  }
  if (
    isPromo !== undefined &&
    isPromo &&
    (discountedPrice === undefined || discountedPrice === null)
  ) {
    return res
      .status(400)
      .json({
        message: 'Discounted price is required if product is set to promotion.',
      });
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
  if (discountedPrice !== undefined && discountedPrice < 0) {
    return res
      .status(400)
      .json({ message: 'Discounted price must be non-negative.' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Validate collectionId if provided and different
    if (collectionId && product.collectionId?.toString() !== collectionId) {
      if (!mongoose.Types.ObjectId.isValid(collectionId)) {
        return res
          .status(400)
          .json({ message: 'Invalid Collection ID format.' });
      }
      const collectionExists = await Collection.findById(collectionId);
      if (!collectionExists) {
        return res
          .status(404)
          .json({ message: 'Collection not found with the provided ID.' });
      }
    }

    // --- Image Handling for Update ---
    const newImageUrls = [];
    const existingImagePublicIds = product.images
      .map((img) => img.public_id)
      .filter(Boolean);
    const imagesToKeep = []; // To store images that are already in Cloudinary and should remain

    if (images && images.length > 0) {
      for (const imageData of images) {
        if (
          typeof imageData === 'object' &&
          imageData.url &&
          imageData.public_id
        ) {
          // This is an existing image object, keep it
          imagesToKeep.push(imageData);
        } else {
          // This is new image data (Base64 string), upload it
          const uploadResponse = await cloudinary.uploader.upload(imageData, {
            folder: 'furniture_products',
          });
          newImageUrls.push({
            url: uploadResponse.secure_url,
            public_id: uploadResponse.public_id,
          });
        }
      }
    }

    // Combine existing and new images
    const finalImages = [...imagesToKeep, ...newImageUrls];

    // Identify images to delete from Cloudinary (those in DB but not in finalImages)
    const publicIdsToDelete = existingImagePublicIds.filter(
      (publicId) => !finalImages.some((img) => img.public_id === publicId)
    );

    // Delete images from Cloudinary that are no longer needed
    for (const publicId of publicIdsToDelete) {
      await cloudinary.uploader.destroy(publicId);
      console.log(`Deleted image from Cloudinary: ${publicId}`);
    }
    // --- End Image Handling ---

    // Update fields dynamically
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (category !== undefined) product.category = category;
    if (collectionId !== undefined) product.collectionId = collectionId; // Can be null to remove from collection
    product.images = finalImages; // Assign the processed images
    if (isBestSeller !== undefined) product.isBestSeller = isBestSeller;
    if (isPromo !== undefined) product.isPromo = isPromo;
    if (isForeign !== undefined) product.isForeign = isForeign;

    // Handle discountedPrice logic based on isPromo
    if (product.isPromo) {
      if (discountedPrice !== undefined) {
        product.discountedPrice = discountedPrice;
      } else if (
        product.discountedPrice === undefined ||
        product.discountedPrice === null
      ) {
        // If isPromo is true but discountedPrice is being removed or was never set
        return res
          .status(400)
          .json({
            message:
              'Discounted price is required when product is on promotion.',
          });
      }
    } else {
      // If isPromo is false, ensure discountedPrice is not set
      product.discountedPrice = undefined;
    }

    // Handle origin logic based on isForeign
    if (product.isForeign) {
      if (origin !== undefined) {
        // Allow updating origin if isForeign is true
        product.origin = origin;
      } else if (product.origin === undefined || product.origin === null) {
        // If isForeign is true but origin is being removed or was never set
        return res
          .status(400)
          .json({ message: 'Origin is required when product is foreign.' });
      }
    } else {
      // If isForeign is false, ensure origin is not set
      product.origin = undefined;
    }

    const updatedProduct = await product.save(); // .save() will trigger pre-save hooks (like averageRating)
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error in updateProduct controller: ', error.message);
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
    productIds,
    isBestSeller,
    isPromo,
    discountedPrice,
    isForeign,
    origin,
    coverImage,
  } = req.body;

  // Basic validation
  if (!name || !description || !price) {
    return res
      .status(400)
      .json({
        message:
          'Please enter all required collection fields: name, description, price.',
      });
  }
  if (isPromo && (discountedPrice === undefined || discountedPrice === null)) {
    return res
      .status(400)
      .json({
        message: 'Discounted price is required if collection is on promotion.',
      });
  }
  if (discountedPrice !== undefined && discountedPrice >= price) {
    return res
      .status(400)
      .json({
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
      productIds: productIds || [],
      isBestSeller: isBestSeller || false,
      isPromo: isPromo || false,
      discountedPrice: isPromo ? discountedPrice : undefined, // Only save if isPromo is true
      isForeign: isForeign || false,
      origin: isForeign ? origin : undefined, // Only save origin if isForeign is true
      coverImage: uploadedCoverImage, // Store the uploaded cover image data
    });

    const savedCollection = await newCollection.save();
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
    price,
    productIds,
    isBestSeller,
    isPromo,
    discountedPrice,
    isForeign,
    origin,
    coverImage,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }

  // Validation for update fields
  if (price !== undefined && price < 0) {
    return res.status(400).json({ message: 'Price must be non-negative.' });
  }
  if (
    isPromo !== undefined &&
    isPromo &&
    (discountedPrice === undefined || discountedPrice === null)
  ) {
    return res
      .status(400)
      .json({
        message:
          'Discounted price is required if collection is set to promotion.',
      });
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
  if (discountedPrice !== undefined && discountedPrice < 0) {
    return res
      .status(400)
      .json({ message: 'Discounted price must be non-negative.' });
  }

  try {
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    // Validate productIds if provided and different
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
    if (price !== undefined) collection.price = price;
    if (productIds !== undefined) collection.productIds = productIds; // Overwrite or merge based on frontend logic
    if (isBestSeller !== undefined) collection.isBestSeller = isBestSeller;
    if (isPromo !== undefined) collection.isPromo = isPromo;
    if (isForeign !== undefined) collection.isForeign = isForeign;
    collection.coverImage = updatedCoverImage; // Assign the processed cover image

    // Handle discountedPrice logic based on isPromo
    if (collection.isPromo) {
      if (discountedPrice !== undefined) {
        collection.discountedPrice = discountedPrice;
      } else if (
        collection.discountedPrice === undefined ||
        collection.discountedPrice === null
      ) {
        return res
          .status(400)
          .json({
            message:
              'Discounted price is required when collection is on promotion.',
          });
      }
    } else {
      collection.discountedPrice = undefined;
    }

    // Handle origin logic based on isForeign
    if (collection.isForeign) {
      if (origin !== undefined) {
        // Allow updating origin if isForeign is true
        collection.origin = origin;
      } else if (
        collection.origin === undefined ||
        collection.origin === null
      ) {
        return res
          .status(400)
          .json({ message: 'Origin is required when collection is foreign.' });
      }
    } else {
      collection.origin = undefined;
    }

    const updatedCollection = await collection.save(); // .save() will trigger pre-save hooks
    res.status(200).json(updatedCollection);
  } catch (error) {
    console.error('Error in updateCollection controller: ', error.message);
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
