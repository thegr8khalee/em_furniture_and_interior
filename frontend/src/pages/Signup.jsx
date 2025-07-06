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
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-lg font-medium">Email</span>
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                className="input input-bordered w-full rounded-md"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                aria-label="Email"
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-lg font-medium">Phone number</span>
              </label>
              <input
                type="phoneNumber"
                placeholder="Enter your phone number"
                className="input input-bordered w-full rounded-md"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                required
                aria-label="phone number"
              />
            </div>
            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text text-lg font-medium">Password</span>
              </label>
              <input
                type="password"
                placeholder="********"
                className="input input-bordered w-full rounded-md"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                aria-label="Admin Password"
              />
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
