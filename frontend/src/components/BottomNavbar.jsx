// src/components/BottomNavbar.jsx
import React, { useEffect } from 'react';
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  User,
  Heart,
  X,
  LayoutDashboard,
  HomeIcon,
  Plus,
  Minus,
} from 'lucide-react'; // Example icons
import { Link, useLocation } from 'react-router-dom'; // Use Link for navigation, useLocation for active state
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';

const BottomNavbar = () => {
  const location = useLocation(); // Get current location to highlight active link
  const { isAdmin, isAuthReady } = useAuthStore();
  const { cart, getCart } = useCartStore();
  const { wishlist, getwishlist } = useWishlistStore();

  useEffect(() => {
    if (isAuthReady) {
      getCart();
      getwishlist();
    }
  }, [getCart, getwishlist, isAuthReady]);
  // Define your navigation items
  const navItems = [
    { name: 'Shop', icon: ShoppingBag, path: '/shop' }, // Example shop page
    {
      name: isAdmin ? 'Product' : 'Cart',
      icon: isAdmin ? Plus : ShoppingCart,
      path: isAdmin ? '/admin/products/new' : '/cart',
    }, // Example cart page
    {
      name: isAdmin ? 'Collection' : 'Wishlist',
      icon: isAdmin ? Plus : Heart,
      path: isAdmin ? '/admin/collections/new' : '/wishlist',
    }, // Example wishlist page
    {
      name: isAdmin ? 'Dasboard' : 'Profile',
      icon: isAdmin ? LayoutDashboard : User,
      path: isAdmin ? '/admin/dashboard' : '/profile',
    }, // Example profile page
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-base-100 shadow-lg p-2 z-50 lg:hidden">
      {/* md:hidden makes it visible only on screens smaller than 'md' (768px) */}
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.icon; // Get the Lucide icon component

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`relative flex flex-col items-center justify-center p-1 rounded-lg transition-colors duration-200
                                ${
                                  isActive
                                    ? 'text-primary'
                                    : 'text-base-content hover:text-primary'
                                }`}
              aria-label={item.name}
            >
              <IconComponent size={24} className="mb-1" />
              {item.name === 'Cart' && cart?.length !== 0 ? (
                <div className="absolute right-0 top-0 bg-red-500 text-xs w-4 h-4 rounded-full flex justify-center items-center">
                  {cart?.length}
                </div>
              ) : null}

              {item.name === 'Wishlist' && wishlist?.length !== 0 ? (
                <div className="absolute right-0 top-0 bg-red-500 text-xs w-4 h-4 rounded-full flex justify-center items-center">
                  {wishlist?.length}
                </div>
              ) : null}

              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
