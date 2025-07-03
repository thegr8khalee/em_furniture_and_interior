// src/pages/AdminLoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore'; // Import your Zustand auth store
import { Loader2 } from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';

const AdminLoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  

  // React Router hook for navigation
  const navigate = useNavigate();

  // Access authUser and isAdmin from the store to handle redirection if already logged in as admin
  const { authUser, isAdmin, isLoading } = useAuthStore();
  const { adminLogin } = useAdminStore();
  // Effect to redirect if an admin is already logged in
  // This handles cases where an admin manually navigates to /admin/login while already authenticated
  React.useEffect(() => {
    if (!isLoading && authUser && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [authUser, isAdmin, isLoading, navigate]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    adminLogin(formData);
  };

  // If loading, show a simple loading message
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
        <Loader2 className='animate-spin'/>
      </div>
    );
  }

  // Render the login form
  return (
    <div className="p-4 flex justify-center items-center h-screen bg-base-300">
      <div className="card w-md bg-base-100 shadow-xl rounded-xl">
        <div className="card-body p-8">
          <h2 className="card-title text-center text-3xl font-bold mb-6">
            Admin Login
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-lg font-medium">Email</span>
              </label>
              <input
                type="email"
                placeholder="admin@example.com"
                className="input input-bordered w-full rounded-md"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                aria-label="Admin Email"
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
                  'Login as Admin'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
