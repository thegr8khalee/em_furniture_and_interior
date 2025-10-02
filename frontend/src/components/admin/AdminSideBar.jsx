// src/components/Admin/AdminSidebar.jsx
import React from 'react';
import { useAuthStore } from '../../store/useAuthStore'; // For logout functionality
import { X } from 'lucide-react';

const AdminSidebar = ({
  activeSection,
  setActiveSection,
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  const logout = useAuthStore((state) => state.logout);

  const navItems = [
    { id: 'dashboard', name: 'Dashboard Overview' },
    { id: 'products', name: 'Manage Products' },
    { id: 'collections', name: 'Manage Collections' },
    { id: 'projects', name: 'Manage Projects' },
  ];

  // Function to handle navigation item click and close sidebar on mobile
  const handleNavigationClick = (sectionId) => {
    setActiveSection(sectionId);
    // Always call setIsSidebarOpen (which is closeSidebar from the store)
    // This ensures the sidebar closes regardless of screen size if a nav item is clicked.
    setIsSidebarOpen(false); // Call the passed setter to close the sidebar
  };

  return (
    <div
      className={`
                fixed inset-y-0 left-0 z-50
                w-80 bg-base-300 p-6 shadow-lg flex flex-col justify-between
                transform transition-transform duration-300 ease-in-out
                lg:relative lg:translate-x-0 lg:rounded-r-lg lg:shadow-lg
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
    >
      {/* NEW: Close button for mobile */}
      <div className="lg:hidden absolute top-4 right-4">
        <button
          className="btn btn-ghost btn-circle"
          onClick={() => setIsSidebarOpen(false)} // Call the passed setter to close
          aria-label="Close sidebar"
        >
          <X size={24} />
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-8 mt-4 lg:mt-0 font-['poppins']">
          Admin Panel
        </h2>
        <ul className="menu rounded-box text-xl">
          {navItems.map((item) => (
            <li key={item.id}>
              <a
                className={
                  activeSection === item.id ? 'active font-semibold' : ''
                }
                onClick={() => handleNavigationClick(item.id)}
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8">
        <button
          onClick={logout}
          className="btn btn-error btn-block rounded-full shadow-md"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
