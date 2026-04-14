import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { luxuryEase } from '../lib/animations';

const ProjectCard = ({ project }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/project/${project._id}`);
  };

  const handleMobileDetailsToggle = (e) => {
    e.stopPropagation(); // Prevent card navigation when clicking info button
    setShowMobileDetails(!showMobileDetails);
  };

  return (
    <motion.div
      className={`relative flex-shrink-0 aspect-[14/16] w-full rounded-none overflow-hidden shadow-lg`}
      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
      transition={{ duration: 0.4, ease: luxuryEase }}
    >
      <button
        className="relative w-full h-full rounded-none overflow-hidden shadow-md group cursor-pointer"
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Project Image */}
        <motion.img
          src={project.images?.[0]?.url || '/placeholder-project.jpg'}
          alt={project.title}
          className="object-cover w-full h-full"
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.6, ease: luxuryEase }}
        />

        {/* Dark Overlay for better text visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Mobile Info Button (visible only on touch devices) */}
        <button
          className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all duration-200 sm:hidden z-50"
          onClick={handleMobileDetailsToggle}
          title="View details"
        >
          <Info className="w-4 h-4 text-white" />
        </button>

        {/* Bottom Left Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          {/* Project Title */}
          <h3 className="text-lg font-bold font-heading mb-2 line-clamp-2 text-left">
            {project.title}
          </h3>

          {/* Location */}
          <div className="flex items-center mb-2 text-sm opacity-90">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="truncate">{project.location}</span>
          </div>

          {/* Budget */}
          <div className="text-sm font-semibold text-green-300">
            Budget: ₦{Number(project.price).toLocaleString()}
          </div>
        </div>

        {/* Desktop Hover Description Overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 bg-black/80 p-4 items-center justify-center hidden sm:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: luxuryEase }}
            >
              <div className="text-white text-center max-w-full">
                <motion.h3
                  className="text-xl font-bold font-heading mb-3 line-clamp-2"
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4, ease: luxuryEase }}
                >
                  {project.title}
                </motion.h3>

                <motion.p
                  className="text-sm leading-relaxed line-clamp-4 mb-3 opacity-90"
                  dangerouslySetInnerHTML={{ __html: project.description }}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4, ease: luxuryEase }}
                />

                <motion.div
                  className="inline-block px-3 py-1 bg-primary text-white text-xs font-medium rounded-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4, ease: luxuryEase }}
                >
                  {project.category}
                </motion.div>

                <motion.div
                  className="mt-3 text-xs opacity-75"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.75 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  Click to view details
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Details Overlay */}
        <div
          className={`absolute inset-0 bg-black/80 p-4 flex items-center justify-center transition-all duration-300 sm:hidden ${
            showMobileDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-white text-center max-w-full">
            {/* Title on mobile details */}
            <h3 className="text-xl font-bold font-heading mb-3 line-clamp-2">
              {project.title}
            </h3>

            {/* Description */}
            <p
              className="text-sm leading-relaxed line-clamp-4 mb-3 opacity-90"
              dangerouslySetInnerHTML={{ __html: project.description }}
            />

            {/* Category Badge */}
            <div className="inline-block px-3 py-1 bg-primary text-white text-xs font-medium rounded-full">
              {project.category}
            </div>

            {/* Tap to close indicator */}
            <div className="mt-3 text-xs opacity-75">
              Tap info button to close â€¢ Tap anywhere else to view project
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
};

export default ProjectCard;