// src/pages/AdminSignupPage.jsx
import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore'; // Import your Zustand auth store
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const SignupPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    anonymousId: '',
  });

  // React Router hook for navigation
  //   const navigate = useNavigate();

  // Access authUser and isAdmin from the store to handle redirection if already logged in as admin
  const { signup, isLoading } = useAuthStore();
  // Effect to redirect if an admin is already logged in
  // This handles cases where an admin manually navigates to /admin/login while already authenticated

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    await signup(formData);
  };

  // If loading, show a simple loading message
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  // Render the login form
  return (
    <div className="p-4 flex justify-center items-center h-screen bg-base-300">
      <div className="card w-md bg-base-100 shadow-xl rounded-xl">
        <div className="card-body p-8">
          <h2 className="card-title text-center text-3xl font-bold mb-6">
            Welcome!
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-lg font-medium">Name</span>
              </label>
              <input
                type="name"
                placeholder="Name Surname"
                className="input input-bordered w-full rounded-md"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                required
                aria-label="full name"
              />
            </div>
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
            <label className="label">
              <span className="label-text text-lg font-medium">
                Phone number
              </span>
            </label>
            <div className="form-control">
              <label className="input validator w-full">
                <svg
                  className="h-[1em] opacity-50"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                >
                  <g fill="none">
                    <path
                      d="M7.25 11.5C6.83579 11.5 6.5 11.8358 6.5 12.25C6.5 12.6642 6.83579 13 7.25 13H8.75C9.16421 13 9.5 12.6642 9.5 12.25C9.5 11.8358 9.16421 11.5 8.75 11.5H7.25Z"
                      fill="currentColor"
                    ></path>
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6 1C4.61929 1 3.5 2.11929 3.5 3.5V12.5C3.5 13.8807 4.61929 15 6 15H10C11.3807 15 12.5 13.8807 12.5 12.5V3.5C12.5 2.11929 11.3807 1 10 1H6ZM10 2.5H9.5V3C9.5 3.27614 9.27614 3.5 9 3.5H7C6.72386 3.5 6.5 3.27614 6.5 3V2.5H6C5.44771 2.5 5 2.94772 5 3.5V12.5C5 13.0523 5.44772 13.5 6 13.5H10C10.5523 13.5 11 13.0523 11 12.5V3.5C11 2.94772 10.5523 2.5 10 2.5Z"
                      fill="currentColor"
                    ></path>
                  </g>
                </svg>
                <input
                  type="tel"
                  className="tabular-nums"
                  required
                  placeholder="Phone"
                  pattern="[0-9]*"
                  minlength="10"
                  maxlength="14"
                  title="Must be at least 10 digits"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                />
              </label>
              <p className="validator-hint">Must be at least 10 digits</p>
            </div>
            <label className="label">
              <span className="label-text text-lg font-medium">Password</span>
            </label>
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

            <div className="form-control">
              <div className="flex mb-1">
                <p className="">
                  By clicking on sign Up, you agree to our
                  <span className='pl-2'>
                    <a href="/privacy" className="text-info">
                      Privacy Policy
                    </a>
                  </span>
                </p>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full border-0 font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black text-sm font-['poppins']"
                disabled={isLoading} // Disable button while loading
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Sign Up'
                )}
              </button>
              <div className="w-full text-center mt-2">
                <Link to="/profile" className="hover:underline">
                  Login
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
