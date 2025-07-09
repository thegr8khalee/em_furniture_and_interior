// src/pages/AdminLoginPage.jsx
import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore'; // Import your Zustand auth store
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    anonymousId: '',
  });

  // React Router hook for navigation
  //   const navigate = useNavigate();

  // Access authUser and isAdmin from the store to handle redirection if already logged in as admin
  const { login, isLoading } = useAuthStore();
  // Effect to redirect if an admin is already logged in
  // This handles cases where an admin manually navigates to /admin/login while already authenticated

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData);
  };

  // If loading, show a simple loading message
  //   if (isLoading) {
  //     return (
  //       <div className="flex justify-center items-center min-h-screen">
  //         <span className="loading loading-spinner loading-lg"></span>
  //         <Loader2 className="animate-spin" />
  //       </div>
  //     );
  //   }

  // Render the login form
  return (
    <div className="p-4 flex justify-center items-center h-screen bg-base-300">
      <div className="card w-md bg-base-100 shadow-xl rounded-xl">
        <div className="card-body p-8">
          <h2 className="card-title text-center text-3xl font-bold mb-6">
            Welocome back!
          </h2>

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
                    type="password"
                    required
                    placeholder="Password"
                    minlength="8"
                    pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    title="Must be more than 8 characters, including number, lowercase letter, uppercase letter"
                  />
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
