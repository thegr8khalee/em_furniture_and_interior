// routes/adminAuthRoutes.js

import express from 'express';
import {
  addCollection,
  addProduct,
  adminLogin,
  adminLogout,
  adminSignup,
  delCollection,
  delProduct,
  updateCollection,
  updateProduct,
} from '../controllers/admin.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';

const router = express.Router();

router.post('/signup', adminSignup);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);

router.post('/operations/addProduct', protectAdminRoute, addProduct);
router.put(
  '/operations/updateProduct/:productId',
  protectAdminRoute,
  updateProduct
);
router.delete(
  '/operations/delProduct/:productId',
  protectAdminRoute,
  delProduct
);

router.post('/operations/addCollection', protectAdminRoute, addCollection);
router.put(
  '/operations/updateCollection/:collectionId',
  protectAdminRoute,
  updateCollection
);
router.delete(
  '/operations/delCollection/:collectionId',
  protectAdminRoute,
  delCollection
);

export default router;
