// src/pages/ProjectDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Tag, DollarSign, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { luxuryEase } from '../lib/animations';
import { PageWrapper, SectionReveal, SlideIn } from '../components/animations';
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
                <p className="text-lg text-neutral/70 mb-6">
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
        <PageWrapper>
        <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto">
            {/* Back Button */}
            <button
                onClick={() => navigate(-1)} // Go back to the previous page
                className="btn btn-ghost mb-8 text-neutral/70 hover:text-neutral hover:bg-transparent -ml-3"
            >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
            </button>

            <div className="bg-white shadow-xl border border-base-200 p-8 lg:p-12">
                <motion.h1
                    className="text-3xl md:text-4xl font-heading font-semibold text-neutral mb-8 tracking-tight"
                    initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.7, ease: luxuryEase }}
                >
                    {project.title}
                </motion.h1>
                
                {/* --- Image Gallery Section --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    {/* Main Image */}
                    <div className="lg:col-span-2 relative max-h-[60vh] overflow-hidden shadow-lg border border-base-200">
                        {project.images && project.images.length > 0 ? (
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={mainImageIndex}
                                    src={project.images[mainImageIndex].url}
                                    alt={project.title}
                                    className="w-full h-full object-cover"
                                    initial={{ opacity: 0, scale: 1.04 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.5, ease: luxuryEase }}
                                />
                            </AnimatePresence>
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-neutral/60">
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
                                className={`w-24 h-24 lg:w-full lg:h-32 flex-shrink-0 cursor-pointer overflow-hidden border transition-all duration-200 ${
                                    index === mainImageIndex 
                                        ? 'border-secondary shadow-md' 
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
                    <SlideIn direction="left" className="lg:col-span-1">
                    <div className="p-8 bg-base-200/50 border border-base-300 h-fit">
                        <h3 className="text-xl font-heading font-semibold mb-6 text-neutral">Project Overview</h3>
                        
                        <div className="space-y-3">
                            {/* Location */}
                            <div className="flex items-center text-neutral/70">
                                <MapPin className="h-5 w-5 mr-3 text-secondary flex-shrink-0" />
                                <span className="font-semibold">Location:</span>
                                <span className="ml-2 truncate">{project.location}</span>
                            </div>

                            {/* Category */}
                            <div className="flex items-center text-neutral/70">
                                <Tag className="h-5 w-5 mr-3 text-secondary flex-shrink-0" />
                                <span className="font-semibold">Category:</span>
                                <span className="ml-2 truncate">{project.category}</span>
                            </div>

                            {/* Price / Budget */}
                            <div className="flex items-center text-neutral/70 border-t pt-3 mt-3 border-gray-300">
                                <DollarSign className="h-5 w-5 mr-3 text-secondary flex-shrink-0" />
                                <span className="font-semibold">Budget:</span>
                                <span className="ml-2 text-xl font-bold text-secondary">
                                    ₦{Number(project.price).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    </SlideIn>

                    {/* Description */}
                    <SlideIn direction="right" className="lg:col-span-2">
                        <h3 className="text-xl font-heading font-semibold mb-4 border-b border-base-300 pb-2 text-neutral">Scope of Work</h3>
                        <div 
                            className="prose max-w-none"
                            // Dangerously set inner HTML for the rich text description
                            dangerouslySetInnerHTML={{ __html: project.description }}
                        />
                    </SlideIn>
                </div>
            </div>
        </div>
        </PageWrapper>
    );
};

export default ProjectDetailPage;