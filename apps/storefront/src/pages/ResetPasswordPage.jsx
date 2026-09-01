// src/pages/ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { PageWrapper } from '../components/animations';
import SEO from '../components/SEO';

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

    // Basic length check (the input also has pattern matching, but good to have explicit check)
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }

    // Call the resetPassword action from the store
    await resetPassword(token, newPassword);

    // After attempting reset, redirect to logic handle by component logic or user expectation.
    // existing logic was navigate('/profile'), preserving that.
    navigate('/profile');
  };

  return (
    <PageWrapper>
    <SEO title="Reset Password" description="Reset your account password." noindex />
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-base-100 shadow-xl border border-base-200 p-8">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-heading font-bold text-primary">
            Reset Password
          </h2>
          <p className="text-neutral/70 mt-2 font-body text-sm">
            Enter your new password below to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* New Password */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium font-body text-neutral">New Password</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="size-5 text-neutral/40" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input input-bordered w-full pl-10 rounded-none focus:outline-none focus:border-primary font-body"
                placeholder="••••••••"
                required
                minLength="8"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="size-5 text-neutral/40" />
                ) : (
                  <Eye className="size-5 text-neutral/40" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium font-body text-neutral">Confirm Password</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="size-5 text-neutral/40" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="input input-bordered w-full pl-10 rounded-none focus:outline-none focus:border-primary font-body"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full rounded-none text-white font-heading font-medium"
            disabled={isResettingPassword}
          >
            {isResettingPassword ? (
              <>
                <Loader2 className="size-5 animate-spin mr-2" />
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
    </PageWrapper>
  );
};

export default ResetPasswordPage;