// src/pages/LoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Ensure Link is imported
import { useAuthStore } from '../store/useAuthStore';
// import { usePasswordStore } from '../store/usePasswordStore'; // NEW: Import usePasswordStore
import { Eye, EyeOff, Loader2 } from 'lucide-react';
// import toast from 'react-hot-toast'; // Ensure toast is imported for local messages
import { PageWrapper } from '../components/animations';

const LoginPage = () => {
  const navigate = useNavigate(); // Re-enabled useNavigate as it's useful

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Access authUser and isAdmin from the store to handle redirection if already logged in as admin
  const {
    login,
    isLoading,
    authUser,
    isAdmin,
    forgotPassword,
    isRequestingReset,
  } = useAuthStore(); // Added authUser, isAdmin
  // const { forgotPassword, isRequestingReset } = usePasswordStore(); // NEW: Destructure from usePasswordStore

  // NEW: State for Forgot Password form
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Effect to redirect if an admin is already logged in
  // This handles cases where an admin manually navigates to /admin/login while already authenticated
  // (Assuming this component is specifically for Admin login, though named LoginPage)
  // If it's a general login page, this logic might need adjustment based on user role.
  useEffect(() => {
    if (authUser && isAdmin) {
      navigate('/admin/dashboard'); // Redirect to admin dashboard if already logged in as admin
    } else if (authUser && !isAdmin) {
      navigate('/profile'); // Redirect to user profile if logged in as regular user
    }
  }, [authUser, isAdmin, navigate]);

  // Handle form submission for login
  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData);
  };

  // NEW: Handle Forgot Password form submission
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    await forgotPassword(forgotPasswordEmail);
    // Optionally clear email field and hide form after submission
    setForgotPasswordEmail('');
    setShowForgotPasswordForm(false);
  };

  // Render the login form or forgot password form
  return (
    <PageWrapper>
    <div className="min-h-screen flex">
      {/* Left decorative panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center">
        <div className="text-center px-16">
          <div className="divider-gold mb-8" style={{ background: '#c9a84c' }}></div>
          <h2 className="font-heading text-4xl xl:text-5xl font-medium text-white leading-tight mb-4">Welcome Back</h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">Sign in to explore our curated furniture collections and manage your orders.</p>
          {/* <div className="divider-gold mt-8" style={{ background: '#c9a84c' }}></div> */}
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url(https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png)', backgroundSize: 'cover' }}></div>
      </div>
      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="w-10 h-0.5 bg-secondary mb-4"></div>
            <h2 className="font-heading text-3xl font-medium text-neutral">Sign In</h2>
            <p className="text-neutral/50 text-sm mt-2">Enter your credentials to continue</p>
          </div>

          {/* Login Form */}
          {!showForgotPasswordForm ? (
            <form onSubmit={handleSubmit}>
              <label className="label">
                <span className="label-text text-lg font-medium">Email</span>
              </label>
              <div className="form-control mb-4">
                <div className="form-control mb-4">
                  <label className="input validator w-full">
                    <svg
                      className="h-[1em] opacity-50"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <g
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeWidth="2.5"
                        fill="none"
                        stroke="currentColor"
                      >
                        <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                      </g>
                    </svg>
                    <input
                      type="email"
                      className="w-full"
                      placeholder="mail@site.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </label>
                  <div className="validator-hint hidden">
                    Enter valid email address
                  </div>
                </div>
              </div>
              <label className="label">
                <span className="label-text text-lg font-medium">Password</span>
              </label>
              <div className="form-control mb-6">
                <div className="form-control mb-6">
                  <label className="input validator w-full">
                    <svg
                      className="h-[1em] opacity-50"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <g
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeWidth="2.5"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path>
                        <circle
                          cx="16.5"
                          cy="7.5"
                          r=".5"
                          fill="currentColor"
                        ></circle>
                      </g>
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      minLength="8"
                      pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      title="Must be more than 8 characters, including number, lowercase letter, uppercase letter"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-5 text-base-content/40" />
                      ) : (
                        <Eye className="size-5 text-base-content/40" />
                      )}
                    </button>
                  </label>
                  <p className="validator-hint hidden">
                    Must be more than 8 characters, including
                    <br />
                    At least one number <br />
                    At least one lowercase letter <br />
                    At least one uppercase letter
                  </p>
                </div>
              </div>
              <div className="form-control space-y-4">
                <button
                  type="submit"
                  className="btn-elegant w-full py-3.5 text-center flex items-center justify-center"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Sign In'
                  )}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <Link to="/signup" className="text-secondary font-medium hover:underline">
                    Create Account
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordForm(true)}
                    className="text-neutral/50 hover:text-secondary transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            </form>
          ) : (
            // NEW: Forgot Password Form
            <form onSubmit={handleForgotPasswordSubmit}>
              <h3 className="text-xl font-semibold mb-4 text-center">
                Reset Your Password
              </h3>
              <p className="text-sm text-neutral/70 mb-4 text-center">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>
              <label className="label">
                <span className="label-text text-lg font-medium">Email</span>
              </label>
              <div className="form-control mb-4">
                <label className="input validator w-full">
                  <svg
                    className="h-[1em] opacity-50"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <g
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2.5"
                      fill="none"
                      stroke="currentColor"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </g>
                  </svg>
                  <input
                    type="email"
                    className="w-full"
                    placeholder="mail@site.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    disabled={isRequestingReset}
                  />
                </label>
              </div>
              <div className="form-control">
                <button
                  type="submit"
                  className="btn-elegant w-full py-3.5 flex items-center justify-center"
                  disabled={isRequestingReset}
                >
                  {isRequestingReset ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
                <div className="w-full text-center mt-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordForm(false)}
                    className="text-sm text-neutral/50 hover:text-secondary transition-colors"
                    disabled={isRequestingReset}
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default LoginPage;
