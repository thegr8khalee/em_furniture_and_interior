// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
// import { usePasswordStore } from '../store/usePasswordStore'; // NEW: Import usePasswordStore
import {
  Loader2,
  User,
  Mail,
  Phone,
  Save,
  Edit,
  Lock,
  Trash2,
  EyeOff,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast'; // Ensure toast is imported for local messages

const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    authUser,
    isLoading,
    isUpdatingProfile,
    // profileUpdateError, // Removed as toast handles errors directly from store
    updateProfile,
    logout,
    deleteAccount,
    isChangingPassword,
    changePassword,
  } = useAuthStore();

  // NEW: From usePasswordStore
  // const { isChangingPassword, changePassword } = usePasswordStore();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  // const [successMessage, setSuccessMessage] = useState(''); // Removed, toast handles this

  // NEW: State for Change Password form
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && !authUser) {
      navigate('/login');
    } else if (authUser) {
      setUsername(authUser.username || '');
      setEmail(authUser.email || '');
      setPhoneNumber(authUser.phoneNumber || '');
    }
  }, [authUser, isLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // setSuccessMessage(''); // Clear previous success messages

    const updatedData = { username, email, phoneNumber };
    // Only send fields that have changed or are explicitly provided
    // The backend should handle which fields to update based on what's sent
    await updateProfile(updatedData);

    // Toast messages are now handled by the useAuthStore's updateProfile action.
    // setSuccessMessage('Profile updated successfully!'); // No longer needed here
    setIsEditing(false); // Exit edit mode on success
  };

  // NEW: Handle Change Password Submission
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }

    // Call the changePassword action from usePasswordStore
    await changePassword(oldPassword, newPassword);

    // Clear password fields after attempt
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowChangePasswordForm(false); // Close form after attempt (success or failure)
  };

  const handleLogOut = () => {
    logout();
  };

  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      await deleteAccount();
      navigate('/');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="pt-16">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 pt-16">
        <h1 className="text-4xl font-bold font-[poppins] mb-8 text-center">
          My Profile
        </h1>

        <div className="max-w-2xl mx-auto bg-base-100 p-6 rounded-lg shadow-xl">
          {/* Error and Success messages are now handled by react-hot-toast directly from store actions */}
          {/* {profileUpdateError && (
            <div role="alert" className="alert alert-error mb-4">
              <span>Error: {profileUpdateError}</span>
            </div>
          )}
          {successMessage && (
            <div role="alert" className="alert alert-success mb-4">
              <span>{successMessage}</span>
            </div>
          )} */}

          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-outline btn-primary rounded-md"
            >
              {isEditing ? (
                'Cancel Edit'
              ) : (
                <>
                  <Edit size={18} className="mr-2" /> Edit Profile
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center">
                  <User size={18} className="mr-2" /> Username
                </span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input input-bordered w-full rounded-md"
                disabled={!isEditing}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center">
                  <Mail size={18} className="mr-2" /> Email
                </span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full rounded-md"
                disabled={!isEditing}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center">
                  <Phone size={18} className="mr-2" /> Phone Number
                </span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="input input-bordered w-full rounded-md"
                disabled={!isEditing}
              />
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="submit"
                  className="btn btn-primary text-secondary rounded-md"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>Save Changes</>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* NEW: Change Password Button */}
          <div className="w-full border-t border-base-200 mt-6">
            <button
              onClick={() => setShowChangePasswordForm(!showChangePasswordForm)}
              className="btn w-full btn-outline btn-info rounded-md"
            >
              <Lock size={18} className="mr-2" />
              {showChangePasswordForm
                ? 'Hide Change Password'
                : 'Change Password'}
            </button>
          </div>

          {/* NEW: Change Password Form (Conditionally Rendered) */}
          {showChangePasswordForm && (
            <div className="mt-6 p-4 bg-base-200 rounded-lg shadow-inner">
              <h3 className="text-xl font-semibold mb-4 text-center">
                Change Your Password
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Old Password</span>
                  </label>
                  {/* Old Password Input with Validation */}
                  <label className="input validator w-full">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={oldPassword}
                      placeholder="••••••••"
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full"
                      required
                      disabled={isChangingPassword}
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
                        <Eye className="size-5 text-base-content/40" />
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
                  <label className="label">
                    <span className="label-text">New Password</span>
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
                      disabled={isChangingPassword}
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
                        <Eye className="size-5 text-base-content/40" />
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
                  <label className="label">
                    <span className="label-text">Confirm New Password</span>
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
                      disabled={isChangingPassword}
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
                        <Eye className="size-5 text-base-content/40" />
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
                <div className="flex justify-end mt-4">
                  <button
                    type="submit"
                    className="btn btn-success text-secondary rounded-md"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>Update Password</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Logout and Delete Account Buttons */}
          <div className="w-full pt- border-t border-base-200 mt-6">
            <button
              onClick={() => handleLogOut()}
              className="btn w-full btn-outline btn-error rounded-md"
            >
              Logout
            </button>
          </div>
          <div className="w-full pt-6">
            <button
              onClick={() => handleDeleteAccount()}
              className="btn w-full btn-error rounded-md"
            >
              <Trash2 />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
