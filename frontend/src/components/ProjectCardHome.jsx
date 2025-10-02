import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Info } from 'lucide-react';

const ProjectCardHome = ({ project }) => {
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
    <div className={`relative flex-shrink-0 aspect-[14/16] w-90 rounded-2xl overflow-hidden shadow-lg`}>
      <button
        className="relative w-full h-full rounded-2xl overflow-hidden shadow-md group cursor-pointer"
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Project Image */}
        <img
          src={project.images?.[0]?.url || '/placeholder-project.jpg'}
          alt={project.title}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
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
          <h3 className="text-lg font-bold font-[poppins] mb-2 line-clamp-2 text-left">
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
        <div
          className={`absolute inset-0 bg-black/80 p-4 flex items-center justify-center transition-all duration-300 hidden sm:flex ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-white text-center max-w-full">
            {/* Title on hover */}
            <h3 className="text-xl font-bold font-[poppins] mb-3 line-clamp-2">
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

            {/* Click to view indicator */}
            <div className="mt-3 text-xs opacity-75">Click to view details</div>
          </div>
        </div>

        {/* Mobile Details Overlay */}
        <div
          className={`absolute inset-0 bg-black/80 p-4 flex items-center justify-center transition-all duration-300 sm:hidden ${
            showMobileDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-white text-center max-w-full">
            {/* Title on mobile details */}
            <h3 className="text-xl font-bold font-[poppins] mb-3 line-clamp-2">
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
              Tap info button to close • Tap anywhere else to view project
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default ProjectCardHome;