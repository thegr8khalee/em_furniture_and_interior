// src/pages/ProjectDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Tag, DollarSign, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProjectsStore } from '../store/useProjectsStore';

const ProjectDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // State for image carousel/selection
    const [mainImageIndex, setMainImageIndex] = useState(0);

    // Fetching state and actions from the store
    const { 
        selectedProject, 
        loading, 
        error, 
        getProjectById, 
        clearSelectedProject 
    } = useProjectsStore();

    useEffect(() => {
        // Clear any previously selected project when navigating in
        clearSelectedProject(); 

        if (id) {
            getProjectById(id);
        }

        // Cleanup: Clear the selected project when the component unmounts
        return () => {
            clearSelectedProject();
        };
    }, [id, getProjectById, clearSelectedProject]);

    // Handle initial loading state
    if (loading && !selectedProject) {
        return (
            <div className="flex justify-center items-center min-h-[50vh] bg-base-100">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-4 text-xl">Loading project details...</p>
            </div>
        );
    }
    
    // Handle error state (e.g., project not found)
    if (error) {
        // Display toast error if a new error occurred
        if (error !== 'Could not load project.') {
            toast.error(error);
        }
        return (
            <div className="flex flex-col justify-center items-center min-h-[50vh] p-8 bg-base-100">
                <h1 className="text-3xl font-bold text-error mb-4">Project Not Found</h1>
                <p className="text-lg text-gray-600 mb-6">
                    We could not load the details for this project ID: **{id}**.
                </p>
                <button
                    onClick={() => navigate('/projects')} // Navigate back to a general projects page
                    className="btn btn-primary"
                >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Back to Projects
                </button>
            </div>
        );
    }

    // Handle case where state is cleared but loading finished (shouldn't happen with the current logic, but as a safeguard)
    if (!selectedProject) {
        return (
            <div className="flex justify-center items-center min-h-[50vh] p-8">
                <p className="text-lg">Project data is unavailable.</p>
            </div>
        );
    }

    const project = selectedProject;

    return (
        <div className="container max-w-5xl mx-auto p-4 md:p-8">
            {/* Back Button */}
            <button
                onClick={() => navigate(-1)} // Go back to the previous page
                className="btn btn-ghost mb-6 text-primary flex items-center"
            >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
            </button>

            <div className="bg-white rounded-xl shadow-2xl p-6 lg:p-10">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-6 font-[poppins]">{project.title}</h1>
                
                {/* --- Image Gallery Section --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    {/* Main Image */}
                    <div className="lg:col-span-2 relative rounded-lg max-h-[60vh] overflow-hidden shadow-xl">
                        {/* Fallback check for images */}
                        {project.images && project.images.length > 0 ? (
                            <img
                                src={project.images[mainImageIndex].url}
                                alt={project.title}
                                className="w-full h-full object-contain transition-opacity duration-300"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                                No image available
                            </div>
                        )}
                    </div>

                    {/* Thumbnail Gallery */}
                    <div className="lg:col-span-1 flex lg:flex-col space-x-3 lg:space-x-0 lg:space-y-3 overflow-x-auto lg:overflow-y-auto max-h-[400px] pb-4 lg:pb-0">
                        {project.images && project.images.map((image, index) => (
                            <div
                                key={image.public_id || index}
                                onClick={() => setMainImageIndex(index)}
                                className={`w-24 h-24 lg:w-full lg:h-32 flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                                    index === mainImageIndex 
                                        ? 'border-primary shadow-lg' 
                                        : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300'
                                }`}
                            >
                                <img
                                    src={image.url}
                                    alt={`Thumbnail ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- Project Info & Description Section --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Details Box */}
                    <div className="lg:col-span-1 p-6 bg-base-200 rounded-lg shadow-inner h-fit">
                        <h3 className="text-2xl font-bold mb-4 text-primary">Project Overview</h3>
                        
                        <div className="space-y-3">
                            {/* Location */}
                            <div className="flex items-center text-gray-700">
                                <MapPin className="h-5 w-5 mr-3 text-info flex-shrink-0" />
                                <span className="font-semibold">Location:</span>
                                <span className="ml-2 truncate">{project.location}</span>
                            </div>

                            {/* Category */}
                            <div className="flex items-center text-gray-700">
                                <Tag className="h-5 w-5 mr-3 text-warning flex-shrink-0" />
                                <span className="font-semibold">Category:</span>
                                <span className="ml-2 truncate">{project.category}</span>
                            </div>

                            {/* Price / Budget */}
                            <div className="flex items-center text-gray-700 border-t pt-3 mt-3 border-gray-300">
                                <DollarSign className="h-5 w-5 mr-3 text-success flex-shrink-0" />
                                <span className="font-semibold">Budget:</span>
                                <span className="ml-2 text-xl font-bold text-success">
                                    ₦{Number(project.price).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="lg:col-span-2">
                        <h3 className="text-2xl font-bold mb-4 border-b pb-2 text-gray-800">Scope of Work</h3>
                        <div 
                            className="prose max-w-none"
                            // Dangerously set inner HTML for the rich text description
                            dangerouslySetInnerHTML={{ __html: project.description }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailPage;