import React, { useState, useEffect } from 'react';
// import { useAuthStore } from '../store/useAuthStore';
// Please verify this path carefully based on your actual file structure.
// If CookieConsentBanner.jsx is in 'src/components/' and useAuthStore.js is in 'src/store/',
// then '../store/useAuthStore' is the correct relative path.

const COOKIE_CONSENT_KEY = 'cookie_consent_accepted';

const CookieConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
//   const { anonymousLogin, isLoggingIn } = useAuthStore(); // Get anonymousLogin from the store

  useEffect(() => {
    // Check localStorage on component mount
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // If consent not found, show the banner
      setShowBanner(true);
    }
  }, []); // Empty dependency array means this runs once on mount

  const handleAcceptCookies = async () => {
    // Made async to await anonymousLogin
    // Set consent in localStorage
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    // Hide the banner (optimistically hide, or wait for login success)
    setShowBanner(false);
    console.log('Cookies accepted!');
  };

  const handleDeclineCookies = () => {
    // Optionally handle decline: you might set 'false' or just hide it
    // and avoid loading non-essential scripts.
    localStorage.setItem(COOKIE_CONSENT_KEY, 'false');
    setShowBanner(false);
    console.log('Cookies declined!');
  };

  if (!showBanner) {
    return null; // Don't render anything if the banner should not be shown
  }

  return (
    <div className="font-[poppins] sticky bottom-20 lg:bottom-2 left-0 right-0 bg-base-300  p-4 z-50 rounded-t-3xl md:rounded-lg md:mx-4 md:mb-4 flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 md:space-x-4 animate-slide-up">
      <div className="flex-1 text-sm text-center md:text-left">
        <p>
          We use cookies to ensure you get the best experience on our website.
          By continuing to use our site, you agree to our{' '}
          <a
            href="/privacy"
            className="underline font-medium hover:text-primary"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
        <button
          onClick={handleDeclineCookies}
          className="px-4 py-2 bg-transparent border border-gray-500 rounded-lg text-sm w-full md:w-auto"
        >
          Decline
        </button>
        <button
          onClick={handleAcceptCookies}
          className="px-4 py-2 bg-primary  rounded-lg text-sm hover:bg-primary-dark transition-colors duration-200 w-full md:w-auto"
        //   disabled={isLoggingIn} // Disable button while anonymous login is in progress
        >
          Accept All
        </button>
      </div>

      {/* Tailwind CSS Animation for sliding up */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slideUp 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CookieConsentBanner;
