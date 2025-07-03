// src/components/Navbar.jsx
import {
    HeartIcon,
    MenuIcon, // For mobile drawer and admin sidebar toggle
    SearchIcon,
    ShoppingCart,
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom'; // Assuming you use Link for navigation
import LogoLightMode from '../images/LogoLightMode.png'; // Assuming correct path
// import LogoDarkMode from '../assets/images/logoDarkMode.png'; // If you have a dark mode logo

import { useAuthStore } from '../store/useAuthStore'; // Import auth store to check admin status
import { useAdminStore } from '../store/useAdminStore'; // Import new admin dashboard UI store

const Navbar = () => {
    const { authUser, isAdmin } = useAuthStore(); // Get auth status and admin role
    const { toggleSidebar, closeSidebar } = useAdminStore(); // Get sidebar toggle action

    // Determine if the general mobile drawer checkbox should be checked
    // This is for the existing mobile drawer in Navbar, not the admin sidebar.
    const handleDrawerCheckboxChange = (e) => {
        // If the general mobile drawer is opened, ensure admin sidebar is closed
        if (e.target.checked) {
            closeSidebar(); // Close admin sidebar if user opens general mobile drawer
        }
    };

    return (
        <div className="">
            {/* Mobile View Navbar (visible on lg screens and smaller) */}
            {/* This drawer is for general site navigation, separate from admin sidebar */}
            <div className="lg:hidden drawer drawer-start z-30"> {/* Adjusted z-index */}
                <input
                    id="my-drawer"
                    type="checkbox"
                    className="drawer-toggle"
                    onChange={handleDrawerCheckboxChange}
                />
                <div className="px-4 navbar bg-base-100 items-center fixed w-full top-0 z-20 drawer-content"> {/* Adjusted z-index */}
                    <div className="navbar-start">
                        {/* Conditional rendering for the MenuIcon:
                            - If isAdmin, it toggles the AdminSidebar.
                            - Otherwise, it toggles the general mobile drawer.
                        */}
                        {isAdmin ? (
                            <button
                                className="btn bg-base-100 border-none"
                                onClick={toggleSidebar} // Toggle admin sidebar
                                aria-label="Toggle admin sidebar"
                            >
                                <MenuIcon />
                            </button>
                        ) : (
                            <label
                                htmlFor="my-drawer"
                                className="btn bg-base-100 border-none drawer-button"
                                aria-label="Open main menu"
                            >
                                <MenuIcon />
                            </label>
                        )}
                    </div>
                    <div className="navbar-center">
                        <Link to="/"> {/* Use Link for navigation */}
                            <img src={LogoLightMode} alt="Logo" className="h-10" />
                            {/* <img src={LogoDarkMode} alt="Logo" className="h-10 hidden dark:flex" /> */}
                        </Link>
                    </div>
                    <div className="navbar-end">
                        <button className="btn bg-base-100 border-none btn-ghost"> {/* Added btn-ghost */}
                            <SearchIcon />
                        </button>
                    </div>
                </div>
                <div className="drawer-side z-40"> {/* Adjusted z-index */}
                    <label
                        htmlFor="my-drawer"
                        aria-label="close sidebar"
                        className="drawer-overlay"
                    ></label>
                    <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
                        {/* Sidebar content here for general users */}
                        <li><Link to="/orders" className="btn btn-xl border-0 justify-start">Orders</Link></li>
                        <li><Link to="/menus" className="btn btn-xl border-0 justify-start">Menus</Link></li>
                        <li><Link to="/settings" className="btn btn-xl border-0 justify-start">Settings</Link></li>
                        {/* Add other general navigation links */}
                        <li><Link to="/cart" className="btn btn-xl border-0 justify-start">Cart <ShoppingCart size={20} /></Link></li>
                        <li><Link to="/wishlist" className="btn btn-xl border-0 justify-start">Wishlist <HeartIcon size={20} /></Link></li>
                        <li><Link to="/login" className="btn btn-xl border-0 justify-start">Login</Link></li>
                        <li><Link to="/signup" className="btn btn-xl border-0 justify-start">Signup</Link></li>
                    </ul>
                </div>
            </div>

            {/* Desktop View Navbar (hidden on lg screens and smaller) */}
            <div className="hidden lg:flex navbar bg-base-100 shadow-sm">
                <div className="navbar-start">
                    {/* Admin sidebar toggle for desktop (optional, if you want a desktop toggle here too) */}
                    {/* {isAdmin && (
                        <button
                            className="btn btn-ghost btn-circle mr-2"
                            onClick={toggleSidebar}
                            aria-label="Toggle admin sidebar"
                        >
                            <MenuIcon />
                        </button>
                    )} */}
                    <Link to="/">
                        <img src={LogoLightMode} alt="Logo" className="h-10" />
                        {/* <img src={LogoDarkMode} alt="Logo" className="h-10 hidden dark:flex" /> */}
                    </Link>
                </div>
                <div className="navbar-center">
                    <Link to="/" className="btn bg-base-100 border-0 shadow-none btn-ghost">Home</Link>
                    <Link to="/shop" className="btn bg-base-100 border-0 shadow-none btn-ghost">Shop</Link>
                    <Link to="/e-catalog" className="btn bg-base-100 border-0 shadow-none btn-ghost">E-Catalog</Link>
                    <Link to="/showroom" className="btn bg-base-100 border-0 shadow-none btn-ghost">Showroom</Link>
                    <Link to="/about-us" className="btn bg-base-100 border-0 shadow-none btn-ghost">About Us</Link>
                </div>
                <div className="navbar-end space-x-2">
                    {authUser ? (
                        <>
                            <Link to="/my-account" className="btn btn-ghost">My Account</Link>
                            <button onClick={useAuthStore.getState().logout} className="btn btn-ghost">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-ghost">Login</Link>
                            <Link to="/signup" className="btn btn-ghost">Signup</Link>
                        </>
                    )}
                    <button className="btn btn-ghost">
                        <SearchIcon />
                    </button>
                    <Link to="/cart" className="btn btn-ghost">
                        <ShoppingCart />
                    </Link>
                    <Link to="/wishlist" className="btn btn-ghost">
                        <HeartIcon />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Navbar;
