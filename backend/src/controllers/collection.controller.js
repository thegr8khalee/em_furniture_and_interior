import mongoose from "mongoose";
import Collection from "../models/collection.model.js";


export const getCollections = async (req, res) => {
  try {
    // Implement filtering, sorting, pagination based on req.query if needed
    // For now, fetching all collections
    const collections = await Collection.find({}).populate(
      'productIds',
      'name price images'
    ); // Optionally populate product details

    res.status(200).json(collections);
  } catch (error) {
    console.error('Error in getCollections controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCollectionById = async (req, res) => {
  const { collectionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }

  try {
    const collection = await Collection.findById(collectionId)
      .populate('productIds', 'name description price images') // Populate product details
      .populate('reviews.userId', 'username'); // Populate username for reviews

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    // console.log(collection)

    res.status(200).json(collection);
  } catch (error) {
    console.error('Error in getCollectionById controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
