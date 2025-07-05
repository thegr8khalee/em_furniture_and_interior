// src/components/BottomNavbar.jsx
import React from 'react';
import { Home, ShoppingBag, ShoppingCart, User, Heart } from 'lucide-react'; // Example icons
import { Link, useLocation } from 'react-router-dom'; // Use Link for navigation, useLocation for active state

const BottomNavbar = () => {
    const location = useLocation(); // Get current location to highlight active link

    // Define your navigation items
    const navItems = [
        { name: 'Shop', icon: ShoppingBag, path: '/shop' }, // Example shop page
        { name: 'Cart', icon: ShoppingCart, path: '/cart' }, // Example cart page
        { name: 'Wishlist', icon: Heart, path: '/wishlist' }, // Example wishlist page
        { name: 'Profile', icon: User, path: '/profile' }, // Example profile page
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
                            className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors duration-200
                                ${isActive ? 'text-primary' : 'text-base-content hover:text-primary'}`}
                            aria-label={item.name}
                        >
                            <IconComponent size={24} className="mb-1" />
                            <span className="text-xs font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavbar;
