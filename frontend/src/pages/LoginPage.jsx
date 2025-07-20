// src/pages/AdminLoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Ensure Link is imported
import { useAuthStore } from '../store/useAuthStore';
// import { usePasswordStore } from '../store/usePasswordStore'; // NEW: Import usePasswordStore
import { Eye, EyeOff, Loader2 } from 'lucide-react';
// import toast from 'react-hot-toast'; // Ensure toast is imported for local messages

const LoginPage = () => {
  const navigate = useNavigate(); // Re-enabled useNavigate as it's useful

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    // anonymousId: '', // Removed as guest users are no longer in use
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

  // If loading for initial auth check, show a simple loading message
  // This check is for the overall app's auth loading, not just login form submission
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading...</p>
      </div>
    );
  }

  // Render the login form or forgot password form
  return (
    <div className="p-4 flex justify-center items-center h-screen bg-base-300">
      <div className="card w-md bg-base-100 shadow-xl rounded-xl">
        <div className="card-body p-8">
          <h2 className="card-title text-center text-3xl font-bold mb-6">
            Welcome back!
          </h2>

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
                      placeholder="••••••••"
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
              <div className="form-control">
                <button
                  type="submit"
                  className="btn btn-primary w-full border-0 font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black text-sm font-['poppins']"
                  disabled={isLoading} // Disable button while loading
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Login'
                  )}
                </button>
                <div className="w-full text-center mt-2">
                  <Link to="/signup" className="hover:underline">
                    Sign Up
                  </Link>
                </div>
                {/* NEW: Forgot Password Link */}
                <div className="w-full text-center mt-2">
                  <button
                    type="button" // Use type="button" to prevent form submission
                    onClick={() => setShowForgotPasswordForm(true)}
                    className="btn btn-link text-sm text-info hover:underline"
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
              <p className="text-sm text-gray-600 mb-4 text-center">
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
                  className="btn btn-primary w-full border-0 font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black text-sm font-['poppins']"
                  disabled={isRequestingReset}
                >
                  {isRequestingReset ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
                <div className="w-full text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordForm(false)}
                    className="btn btn-link text-sm text-gray-600 hover:underline"
                    disabled={isRequestingReset}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
