// src/components/Navbar.jsx
import {
  Bell,
  ChevronDown,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  ShoppingCart,
  UserIcon,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { luxuryEase } from '../lib/animations';

void motion;
import { Button } from './ui';

const getNavLinkClass = (isActive) =>
  `px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors border-b ${
    isActive
      ? 'border-secondary text-secondary'
      : 'border-transparent text-neutral/75 hover:text-secondary'
  }`;

const getIconButtonClass = (hasItems = false) =>
  `relative h-9 w-9 ${
    hasItems ? 'border-secondary/40 text-secondary' : 'border-base-300 text-neutral/75'
  }`;

import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useMarketingStore } from '../store/useMarketingStore';
import { PERMISSIONS } from '../lib/permissions';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const { authUser, isAdmin, isAuthReady, hasPermission } = useAuthStore();
  const { toggleSidebar, closeSidebar: closeAdminSidebar } = useAdminStore();
  const { getCart, cart } = useCartStore();
  const { getwishlist, wishlist } = useWishlistStore();
  const { getNotifications, notifications, unreadCount, isLoading } = useNotificationStore();
  const { banners, flashSales, getActiveBanners, getActiveFlashSales } = useMarketingStore();
  const [scrolled, setScrolled] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [isPromoDismissed, setIsPromoDismissed] = useState(false);
  const adminMenuRef = useRef(null);

  useEffect(() => {
    if (isAuthReady && authUser && !isAdmin) {
      getCart();
      getwishlist();
      getNotifications();
    }
  }, [getCart, getwishlist, getNotifications, isAuthReady, isAdmin, authUser]);

  useEffect(() => {
    getActiveBanners();
    getActiveFlashSales();
  }, [getActiveBanners, getActiveFlashSales]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setIsAdminMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsAdminMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setIsAdminMenuOpen(false);
  }, [location.pathname, location.search]);

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

  const hardcodedStyles = [
    'Modern',
    'Contemporary',
    'Antique/Royal',
    'Bespoke',
    'Minimalist',
    'Glam',
  ].sort();

  const closeDrawer = () => setIsDrawerChecked(false);

  const handleDrawerCheckboxChange = (e) => {
    setIsDrawerChecked(e.target.checked);
    if (e.target.checked) closeAdminSidebar();
  };

  const handleCategoryLinkClick = (categoryLink) => {
    navigate(`/shop?category=${categoryLink}`);
    setTimeout(() => window.scrollTo(0, 0), 10);
    closeDrawer();
  };

  const handleStyleLinkClick = (styleName) => {
    navigate(`/styles/${encodeURIComponent(styleName)}`);
    setTimeout(() => window.scrollTo(0, 0), 10);
    closeDrawer();
  };

  const handleMobileSearchClick = () => {
    navigate('/shop', { state: { focusSearch: true } });
    setTimeout(() => window.scrollTo(0, 0), 10);
    closeDrawer();
  };

  const handleDesktopSearchClick = () => {
    navigate('/shop', { state: { focusSearch: true } });
    setTimeout(() => window.scrollTo(0, 0), 10);
  };

  const handleCartClick = () => {
    navigate('/cart');
    setTimeout(() => window.scrollTo(0, 0), 10);
  };

  const handleHeartClick = () => {
    navigate('/wishlist');
    setTimeout(() => window.scrollTo(0, 0), 10);
  };

  const handleNotificationClick = () => {
    setIsNotifOpen((prev) => !prev);
  };

  const handleViewAllNotifications = () => {
    setIsNotifOpen(false);
    navigate('/notifications');
  };

  const previewNotifications = (notifications || []).slice(0, 4);
  const promoItems = [
    ...(banners || [])
      .filter((banner) => banner.position === 'home')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map((banner) => ({
        id: `banner-${banner._id}`,
        label: 'Featured Offer',
        title: banner.title,
        subtitle: banner.subtitle,
        href: banner.linkUrl || '/shop',
      })),
    ...(flashSales || []).map((sale) => ({
      id: `sale-${sale._id}`,
      label: 'Flash Sale',
      title: sale.name,
      subtitle:
        sale.discountType === 'percentage'
          ? `${sale.discountValue}% off for a limited time`
          : `Save ₦${Number(sale.discountValue || 0).toLocaleString()} today`,
      href: '/shop',
    })),
  ];
  const hasPromoBar = !isAdminRoute && !isPromoDismissed && promoItems.length > 0;
  const currentPromo = hasPromoBar ? promoItems[currentPromoIndex % promoItems.length] : null;

  const adminQuickLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', show: true },
    { to: '/admin/orders', label: 'Orders', show: hasPermission(PERMISSIONS.ORDERS_VIEW) },
    { to: '/admin/coupons', label: 'Coupons', show: hasPermission(PERMISSIONS.MARKETING_MANAGE) },
    { to: '/admin/reviews', label: 'Reviews', show: hasPermission(PERMISSIONS.REVIEWS_MANAGE) },
    { to: '/admin/consultations', label: 'Consultations', show: hasPermission(PERMISSIONS.CONSULTATIONS_MANAGE) },
    { to: '/admin/designers', label: 'Designers', show: hasPermission(PERMISSIONS.DESIGNERS_MANAGE) },
    { to: '/admin/marketing', label: 'Marketing', show: hasPermission(PERMISSIONS.MARKETING_MANAGE) },
    { to: '/admin/inventory', label: 'Inventory', show: hasPermission(PERMISSIONS.INVENTORY_MANAGE) },
    { to: '/admin/finance', label: 'Finance', show: hasPermission(PERMISSIONS.FINANCE_VIEW) },
    { to: '/admin/analytics', label: 'Analytics', show: hasPermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW) },
    { to: '/admin/security-logs', label: 'Security Logs', show: hasPermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW) },
  ].filter((item) => item.show);

  useEffect(() => {
    if (!hasPromoBar || promoItems.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promoItems.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [hasPromoBar, promoItems.length]);

  const handlePromoClick = (href) => {
    if (!href) return;
    if (href.startsWith('/')) {
      navigate(href);
      setTimeout(() => window.scrollTo(0, 0), 10);
      return;
    }
    window.location.href = href;
  };

  const isActivePath = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: luxuryEase }}
    >
      {currentPromo ? (
        <div className="fixed inset-x-0 top-0 z-[70] border-b border-secondary/20 bg-primary text-primary-content">
          <div className="mx-auto flex h-11 max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => handlePromoClick(currentPromo.href)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary">
                {currentPromo.label}
              </p>
              <p className="truncate text-sm text-white/90">
                <span className="font-semibold text-white">{currentPromo.title}</span>
                {currentPromo.subtitle ? ` — ${currentPromo.subtitle}` : ''}
              </p>
            </button>

            {promoItems.length > 1 ? (
              <div className="hidden items-center gap-1 sm:flex">
                {promoItems.map((item, index) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${index === currentPromoIndex ? 'w-5 bg-secondary' : 'w-1.5 bg-white/40'}`}
                  />
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsPromoDismissed(true)}
              className="flex h-8 w-8 items-center justify-center text-white/70 transition-colors hover:text-white"
              aria-label="Close promotions bar"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile View Navbar */}
      <div className="xl:hidden flex drawer drawer-start z-30">
        <input
          id="my-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={isDrawerChecked}
          onChange={handleDrawerCheckboxChange}
        />
        <div className={`fixed navbar items-center w-full z-20 drawer-content transition-all duration-300 ${hasPromoBar ? 'top-11' : 'top-0'} ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white/80 backdrop-blur-sm'}`}>
          <div className="navbar-start">
            {isAdmin && isAdminRoute ? (
              <button
                className="pl-4 border-none text-neutral"
                onClick={toggleSidebar}
                aria-label="Toggle admin sidebar"
              >
                <MenuIcon size={22} strokeWidth={1.5} />
              </button>
            ) : (
              <label
                htmlFor="my-drawer"
                className="pl-4 border-none drawer-button cursor-pointer text-neutral"
                aria-label="Open main menu"
              >
                <MenuIcon size={22} strokeWidth={1.5} />
              </label>
            )}
          </div>
          <div className="navbar-center">
            <Link to="/" onClick={closeDrawer}>
              <img
                src="https://res.cloudinary.com/dnwppcwec/image/upload/v1772549686/Untitled_4_oqrtxa.png"
                alt="EM Furniture & Interior"
                className="h-9"
              />
            </Link>
          </div>
          <div className="navbar-end">
            <button
              className="pr-4 border-none text-neutral"
              onClick={handleMobileSearchClick}
              aria-label="Search"
            >
              <SearchIcon size={20} strokeWidth={1.5} />
            </button>
            {authUser && !isAdmin ? (
              <div className="relative">
                <button
                  className="relative pr-4 border-none text-neutral"
                  onClick={handleNotificationClick}
                  aria-label="Notifications"
                >
                  {unreadCount > 0 ? (
                    <div className="absolute -right-0.5 -top-0.5 bg-secondary text-primary-content text-[10px] w-4 h-4 rounded-full flex justify-center items-center font-bold">
                      {unreadCount}
                    </div>
                  ) : null}
                  <Bell size={20} strokeWidth={1.5} />
                </button>
                {isNotifOpen ? (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-base-300 shadow-lg z-50">
                    <div className="p-3 border-b border-base-200 text-sm font-semibold">
                      Notifications
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {isLoading ? (
                        <div className="p-3 text-sm text-neutral/60">Loading...</div>
                      ) : previewNotifications.length === 0 ? (
                        <div className="p-3 text-sm text-neutral/60">No notifications yet.</div>
                      ) : (
                        previewNotifications.map((item) => (
                          <button
                            key={item._id}
                            type="button"
                            className="w-full text-left p-3 hover:bg-base-200"
                            onClick={handleViewAllNotifications}
                          >
                            <div className="text-sm font-medium text-neutral">
                              {item.title}
                            </div>
                            <div className="text-xs text-neutral/60 line-clamp-2">
                              {item.message}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      className="w-full text-sm p-3 border-t border-base-200 hover:bg-base-200"
                      onClick={handleViewAllNotifications}
                    >
                      View all
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="drawer-side z-40">
          <label
            htmlFor="my-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={closeDrawer}
          ></label>
          <ul className="menu bg-white text-base-content min-h-full w-80 sm:w-96 p-0">
            {/* Drawer Header */}
            <li className="flex flex-row justify-between items-center p-5 border-b border-base-300">
              <Link to="/" onClick={closeDrawer} className="p-0">
                <img
                  src="https://res.cloudinary.com/dnwppcwec/image/upload/v1772549686/Untitled_4_oqrtxa.png"
                  alt="Logo"
                  className="h-8"
                />
              </Link>
              <Button
                onClick={closeDrawer}
                variant="icon"
                size="icon"
                className="h-9 w-9 border-base-300 text-neutral"
                ariaLabel="Close menu"
              >
                <X size={20} strokeWidth={1.5} />
              </Button>
            </li>

            {/* Quick Links */}
            <div className="px-2 pt-4 pb-2 space-y-0.5">
              <li>
                <Link
                  to="/shop"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  Shop
                </Link>
              </li>
              <li>
                <Link
                  to="/projects"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  Projects
                </Link>
              </li>
              <li>
                <Link
                  to="/showroom"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  Showroom
                </Link>
              </li>
              <li>
                <Link
                  to="/e-catalog"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  E-Catalog
                </Link>
              </li>
              <li>
                <Link
                  to="/consultation"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  Consultation
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/faqs"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  FAQs
                </Link>
              </li>
              <li>
                <Link
                  to="/aboutUs"
                  className="font-medium text-sm tracking-wide py-3 px-4 rounded-none hover:bg-base-200 transition-colors"
                  onClick={closeDrawer}
                >
                  About
                </Link>
              </li>
            </div>

            {/* Categories/Styles Switch */}
            <li className="mb-3 px-2 pt-4">
              <div className="flex bg-base-200 rounded-none p-1 w-full">
                <button
                  className={`flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-none transition-all duration-200 ${
                    activeDrawerTab === 'categories'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-neutral/60 hover:text-neutral'
                  }`}
                  onClick={() => setActiveDrawerTab('categories')}
                >
                  Categories
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-none transition-all duration-200 ${
                    activeDrawerTab === 'styles'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-neutral/60 hover:text-neutral'
                  }`}
                  onClick={() => setActiveDrawerTab('styles')}
                >
                  Styles
                </button>
              </div>
            </li>

            {/* Conditional Rendering based on activeDrawerTab */}
            <div className="px-2 space-y-0.5">
            {activeDrawerTab === 'categories' ? (
              <>
                {uniqueCategories.map((category) => (
                  <li key={category.id}>
                    <button
                      onClick={() => handleCategoryLinkClick(category.link)}
                      className="text-sm font-medium py-3 px-4 rounded-none hover:bg-base-200 transition-colors w-full text-left"
                    >
                      {category.name}
                    </button>
                  </li>
                ))}
              </>
            ) : (
              <>
                {hardcodedStyles.map((style) => (
                  <li key={style}>
                    <button
                      onClick={() => handleStyleLinkClick(style)}
                      className="text-sm font-medium py-3 px-4 rounded-none hover:bg-base-200 transition-colors w-full text-left"
                    >
                      {style}
                    </button>
                  </li>
                ))}
              </>
            )}
            </div>
          </ul>
        </div>
      </div>

      {/* Desktop View Navbar */}
      <motion.div
        className={`hidden xl:flex fixed navbar z-100 border-b border-base-300/80 transition-all duration-300 ${hasPromoBar ? 'top-11' : 'top-0'} ${scrolled ? 'bg-white/95 py-2 shadow-sm backdrop-blur-md' : 'bg-white/90 py-3 backdrop-blur-sm'}`}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: luxuryEase, delay: 0.1 }}
      >
        <div className="navbar-start">
          <Link to="/" className="flex items-center">
            <img
              src="https://res.cloudinary.com/dnwppcwec/image/upload/v1772549686/Untitled_4_oqrtxa.png"
              alt="EM Furniture & Interior"
              className="h-9"
            />
          </Link>
        </div>
        <div className="navbar-center flex items-center gap-1">
          <Link to="/shop" className={getNavLinkClass(isActivePath('/shop'))}>
            Shop
          </Link>
          <Link to="/projects" className={getNavLinkClass(isActivePath('/projects'))}>
            Projects
          </Link>
          <Link to="/showroom" className={getNavLinkClass(isActivePath('/showroom'))}>
            Showroom
          </Link>
          <Link to="/e-catalog" className={getNavLinkClass(isActivePath('/e-catalog'))}>
            E-Catalog
          </Link>
          <Link to="/blog" className={getNavLinkClass(isActivePath('/blog'))}>
            Blog
          </Link>
          <Link to="/consultation" className={getNavLinkClass(isActivePath('/consultation'))}>
            Consultation
          </Link>
          <Link to="/aboutUs" className={getNavLinkClass(isActivePath('/aboutUs'))}>
            About
          </Link>
        </div>
        <div className="navbar-end flex items-center space-x-1">
          {authUser ? (
            <>
              {isAdmin && (
                <div ref={adminMenuRef} className="relative">
                  <Button
                    type="button"
                    variant={isAdminRoute ? 'primary' : 'elegant-outline'}
                    size="sm"
                    className="px-4 text-xs"
                    onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                    ariaLabel="Toggle admin menu"
                  >
                    <span className="inline-flex items-center gap-2">
                      Admin
                      <ChevronDown size={16} className={`transition-transform duration-200 ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </Button>

                  {isAdminMenuOpen ? (
                    <ul className="absolute right-0 z-50 mt-2 w-64 border border-base-300 bg-white p-2 shadow-lg">
                      {adminQuickLinks.map((item) => (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            onClick={() => setIsAdminMenuOpen(false)}
                            className="block rounded-none px-3 py-2 text-sm font-medium text-neutral transition-colors hover:bg-base-200 hover:text-secondary"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
              <Link to="/profile" className="px-3 py-2 text-sm font-medium text-neutral/80 hover:text-secondary transition-colors flex items-center gap-1.5">
                <UserIcon size={16} strokeWidth={1.5} />
                Account
              </Link>
            </>
          ) : (
            <>
              {/* <Link to="/profile" className="px-3 py-2 text-sm font-medium text-neutral/80 hover:text-secondary transition-colors">
                Login
              </Link> */}
              <Button to="/signup" size="sm" className="px-5 text-xs">
                Login
              </Button>
            </>
          )}
          <Button
            variant="icon"
            size="icon"
            className={getIconButtonClass()}
            onClick={handleDesktopSearchClick}
            ariaLabel="Search"
          >
            <SearchIcon size={18} strokeWidth={1.5} />
          </Button>
          {authUser && !isAdmin ? (
            <div
              className="relative"
              onMouseEnter={() => setIsNotifOpen(true)}
              onMouseLeave={() => setIsNotifOpen(false)}
            >
              <Button
                variant="icon"
                size="icon"
                className={getIconButtonClass(unreadCount > 0)}
                onClick={handleNotificationClick}
                ariaLabel="Notifications"
              >
                {unreadCount > 0 ? (
                  <div className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-primary-content">
                    {unreadCount}
                  </div>
                ) : null}
                <Bell size={18} strokeWidth={1.5} />
              </Button>
              {isNotifOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-80 border border-base-300 bg-white shadow-lg">
                  <div className="border-b border-base-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                      Updates
                    </p>
                    <div className="mt-1 text-sm font-semibold text-neutral">Notifications</div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {isLoading ? (
                      <div className="p-3 text-sm text-neutral/60">Loading...</div>
                    ) : previewNotifications.length === 0 ? (
                      <div className="p-3 text-sm text-neutral/60">No notifications yet.</div>
                    ) : (
                      previewNotifications.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          className="w-full border-b border-base-200 p-3 text-left transition-colors hover:bg-base-200 last:border-b-0"
                          onClick={handleViewAllNotifications}
                        >
                          <div className="text-sm font-medium text-neutral">
                            {item.title}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-neutral/60">
                            {item.message}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-base-200 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center"
                      onClick={handleViewAllNotifications}
                    >
                      View all
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {!isAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="icon"
                size="icon"
                className={getIconButtonClass(Boolean(cart?.length))}
                onClick={() => handleCartClick()}
                ariaLabel="Open cart"
              >
                {cart?.length ? (
                  <div className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-primary-content">
                    {cart.length}
                  </div>
                ) : null}
                <ShoppingCart size={18} strokeWidth={1.5} />
              </Button>
              <Button
                variant="icon"
                size="icon"
                className={getIconButtonClass(Boolean(wishlist?.length))}
                onClick={() => handleHeartClick()}
                ariaLabel="Open wishlist"
              >
                {wishlist?.length ? (
                  <div className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-primary-content">
                    {wishlist.length}
                  </div>
                ) : null}
                <HeartIcon size={18} strokeWidth={1.5} />
              </Button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Navbar;
