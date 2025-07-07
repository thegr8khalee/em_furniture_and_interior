// src/pages/AdminDashboard.jsx
import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore'; // To get admin user info
import AdminSidebar from '../components/admin/AdminSideBar'; // Sidebar for navigation
import AdminDashboardContent from '../components/admin/AdminDashboardContent'; // Default dashboard view
import ProductManagement from '../components/admin/ProductManagement'; // Component for product management
import CollectionManagement from '../components/admin/CollectionManagement'; // Component for collection management
import { Menu } from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';
// import UserManagement from '../components/Admin/UserManagement'; // Future: Component for user management
// import OrderManagement from '../components/Admin/OrderManagement'; // Future: Component for order management

const AdminDashboard = () => {
    const { authUser } = useAuthStore();
    const [activeSection, setActiveSection] = useState('dashboard');
    const { isSidebarOpen, closeSidebar } = useAdminStore(); // NEW: Get state and action from store

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return <AdminDashboardContent />;
            case 'products':
                return <ProductManagement />;
            case 'collections':
                return <CollectionManagement />;
            default:
                return <AdminDashboardContent />;
        }
    };

    // if (!authUser || authUser.role !== 'admin') {
    //     return (
    //         <div className="flex justify-center items-center min-h-screen text-xl font-semibold">
    //             Access Denied: You are not authorized to view this page.
    //         </div>
    //     );
    // }

    return (
        <div className="flex min-h-screen w-screen bg-base-300 lg:pt-16">
            {/* Removed: Mobile Hamburger Menu Button (now in Navbar) */}

            {/* NEW: Mobile Overlay - uses closeSidebar from store */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black opacity-20 z-40 lg:hidden"
                    onClick={closeSidebar} // Close sidebar using store action
                    aria-label="Close sidebar"
                ></div>
            )}

            {/* Admin Sidebar - Pass state and setter from store */}
            <AdminSidebar
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={closeSidebar} // Pass closeSidebar as setter
            />

            {/* Main Content Area */}
            <div className="w-screen pt-10 flex-1 p-4 lg:p-8">
                <h1 className="text-3xl lg:text-4xl font-bold mb-4 lg:mb-8 mt-12 lg:mt-0 font-['poppins']">
                    Welcome, {authUser.username || authUser.email}!
                </h1>
                <div className="bg-base-200 p-4 lg:p-6 rounded-lg shadow-xl">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
