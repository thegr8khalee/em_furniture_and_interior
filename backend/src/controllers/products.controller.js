import mongoose from "mongoose";
import Product from "../models/product.model.js";

export const getProducts = async (req, res) => {
    try {
        // Implement filtering, sorting, pagination based on req.query if needed
        // For now, fetching all products
        const products = await Product.find({})
            .populate('collectionId', 'name'); // Optionally populate collection name

        res.status(200).json(products);
    } catch (error) {
        console.error('Error in getProducts controller: ', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getProductById = async (req, res) => {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        const product = await Product.findById(productId)
            .populate('collectionId', 'name') // Optionally populate collection name
            .populate('reviews.userId', 'username'); // Populate username for reviews

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Error in getProductById controller: ', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};