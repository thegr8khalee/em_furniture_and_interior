// controllers/adminAuthController.js

import Admin from '../models/admin.model.js'; // Import the Admin model
import bcrypt from 'bcryptjs';
import { generateToken } from '../lib/utils.js'; // Re-use the same token generation utility
import mongoose from 'mongoose';
import cloudinary from '../lib/cloudinary.js';
import Project from '../models/project.model.js';
import { resolvePermissions } from '@em/shared/permissions';
import { logger } from '../lib/logger.js';
import {
  CatalogError,
  createProduct,
  updateProduct as updateCatalogProduct,
  deleteProduct as deleteCatalogProduct,
  createCollection,
  updateCollection as updateCatalogCollection,
  deleteCollection as deleteCatalogCollection,
} from '../services/catalogAdmin.js';

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
      role: 'admin',
      permissions: resolvePermissions('admin'),
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
      role: 'admin',
      adminRole: newAdmin.role,
      permissions: newAdmin.permissions,
      createdAt: newAdmin.createdAt,
      updatedAt: newAdmin.updatedAt,
      message: 'Admin registered successfully.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in adminSignup controller');
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

    // Backfill legacy admins with super_admin role.
    if (!admin.role) {
      admin.role = 'super_admin';
      admin.permissions = resolvePermissions('super_admin');
      await admin.save();
    }

    // Generate JWT token for admin
    generateToken(admin._id, res, 'admin'); // Pass 'admin' role/type

    // Respond with admin data (excluding passwordHash)
    res.status(200).json({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      role: 'admin',
      adminRole: admin.role,
      permissions: resolvePermissions(admin.role, admin.permissions),
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      message: 'Admin logged in successfully.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in adminLogin controller');
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
    logger.error({ err: error }, 'Error in adminLogout controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/*
 * Catalog CRUD now lives in src/services/catalogAdmin.js, against PostgreSQL.
 *
 * These handlers are the HTTP shell: translate the request, translate the
 * error. The validation rules, image handling and collection membership moved
 * wholesale — 986 lines of it, most of which was Cloudinary calls repeated with
 * small differences in four places.
 */
const handleCatalogError = (error, res, where) => {
  if (error instanceof CatalogError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where} controller`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const addProduct = async (req, res) => {
  try {
    res.status(201).json(await createProduct(req.body));
  } catch (error) {
    handleCatalogError(error, res, 'addProduct');
  }
};

export const updateProduct = async (req, res) => {
  try {
    res.status(200).json(await updateCatalogProduct(req.params.productId, req.body));
  } catch (error) {
    handleCatalogError(error, res, 'updateProduct');
  }
};

export const delProduct = async (req, res) => {
  try {
    await deleteCatalogProduct(req.params.productId);
    res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (error) {
    handleCatalogError(error, res, 'delProduct');
  }
};

export const addCollection = async (req, res) => {
  try {
    res.status(201).json(await createCollection(req.body));
  } catch (error) {
    handleCatalogError(error, res, 'addCollection');
  }
};

export const updateCollection = async (req, res) => {
  try {
    res.status(200).json(await updateCatalogCollection(req.params.collectionId, req.body));
  } catch (error) {
    handleCatalogError(error, res, 'updateCollection');
  }
};

export const delCollection = async (req, res) => {
  try {
    await deleteCatalogCollection(req.params.collectionId);
    res.status(200).json({ message: 'Collection deleted successfully.' });
  } catch (error) {
    handleCatalogError(error, res, 'delCollection');
  }
};

export const addProject = async (req, res) => {
  const { title, description, category, location, price, images } = req.body;

  let parsedPrice = parseFloat(price);

  // Basic validation
  if (
    !title ||
    !description ||
    !category ||
    !location ||
    !price ||
    !images ||
    images.length === 0
  ) {
    return res.status(400).json({
      message:
        'Please enter all required project fields, including at least one image.',
    });
  }

  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return res
      .status(400)
      .json({ message: 'Price must be a non-negative number.' });
  }

  try {
    const uploadedImages = [];

    // Image upload logic (similar to products)
    for (const imageData of images) {
      if (
        typeof imageData !== 'string' ||
        !imageData.startsWith('data:image')
      ) {
        logger.warn({ imageData }, 'Skipping invalid image data');
        continue;
      }
      const uploadResponse = await cloudinary.uploader.upload(imageData, {
        folder: 'project_images', // Dedicated folder for projects
      });
      uploadedImages.push({
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      });
    }

    if (uploadedImages.length === 0) {
      return res
        .status(400)
        .json({ message: 'No valid images were provided for upload.' });
    }

    const newProject = new Project({
      title,
      description,
      images: uploadedImages,
      category,
      location,
      price: parsedPrice,
    });

    const savedProject = await newProject.save();

    res.status(201).json(savedProject);
  } catch (error) {
    logger.error({ err: error }, 'Error in addProject controller');
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: 'Project validation failed', errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateProject = async (req, res) => {
  const { projectId } = req.params;
  const { title, description, category, location, price, images } = req.body;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid Project ID format.' });
  }

  let updateFields = {};
  let parsedPrice;

  // Validate and prepare price
  if (price !== undefined) {
    parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res
        .status(400)
        .json({ message: 'Price must be a non-negative number.' });
    }
    updateFields.price = parsedPrice;
  }

  if (title !== undefined) updateFields.title = title;
  if (description !== undefined) updateFields.description = description;
  if (category !== undefined) updateFields.category = category;
  if (location !== undefined) updateFields.location = location;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // --- Image Handling for Update (Copied & adapted from updateProduct) ---
    const newImageUploads = [];
    const imagesToKeep = [];

    if (images && images.length > 0) {
      for (const imageData of images) {
        // Condition for keeping an existing image (must match the structure sent by the frontend product update)
        if (
          typeof imageData === 'object' &&
          imageData.url &&
          imageData.public_id // Assuming the frontend sends back existing images with public_id
        ) {
          imagesToKeep.push(imageData);
        } else if (
          typeof imageData === 'object' &&
          imageData.url &&
          imageData.isNew // Condition for a new Base64 image
        ) {
          const base64String = imageData.url;
          if (
            typeof base64String === 'string' &&
            base64String.startsWith('data:image')
          ) {
            const uploadResponse = await cloudinary.uploader.upload(
              base64String,
              {
                folder: 'project_images',
              }
            );
            newImageUploads.push({
              url: uploadResponse.secure_url,
              public_id: uploadResponse.public_id,
            });
          } else {
            logger.warn({ imageData }, 'Skipping invalid new image data (not a Base64 string)');
          }
        } else {
          logger.warn({ imageData }, 'Skipping unrecognized image data format');
        }
      }
    }

    const finalImages = [...imagesToKeep, ...newImageUploads];

    if (finalImages.length === 0) {
      return res
        .status(400)
        .json({ message: 'A project must have at least one image.' });
    }

    // Identify and delete images removed by the user
    const publicIdsToDelete = project.images
      .map((img) => img.public_id)
      .filter(
        (publicId) =>
          publicId && !finalImages.some((img) => img.public_id === publicId)
      );

    for (const publicId of publicIdsToDelete) {
      try {
        await cloudinary.uploader.destroy(publicId);
        logger.info(`Deleted image from Cloudinary: ${publicId}`);
      } catch (deleteError) {
        logger.error({ err: deleteError }, `Error deleting image ${publicId} from Cloudinary`);
      }
    }
    // --- End Image Handling ---

    // Apply updates
    Object.assign(project, updateFields);
    project.images = finalImages; // Assign the processed images

    const updatedProject = await project.save();
    res.status(200).json(updatedProject);
  } catch (error) {
    logger.error({ err: error }, 'Error in updateProject controller');
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: 'Project validation failed', errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const delProject = async (req, res) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid Project ID format.' });
  }

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    for (const image of project.images) {
      if (image.public_id) {
        await cloudinary.uploader.destroy(image.public_id);
        logger.info(`Deleted image from Cloudinary: ${image.public_id}`);
      }
    }

    await Project.deleteOne({ _id: projectId });

    res.status(200).json({ message: 'Project deleted successfully.' });
  } catch (error) {
    logger.error({ err: error }, 'Error in delProject controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

