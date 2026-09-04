import cloudinary from '../lib/cloudinary.js';
import { logger } from '../lib/logger.js';

/**
 * Image storage, behind an interface.
 *
 * The admin controllers had Cloudinary calls inlined in four places with
 * slightly different handling each time, which made the catalog write path
 * impossible to test without live credentials. Injecting this means the
 * business logic is covered and only the two calls below are not.
 */
export const cloudinaryStore = {
  async upload(base64, folder) {
    const response = await cloudinary.uploader.upload(base64, { folder });
    return { url: response.secure_url, publicId: response.public_id };
  },

  async destroy(publicId) {
    await cloudinary.uploader.destroy(publicId);
  },
};

/**
 * Deleting an orphaned image must never fail the request that triggered it.
 *
 * The record is already updated by then; a Cloudinary outage should leave a
 * stray file and a log line, not a 500 and a half-applied edit.
 */
export const destroyQuietly = async (store, publicId) => {
  if (!publicId) return false;
  try {
    await store.destroy(publicId);
    logger.info({ publicId }, 'Deleted image from storage');
    return true;
  } catch (err) {
    logger.error({ err, publicId }, 'Could not delete image from storage');
    return false;
  }
};
