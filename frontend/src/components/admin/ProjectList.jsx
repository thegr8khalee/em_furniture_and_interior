// src/components/AdminProjectListCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, Tag } from 'lucide-react'; // Using MapPin and Tag icons

// NOTE: We assume these stores exist and provide the necessary project functions
import { useAdminStore } from '../../store/useAdminStore';
import { useProjectsStore } from '../../store/useProjectsStore';

const AdminProjectListCard = ({ item }) => {
  // item is a Project object
  const [isDropDownOpen, setIsDropDownOpen] = React.useState(null);
  const [dropdownHeight, setDropdownHeight] = React.useState(0);
  const dropdownRef = React.useRef(null);

  // Assuming delProject and fetchProjectss are defined in your stores
  const { delProject } = useAdminStore();
  const { fetchProjectss } = useProjectsStore();

  React.useEffect(() => {
    if (dropdownRef.current) {
      setDropdownHeight(dropdownRef.current.scrollHeight);
    }
  }, [isDropDownOpen]);     

  const handleDropDownClick = (projectId) => {
    // Toggle dropdown open/close state based on project ID
    setIsDropDownOpen(projectId === isDropDownOpen ? null : projectId);
  };

  const navigate = useNavigate();

  // Route for editing a project
  const handleEdit = (id) => {
    // Adjusting route to match common resource naming: /admin/projects/edit/:id
    navigate(`/admin/editProject/${id}`);
  };

  const handleDelete = (id) => {
    // Delete Project logic
    window.confirm('Are you sure you want to delete this project?') &&
      delProject(id) // Assuming delProject is available in useAdminStore
        .then(() => {
          fetchProjectss({ page: 1, limit: 10 }); // Re-fetch list
        });
  };

  // Use item._id for unique key and dropdown toggle
  const itemId = item._id;

  return (
    <div className="rounded-xl bg-base-100 shadow-lg border border-base-200">
      <div className="w-full flex items-center justify-between p-3">
        {/* Image */}
        <figure className="flex-shrink-0">
          <img
            src={item.images?.[0]?.url || 'placeholder-project.jpg'}
            alt={item.title}
            className="w-24 h-20 object-cover rounded-lg shadow-sm"
          />
        </figure>

        {/* Project Details */}
        <div className="h-full flex flex-col space-y-1 p-1 w-full ml-3 flex-grow min-w-0">
          {/* Title */}
          <h2 className="font-semibold text-sm sm:text-lg font-[poppins] truncate">
            {item.title}
          </h2>

          {/* Location */}
          <p className="text-xs font-[inter] text-gray-500 flex items-center mt-1">
            <MapPin className="size-3 mr-1 text-info" />
            {item.location}
          </p>

          {/* Category */}
          <p className="text-xs font-[inter] text-gray-500 flex items-center">
            <Tag className="size-3 mr-1 text-warning" />
            {item.category}
          </p>

          {/* Price/Budget */}
          <p className="text-sm font-bold font-[inter] text-green-600 mt-1">
            Budget: ₦{Number(item.price).toLocaleString()}
          </p>
        </div>

        {/* Dropdown Toggle Button */}
        <button
          onClick={() => handleDropDownClick(itemId)}
          className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
        >
          <ChevronDown
            className={`size-5 text-gray-500 transition-transform duration-300 ease-in-out ${
              isDropDownOpen === itemId ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>
      </div>

      {/* Dropdown Content */}
      <div
        ref={dropdownRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isDropDownOpen === itemId ? `${dropdownHeight}px` : '0px',
          opacity: isDropDownOpen === itemId ? 1 : 0,
        }}
      >
        <div className="flex p-3 pt-0 border-t border-base-200">
          <button
            onClick={() => handleEdit(itemId)}
            className="btn-primary btn m-1 p-2 flex-1 rounded-full text-white font-semibold"
          >
            Edit Project
          </button>
          <button
            onClick={() => handleDelete(itemId)}
            className="btn-outline border-red-500 border-2 text-red-500 hover:bg-red-500 hover:text-white btn m-1 p-2 flex-1 rounded-full font-semibold"
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProjectListCard;
