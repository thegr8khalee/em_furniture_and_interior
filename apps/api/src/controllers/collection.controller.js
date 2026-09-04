import { logger } from '../lib/logger.js';
import {
  listCollections,
  countCollections,
  getCollection,
  isValidId,
} from '../services/catalog.js';

export const getCollections = async (req, res) => {
  try {
    res.status(200).json(await listCollections(req.query));
  } catch (error) {
    logger.error({ err: error }, 'Error in getCollections controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCollectionsCount = async (req, res) => {
  try {
    res.status(200).json({ totalCollections: await countCollections() });
  } catch (error) {
    logger.error({ err: error }, 'Error in getCollectionsCount controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCollectionById = async (req, res) => {
  const { collectionId } = req.params;

  if (!isValidId(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }

  try {
    const collection = await getCollection(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }
    res.status(200).json(collection);
  } catch (error) {
    logger.error({ err: error }, 'Error in getCollectionById controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
