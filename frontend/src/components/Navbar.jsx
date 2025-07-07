// src/components/Navbar.jsx
import {
  HeartIcon,
  MenuIcon, // For mobile drawer and admin sidebar toggle
  SearchIcon,
  ShoppingCart,
  UserIcon, // For profile link
  X, // NEW: Import X icon for close button
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoLightMode from '../images/LogoLightMode.png';

import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
// import { useProductsStore } from '../store/useProductsStore'; // No longer needed if categories are hardcoded here

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/admin/dashboard';
  const { authUser, isAdmin } = useAuthStore();
  const { toggleSidebar, closeSidebar: closeAdminSidebar } = useAdminStore();
  const { cart } = useCartStore();
  const { wishlist } = useWishlistStore();

  // Hardcoded categories (moved from useProductsStore import)
  const uniqueCategories = [
    { id: '1', name: 'Sofas', link: 'Living%20Room' },
    { id: '2', name: 'Armchairs', link: 'Armchair' },
    { id: '3', name: 'Living Rooms', link: 'Living%20Room' },
    { id: '4', name: 'Bedrooms', link: 'Bedroom' },
    { id: '5', name: 'Dining Rooms', link: 'Dining%20Room' },
    { id: '6', name: 'Center Tables', link: 'Center%20Table' },
    { id: '7', name: 'Wardrobe', link: 'Wardrobe' },
    { id: '8', name: 'TV Unit', link: 'TV%20unit' },
    { id: '9', name: 'Carpets', link: 'Carpet' },
  ];

  const [isDrawerChecked, setIsDrawerChecked] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('categories');

  // Hardcoded styles for the drawer switch
  const hardcodedStyles = [
    'Modern',
    'Contemporary',
    'Antique/Royal',
    'Bespoke',
    'Minimalist',
    'Glam',
  ].sort();

  const closeDrawer = () => {
    setIsDrawerChecked(false);
  };

  const handleDrawerCheckboxChange = (e) => {
    setIsDrawerChecked(e.target.checked);
    if (e.target.checked) {
      closeAdminSidebar();
    }
  };

  const handleCategoryLinkClick = (categoryLink) => {
    // Changed parameter name to avoid confusion
    navigate(`/shop?category=${categoryLink}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
    closeDrawer();
  };

  const handleStyleLinkClick = (styleName) => {
    navigate(`/styles/${encodeURIComponent(styleName)}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
    closeDrawer();
  };

  const handleMobileSearchClick = () => {
    navigate('/shop', { state: { focusSearch: true } });
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
    closeDrawer();
  };

  const handleDesktopSearchClick = () => {
    navigate('/shop', { state: { focusSearch: true } });
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleCartClick = () => {
    navigate('/cart');
  };

  return (
    <div className="">
      {/* Mobile View Navbar (visible on lg screens and smaller) */}
      <div className="lg:hidden flex drawer drawer-start z-30">
        <input
          id="my-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={isDrawerChecked}
          onChange={handleDrawerCheckboxChange}
        />
        <div className="px-4 fixed navbar bg-base-100 items-center w-full top-0 z-20 drawer-content">
          <div className="navbar-start">
            {isAdmin && isDashboard ? (
              <button
                className="btn bg-base-100 border-none"
                onClick={toggleSidebar}
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
            <Link to="/" onClick={closeDrawer}>
              <img src={LogoLightMode} alt="Logo" className="h-10" />
            </Link>
          </div>
          <div className="navbar-end">
            <button
              className="btn bg-base-100 border-none btn-ghost"
              onClick={handleMobileSearchClick}
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </div>
        </div>
        <div className="drawer-side z-40">
          <label
            htmlFor="my-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={closeDrawer}
          ></label>
          <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            {/* Close Button */}
            <li className="flex justify-end p-2">
              <button
                onClick={closeDrawer}
                className="btn btn-ghost btn-circle"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </li>

            {/* Categories/Styles Switch */}
            <li className="mb-4">
              <div className="tabs tabs-boxed w-full">
                <button
                  className={`tab flex-1 ${
                    activeDrawerTab === 'categories' ? 'tab-active' : ''
                  }`}
                  onClick={() => setActiveDrawerTab('categories')}
                >
                  Categories
                </button>
                <button
                  className={`tab flex-1 ${
                    activeDrawerTab === 'styles' ? 'tab-active' : ''
                  }`}
                  onClick={() => setActiveDrawerTab('styles')}
                >
                  Styles
                </button>
              </div>
            </li>

            {/* Conditional Rendering based on activeDrawerTab */}
            {activeDrawerTab === 'categories' ? (
              <>
                <li>
                  <Link
                    to="/"
                    className="btn btn-lg font-normal border-0 justify-start"
                    onClick={closeDrawer}
                  >
                    Home
                  </Link>
                </li>
                {uniqueCategories.map((category) => (
                  <li key={category.id}>
                    {' '}
                    {/* FIX: Added key prop */}
                    <button
                      onClick={() => handleCategoryLinkClick(category.link)}
                      className="btn  font-normal btn-lg border-0 justify-start"
                    >
                      {category.name} {/* FIX: Render category.name */}
                    </button>
                  </li>
                ))}
              </>
            ) : (
              <>
                <li>
                  <Link
                    to="/"
                    className="btn font-normal btn-lg border-0 justify-start"
                    onClick={closeDrawer}
                  >
                    Home
                  </Link>
                </li>
                {hardcodedStyles.map((style) => (
                  <li key={style}>
                    <button
                      onClick={() => handleStyleLinkClick(style)}
                      className="btn font-normal btn-lg border-0 justify-start"
                    >
                      {style}
                    </button>
                  </li>
                ))}
              </>
            )}

            {/* Other general navigation links (always visible) */}
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
              {isAdmin && (
                <Link to="/admin/dashboard" className="btn btn-ghost">
                  Admin Dashboard
                </Link>
              )}
              <Link to="/profile" className="btn btn-ghost">
                My Account
              </Link>
            </>
          ) : (
            <>
              <Link to="/profile" className="btn btn-ghost">
                Login
              </Link>
              <Link to="/signup" className="btn btn-ghost">
                Signup
              </Link>
            </>
          )}
          <button
            className="btn btn-ghost"
            onClick={handleDesktopSearchClick}
            aria-label="Search"
          >
            <SearchIcon />
          </button>
          <button
            className="relative btn btn-ghost"
            onClick={() => handleCartClick()}
          >
            {cart.length !== 0 ? (
              <div className="absolute right-1 top-0 bg-red-500 text-xs w-4 h-4 rounded-full flex justify-center items-center">
                {cart.length}
              </div>
            ) : null}
            <ShoppingCart />
          </button>
          <button className="relative btn btn-ghost">
            {wishlist.length !== 0 ? (
              <div className="absolute top-0 right-1 bg-red-500 text-xs w-4 h-4 rounded-full flex justify-center items-center">
                {wishlist.length}
              </div>
            ) : null}
            <HeartIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
