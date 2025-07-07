// src/components/Navbar.jsx
import {
  HeartIcon,
  MenuIcon, // For mobile drawer and admin sidebar toggle
  SearchIcon,
  ShoppingCart,
} from 'lucide-react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Assuming you use Link for navigation
import LogoLightMode from '../images/LogoLightMode.png'; // Assuming correct path
// import LogoDarkMode from '../assets/images/logoDarkMode.png'; // If you have a dark mode logo

import { useAuthStore } from '../store/useAuthStore'; // Import auth store to check admin status
import { useAdminStore } from '../store/useAdminStore'; // Import new admin dashboard UI store

const Navbar = () => {
  const isDashboard = location.pathname === '/admin/dashboard';
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

  const navigate = useNavigate();

  const handleMobileSearchClick = () => {
    navigate('/shop', { state: { focusSearch: true } }); // Navigate and pass state
    closeSidebar(); // Close the mobile drawer if it's open
  };

  return (
    <div className="">
      {/* Mobile View Navbar (visible on lg screens and smaller) */}
      <div className="lg:hidden flex drawer drawer-start z-30">
        <input
          id="my-drawer"
          type="checkbox"
          className="drawer-toggle"
          onChange={handleDrawerCheckboxChange}
        />
        <div className="px-4 fixed navbar bg-base-100 items-center w-full top-0 z-20 drawer-content">
          {' '}
          {/* Adjusted z-index */}
          <div className="navbar-start">
            {/* Conditional rendering for the MenuIcon:
                            - If isAdmin, it toggles the AdminSidebar.
                            - Otherwise, it toggles the general mobile drawer.
                        */}
            {isAdmin && isDashboard ? (
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
            <Link to="/">
              {' '}
              {/* Use Link for navigation */}
              <img src={LogoLightMode} alt="Logo" className="h-10" />
              {/* <img src={LogoDarkMode} alt="Logo" className="h-10 hidden dark:flex" /> */}
            </Link>
          </div>
          <div className="navbar-end">
            <button
              className="btn bg-base-100 border-none btn-ghost"
              onClick={handleMobileSearchClick}
              aria-label="Search"
            >
              {' '}
              {/* Added btn-ghost */}
              <SearchIcon />
            </button>
          </div>
        </div>
        <div className="drawer-side z-40">
          {' '}
          {/* Adjusted z-index */}
          <label
            htmlFor="my-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
          ></label>
          <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            <li>
              <Link to="/" className="btn btn-xl border-0 justify-start">
                Home
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Sofas
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Armchairs
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Living Rooms
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Bed Rooms
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Dining Rooms
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Center Tables
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Wardrobes
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                TV Units
              </Link>
            </li>
            <li>
              <Link to="/menus" className="btn btn-xl border-0 justify-start">
                Carpets
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Desktop View Navbar (hidden on lg screens and smaller) */}
      <div className="hidden lg:flex fixed navbar bg-base-100 shadow-sm z-100">
        <div className="navbar-start">
          <Link to="/">
            <img src={LogoLightMode} alt="Logo" className="h-10" />
          </Link>
        </div>
        <div className="navbar-center">
          <Link
            to="/"
            className="btn bg-base-100 border-0 shadow-none btn-ghost"
          >
            Home
          </Link>
          <Link
            to="/shop"
            className="btn bg-base-100 border-0 shadow-none btn-ghost"
          >
            Shop
          </Link>
          <Link
            to="/e-catalog"
            className="btn bg-base-100 border-0 shadow-none btn-ghost"
          >
            E-Catalog
          </Link>
          <Link
            to="/showroom"
            className="btn bg-base-100 border-0 shadow-none btn-ghost"
          >
            Showroom
          </Link>
          <Link
            to="/about-us"
            className="btn bg-base-100 border-0 shadow-none btn-ghost"
          >
            About Us
          </Link>
        </div>
        <div className="navbar-end space-x-2">
          {authUser ? (
            <>
              <Link to="/profile" className="btn bg-base-100 border-none btn-ghost">
                My Account
              </Link>
              <button
                onClick={useAuthStore.getState().logout}
                className="btn bg-base-100 border-none btn-ghost"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/profile" className="btn bg-base-100 border-none btn-ghost">
                Login
              </Link>
              <Link to="/signup" className="btn bg-base-100 border-none btn-ghost">
                Signup
              </Link>
            </>
          )}
          <button className="btn bg-base-100 border-none btn-ghost"
          onClick={handleMobileSearchClick}>
            <SearchIcon />
          </button>
          <Link to="/cart" className="btn bg-base-100 border-none btn-ghost">
            <ShoppingCart />
          </Link>
          <Link to="/wishlist" className="btn bg-base-100 border-none btn-ghost">
            <HeartIcon />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
