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
  };

  const handleDeclineCookies = () => {
    // Optionally handle decline: you might set 'false' or just hide it
    // and avoid loading non-essential scripts.
    localStorage.setItem(COOKIE_CONSENT_KEY, 'false');
    setShowBanner(false);
  };

  if (!showBanner) {
    return null; // Don't render anything if the banner should not be shown
  }

  return (
    <div className="sticky bottom-20 lg:bottom-2 left-0 right-0 bg-primary text-white/90 p-4 sm:p-5 z-50 md:mx-4 md:mb-4 border-t border-secondary/30 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 animate-[slideUp_0.4s_ease-out_forwards]">
      <div className="flex-1 text-sm text-center md:text-left leading-relaxed">
        <p>
          We use cookies to ensure you get the best experience on our website.
          By continuing to use our site, you agree to our{' '}
          <a
            href="/privacy"
            className="text-secondary underline underline-offset-2 hover:text-accent transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <button
          onClick={handleDeclineCookies}
          className="px-5 py-2 bg-transparent border border-white/30 text-white text-sm tracking-wider uppercase hover:border-white/60 transition-colors w-full sm:w-auto"
        >
          Decline
        </button>
        <button
          onClick={handleAcceptCookies}
          className="px-5 py-2 bg-secondary text-primary text-sm font-semibold tracking-wider uppercase hover:bg-accent transition-colors w-full sm:w-auto"
        >
          Accept All
        </button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
