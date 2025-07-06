// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, User, Mail, Phone, Save, Edit, Lock } from 'lucide-react';

const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    authUser,
    isLoading,
    isUpdatingProfile,
    profileUpdateError,
    updateProfile,
    logout
  } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!isLoading && !authUser) {
      // If not loading and no authenticated user, redirect to login
      navigate('/login');
    } else if (authUser) {
      // Populate form fields with current authUser data
      setUsername(authUser.username || '');
      setEmail(authUser.email || '');
      setPhoneNumber(authUser.phoneNumber || ''); // Assuming phoneNumber exists on authUser
    }
  }, [authUser, isLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage(''); // Clear previous success messages

    const updatedData = { username, email, phoneNumber, id: authUser._id };
    const success = await updateProfile(updatedData);

    if (success) {
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false); // Exit edit mode on success
    }
    // Error message will be handled by profileUpdateError state in authStore
  };

  const handleLogOut = () => {
    logout();
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="container  mx-auto p-4 sm:p-6 lg:p-8 mt-16">
      <h1 className="text-4xl font-bold font-[poppins] mb-8 text-center">
        My Profile
      </h1>

      <div className="max-w-2xl mx-auto bg-base-100 p-6 rounded-lg shadow-xl">
        {profileUpdateError && (
          <div role="alert" className="alert alert-error mb-4">
            <span>Error: {profileUpdateError}</span>
          </div>
        )}
        {successMessage && (
          <div role="alert" className="alert alert-success mb-4">
            <span>{successMessage}</span>
          </div>
        )}

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
              type="tel" // Use type="tel" for phone numbers
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
                  <>
                 Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        <div className="w-full pt-6 border-t border-base-200">
          <button
            onClick={() => handleLogOut()}
            className="btn w-full btn-outline btn-error rounded-md"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
