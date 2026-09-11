import jwt from 'jsonwebtoken';
import { generateToken } from '../lib/utils.js'; // Re-use the same token generation utility
import { logger } from '../lib/logger.js';
import { getCookieOptions, getClearCookieOptions } from '../lib/cookies.js';
import { signInStaffWithSupabase } from '../services/supabaseAuth.js';
import {
  IdentityError,
  authenticateStaff,
  findStaffById,
  registerStaff,
} from '../services/identity.js';
import {
  CatalogError,
  createProduct,
  updateProduct as updateCatalogProduct,
  deleteProduct as deleteCatalogProduct,
  createCollection,
  updateCollection as updateCatalogCollection,
  deleteCollection as deleteCatalogCollection,
} from '../services/catalogAdmin.js';
import {
  ContentError,
  createProject,
  deleteProject as deleteProjectRow,
  updateProject as updateProjectRow,
} from '../services/content.js';

/*
 * Operator authentication. The account lives in `staff`; the credential work is
 * in services/identity.js, alongside the shopper's. These are the HTTP shell.
 */
const handleIdentityError = (error, res, where) => {
  if (error instanceof IdentityError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where} controller`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

const cookieOptions = () => getCookieOptions();

/**
 * Creates another operator. Reachable only by an operator who already holds
 * `admin.dashboard.view`, which is what stops this being an open door into the
 * console; the first account is created by `npm run bootstrap:staff`.
 *
 * It no longer signs the caller in as the account it just created. Doing so
 * ended the session of whoever was creating the account — an owner adding a
 * support user was silently demoted to that support user's permissions.
 */
export const adminSignup = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const staff = await registerStaff({ username, email, password, role });

    res.status(201).json({ ...staff, message: 'Admin registered successfully.' });
  } catch (error) {
    handleIdentityError(error, res, 'adminSignup');
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await authenticateStaff(email, password);
    generateToken(staff.id, res, 'admin');

    res.status(200).json({ ...staff, message: 'Admin logged in successfully.' });
  } catch (error) {
    handleIdentityError(error, res, 'adminLogin');
  }
};

/**
 * Signs an operator in with a Supabase access token.
 *
 * The same exchange the shopper side does, with one difference that matters:
 * this never creates an operator. A console account carries a role and a
 * permission set, so provisioning one from a successful Supabase sign-in would
 * make anyone who can sign up to the project a member of staff. An operator is
 * created by `npm run bootstrap:staff` or by someone holding `staff.manage`;
 * this only links the identity to the account that already exists.
 */
export const adminSupabaseSession = async (req, res) => {
  try {
    const accessToken =
      req.body?.accessToken || (req.headers.authorization || '').replace(/^Bearer /i, '');

    const staff = await signInStaffWithSupabase(accessToken);
    generateToken(staff.id, res, 'admin');

    res.status(200).json({ ...staff, message: 'Admin logged in successfully.' });
  } catch (error) {
    handleIdentityError(error, res, 'adminSupabaseSession');
  }
};

export const checkAdminAuth = async (req, res) => {
  try {
    const token = req.cookies.admin_jwt || req.cookies.jwt;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated: No admin token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      res.clearCookie('admin_jwt', cookieOptions());
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({ message: 'Not authenticated: Invalid or expired admin token.' });
    }

    if (decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Not authenticated: Token is not an admin token.' });
    }

    const principal = await findStaffById(decoded.userId);
    if (!principal) {
      res.clearCookie('admin_jwt', cookieOptions());
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({
        message: 'Not authenticated: Admin account not found in database.',
      });
    }

    if (principal.isActive === false) {
      res.clearCookie('admin_jwt', cookieOptions());
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({ message: 'Not authenticated: This account has been deactivated.' });
    }

    return res.status(200).json({ ...principal, role: 'admin' });
  } catch (error) {
    return handleIdentityError(error, res, 'checkAdminAuth');
  }
};

export const adminLogout = (req, res) => {
  res.cookie('admin_jwt', '', { ...cookieOptions(), maxAge: 0 });
  res.cookie('jwt', '', { ...cookieOptions(), maxAge: 0 });
  res.status(200).json({ message: 'Admin logged out successfully.' });
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
  if (error instanceof CatalogError || error instanceof ContentError) {
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
  try {
    res.status(201).json(await createProject(req.body));
  } catch (error) {
    handleCatalogError(error, res, 'addProject');
  }
};

export const updateProject = async (req, res) => {
  try {
    res.status(200).json(await updateProjectRow(req.params.projectId, req.body));
  } catch (error) {
    handleCatalogError(error, res, 'updateProject');
  }
};

export const delProject = async (req, res) => {
  try {
    if (!(await deleteProjectRow(req.params.projectId))) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    res.status(200).json({ message: 'Project deleted successfully.' });
  } catch (error) {
    handleCatalogError(error, res, 'delProject');
  }
};
