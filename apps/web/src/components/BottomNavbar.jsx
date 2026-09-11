// src/components/BottomNavbar.jsx
import React, { useEffect } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  User,
  Heart,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

void motion;
import { luxuryEase } from '@em/ui/styles/animations';
import { useAuthStore } from '@em/domain';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';

const BottomNavbar = () => {
  const location = useLocation();
  const { isAuthReady } = useAuthStore();
  const { cart, getCart } = useCartStore();
  const { wishlist, getwishlist } = useWishlistStore();

  useEffect(() => {
    if (isAuthReady) {
      getCart();
      getwishlist();
    }
  }, [getCart, getwishlist, isAuthReady]);

  const navItems = [
    { name: 'Shop', icon: ShoppingBag, path: '/shop' },
    {
      name: 'Cart',
      icon: ShoppingCart,
      path: '/cart',
    },
    {
      name: 'Wishlist',
      icon: Heart,
      path: '/wishlist',
    },
    {
      name: 'Profile',
      icon: User,
      path: '/profile',
    },
  ];

  const navigate = useNavigate();
  const handleClick = (link) => {
    navigate(link);
    setTimeout(() => window.scrollTo(0, 0), 10);
  };

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-base-300/50 z-50 lg:hidden"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.3, ease: luxuryEase }}
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.icon;

          return (
            <motion.button
              key={item.name}
              onClick={() => handleClick(item.path)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 transition-all duration-200
                ${isActive ? 'text-secondary' : 'text-neutral/50 hover:text-neutral/80'}`}
              aria-label={item.name}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <div className={`p-1 rounded-none transition-all duration-200 ${isActive ? '' : ''}`}>
                <IconComponent size={20} strokeWidth={isActive ? 2 : 1.5} className="mb-0.5" />
              </div>
              {item.name === 'Cart' && cart?.length !== 0 && cart !== null ? (
                <div className="absolute right-1 top-0.5 bg-secondary text-white text-[9px] w-4 h-4 rounded-full flex justify-center items-center font-bold">
                  {cart?.length}
                </div>
              ) : null}
              {item.name === 'Wishlist' && wishlist?.length !== 0 && wishlist !== null ? (
                <div className="absolute right-1 top-0.5 bg-secondary text-white text-[9px] w-4 h-4 rounded-full flex justify-center items-center font-bold">
                  {wishlist?.length}
                </div>
              ) : null}
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
              {isActive && (
                <motion.div
                  className="absolute -top-[1px] left-1/2 w-8 h-[2px]"
                  layoutId="bottomNavIndicator"
                  style={{ x: '-50%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNavbar;
