// src/components/Navbar.jsx
import {
  HeartIcon,
  MenuIcon, // For mobile drawer and admin sidebar toggle
  SearchIcon,
  ShoppingCart,
  UserIcon, // For profile link
  X, // NEW: Import X icon for close button
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// import LogoLightMode from '../images/LogoLightMode.png';

import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
// import { useProductsStore } from '../store/useProductsStore'; // No longer needed if categories are hardcoded here

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/admin/dashboard';
  const { authUser, isAdmin, isAuthReady } = useAuthStore();
  const { toggleSidebar, closeSidebar: closeAdminSidebar } = useAdminStore();
  const { getCart, cart } = useCartStore();
  const { getwishlist, wishlist } = useWishlistStore();

  useEffect(() => {
    if (isAuthReady && !isAdmin) {
      getCart();
      getwishlist();
    }
  }, [getCart, getwishlist, isAuthReady, isAdmin]);

  // console.log(wishlist)

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
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleHeartClick = () => {
    navigate('/wishlist');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
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
        <div className="fixed navbar backdrop-blur-lg bg-base-100/80 items-center w-full top-0 z-20 drawer-content">
          <div className="navbar-start">
            {isAdmin && isDashboard ? (
              <button
                className="pl-4 border-none"
                onClick={toggleSidebar}
                aria-label="Toggle admin sidebar"
              >
                <MenuIcon />
              </button>
            ) : (
              <label
                htmlFor="my-drawer"
                className="pl-4 border-none drawer-button"
                aria-label="Open main menu"
              >
                <MenuIcon />
              </label>
            )}
          </div>
          <div className="navbar-center">
            <Link to="/" onClick={closeDrawer}>
              <img
                src={
                  'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/LogoLightMode_terjhk.png'
                }
                alt="Logo"
                className="h-10"
              />
            </Link>
          </div>
          <div className="navbar-end">
            <button
              className="pr-4 border-none btn-ghost"
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
          <ul className="menu bg-base-200 text-base-content min-h-full w-95 p-4">
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
            <div className="flex">
              <li>
                <Link
                  to="/"
                  className="btn btn-lg font-normal border-0 justify-start"
                  onClick={closeDrawer}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/e-catalog"
                  className="btn btn-lg font-normal border-0 justify-start"
                  onClick={closeDrawer}
                >
                  E-Catalogs
                </Link>
              </li>
              <li>
                <Link
                  to="/showroom"
                  className="btn btn-lg font-normal border-0 justify-start"
                  onClick={closeDrawer}
                >
                  Showroom
                </Link>
              </li>
            </div>

            {/* Categories/Styles Switch */}
            <li className="mb-4">
              <div className="tabs tabs-boxed w-full">
                <button
                  className={`btn border-0 tab flex-1 ${
                    activeDrawerTab === 'categories'
                      ? 'bg-primary tab-active'
                      : ''
                  }`}
                  onClick={() => setActiveDrawerTab('categories')}
                >
                  Categories
                </button>
                <button
                  className={`btn border-0 tab flex-1 ${
                    activeDrawerTab === 'styles' ? 'bg-primary tab-active' : ''
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
                {/* <li>
                  <Link
                    to="/"
                    className="btn btn-lg font-normal border-0 justify-start"
                    onClick={closeDrawer}
                  >
                    Home
                  </Link>
                </li> */}
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
                {/* <li>
                  <Link
                    to="/"
                    className="btn font-normal btn-lg border-0 justify-start"
                    onClick={closeDrawer}
                  >
                    Home
                  </Link>
                </li> */}
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
      <div className="hidden lg:flex fixed navbar backdrop-blur-lg bg-base-100/80 shadow-sm z-100">
        <div className="navbar-start">
          <Link to="/">
            <img
              src={
                'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/LogoLightMode_terjhk.png'
              }
              alt="Logo"
              className="h-10"
            />
          </Link>
        </div>
        <div className="navbar-center space-x-6">
          <Link to="/" className=" border-0 shadow-none btn-ghost">
            Home
          </Link>
          <Link to="/shop" className=" border-0 shadow-none btn-ghost">
            Shop
          </Link>
          <Link to="/e-catalog" className=" border-0 shadow-none btn-ghost">
            E-Catalog
          </Link>
          <Link to="/showroom" className=" border-0 shadow-none btn-ghost">
            Showroom
          </Link>
          <Link to="/aboutUs" className=" border-0 shadow-none btn-ghost">
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
          {!isAdmin ? (
            <div className="flex">
              <button
                className="relative btn btn-ghost"
                onClick={() => handleCartClick()}
              >
                {cart?.length !== 0 && cart !== null ? (
                  <div className="absolute right-1 top-0 bg-red-500 text-xs w-4 h-4 rounded-full flex justify-center items-center">
                    {cart?.length}
                  </div>
                ) : null}
                <ShoppingCart />
              </button>
              <button
                className="relative btn btn-ghost"
                onClick={() => handleHeartClick()}
              >
                {wishlist?.length !== 0 && wishlist !== null ? (
                  <div className="absolute top-0 right-1 bg-red-500 text-xs w-4 h-4 rounded-full flex justify-center items-center">
                    {wishlist?.length}
                  </div>
                ) : null}
                <HeartIcon />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
