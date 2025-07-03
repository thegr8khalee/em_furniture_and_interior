// src/components/Admin/CollectionManagement.jsx
import React, { useState, useEffect } from 'react';
// import axiosInstance from '../../utils/axiosInstance'; // For API calls
// import { toast } from 'react-toastify'; // For notifications

const CollectionManagement = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false); // For Add/Edit Collection Modal
    const [editingCollection, setEditingCollection] = useState(null); // Collection being edited

    // useEffect(() => {
    //     const fetchCollections = async () => {
    //         setLoading(true);
    //         setError(null);
    //         try {
    //             const response = await axiosInstance.get('/collections'); // Assuming admin can get all collections
    //             setCollections(response.data);
    //         } catch (err) {
    //             console.error('Error fetching collections:', err);
    //             setError('Failed to load collections.');
    //             toast.error('Failed to load collections.');
    //         } finally {
    //             setLoading(false);
    //         }
    //     };
    //     fetchCollections();
    // }, []);

    const handleAddCollection = () => {
        setEditingCollection(null); // Clear any editing state
        setIsModalOpen(true);
    };

    const handleEditCollection = (collection) => {
        setEditingCollection(collection);
        setIsModalOpen(true);
    };

    const handleDeleteCollection = async (collectionId) => {
        // if (window.confirm('Are you sure you want to delete this collection?')) { // Replace with custom modal
        //     try {
        //         await axiosInstance.delete(`/collections/${collectionId}`);
        //         setCollections(collections.filter(c => c._id !== collectionId));
        //         toast.success('Collection deleted successfully!');
        //     } catch (err) {
        //         console.error('Error deleting collection:', err);
        //         toast.error('Failed to delete collection.');
        //     }
        // }
        console.log(`Deleting collection with ID: ${collectionId}`);
    };

    // Placeholder for a CollectionForm component (to be created)
    const CollectionForm = ({ collection, onClose, onSave }) => {
        // This component would contain the form for adding/editing collections
        // It would take 'collection' prop for editing, 'onClose' to close modal, 'onSave' to handle submission
        return (
            <div className="modal modal-open"> {/* DaisyUI modal */}
                <div className="modal-box">
                    <h3 className="font-bold text-lg">{collection ? 'Edit Collection' : 'Add New Collection'}</h3>
                    {/* Your collection form fields go here */}
                    <p className="py-4">Form fields for collection name, description, price, product IDs etc.</p>
                    <div className="modal-action">
                        <button className="btn" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={onSave}>Save</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className=''>
            <h2 className="text-3xl font-semibold mb-6 text-secondary font-[poppins]">Manage Collections</h2>
            <button className="w-full btn btn-primary mb-6 rounded-md text-secondary border-none shadow-none" onClick={handleAddCollection}>Add New Collection</button>

            {loading && <p>Loading collections...</p>}
            {error && <p className="text-error">{error}</p>}

            <div className="overflow-x-auto">
                <table className="table w-full">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Price</th>
                            <th>Products Count</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {collections.length === 0 && !loading && !error && (
                            <tr>
                                <td colSpan="4" className="text-center">No collections found.</td>
                            </tr>
                        )}
                        {collections.map((collection) => (
                            <tr key={collection._id}>
                                <td>{collection.name}</td>
                                <td>${collection.price.toFixed(2)}</td>
                                <td>{collection.productIds ? collection.productIds.length : 0}</td>
                                <td>
                                    <button
                                        className="btn btn-sm btn-warning mr-2 rounded-md"
                                        onClick={() => handleEditCollection(collection)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-sm btn-error rounded-md"
                                        onClick={() => handleDeleteCollection(collection._id)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <CollectionForm
                    collection={editingCollection}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => {
                        // Logic to save/update collection and then close modal and refresh list
                        setIsModalOpen(false);
                        // fetchCollections(); // Re-fetch collections after save
                    }}
                />
            )}
        </div>
    );
};

export default CollectionManagement;
