// src/pages/ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// import { usePasswordStore } from '../store/usePasswordStore';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';

const ResetPasswordPage = () => {
  const { token } = useParams(); // Get the token from the URL
  const navigate = useNavigate();
  const { resetPassword, isResettingPassword } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    // Optional: You might want to do an initial validation of the token here
    // or simply rely on the backend's validation when resetPassword is called.
    // For now, we'll rely on the backend.
    if (!token) {
      toast.error('Password reset token is missing.');
      navigate('/login'); // Redirect if no token is present
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmNewPassword) {
      toast.error('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }

    // Call the resetPassword action from the store
    await resetPassword(token, newPassword);

    // After attempting reset, redirect to login regardless of success/failure,
    // as toast will provide feedback.
    navigate('/profile');
  };

  return (
    <div className="p-4 flex justify-center items-center h-screen bg-base-300">
      <div className="card w-md bg-base-100 shadow-xl rounded-xl">
        <div className="card-body p-8">
          <h2 className="card-title text-center text-3xl font-bold mb-6">
            Reset Your Password
          </h2>
          <p className="text-sm text-gray-600 mb-4 text-center">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-lg font-medium">
                  New Password
                </span>
              </label>
              {/* New Password Input with Validation */}
              <label className="input validator w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  placeholder="••••••••"
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full"
                  required
                  disabled={isResettingPassword}
                  minLength="8"
                  pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                  title="Must be at least 8 characters long, including at least one number, one lowercase letter, and one uppercase letter."
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-5 text-base-content/40" />
                  ) : (
                    <Eye   className="size-5 text-base-content/40" />
                  )}
                </button>
              </label>
              <p className="validator-hint hidden">
                Must be at least 8 characters long, including:
                <br />
                At least one number <br />
                At least one lowercase letter <br />
                At least one uppercase letter
              </p>
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text text-lg font-medium">
                  Confirm New Password
                </span>
              </label>
              {/* Confirm New Password Input with Validation */}
              <label className="input validator w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  placeholder="••••••••"
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full"
                  required
                  disabled={isResettingPassword}
                  minLength="8"
                  pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                  title="Must be at least 8 characters long, including at least one number, one lowercase letter, and one uppercase letter."
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-5 text-base-content/40" />
                  ) : (
                    <Eye   className="size-5 text-base-content/40" />
                  )}
                </button>
              </label>
              <p className="validator-hint hidden">
                Must be at least 8 characters long, including:
                <br />
                At least one number <br />
                At least one lowercase letter <br />
                At least one uppercase letter
              </p>
            </div>

            <div className="form-control">
              <button
                type="submit"
                className="btn btn-primary w-full border-0 font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black text-sm font-['poppins']"
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2" /> Reset Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
